import { CourseCertificate, CertificateStats } from "@/types/certificate";
import { UserProfile, StudentLevel } from "@/types/auth";
import { Syllabus } from "@/types/syllabus";
import { db, isFirebaseConfigured } from "./firebase";
import { collection, doc, getDocs, getDoc, setDoc, query, where } from "firebase/firestore";

const CERTIFICATES_STORAGE_KEY = "syllabus_platform_certificates_v1";

export function generateCertificateId(courseCode: string, studentUid: string): string {
  const cleanCode = courseCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const studentShort = studentUid.substring(0, 4).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CERT-2026-${cleanCode}-${studentShort}${randomSuffix}`;
}

export function generateCertificateHash(certId: string, issueDate: string): string {
  // Deterministic verifiable hex-like hash representation
  let hash = 0;
  const str = `${certId}_${issueDate}_SYLLABUS_PLATFORM_ACCREDITED`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return "0x" + Math.abs(hash).toString(16).padStart(16, "0").toUpperCase();
}

export interface IssueCertificateParams {
  student: UserProfile;
  syllabus: Syllabus;
  tradeName: string;
  stats: CertificateStats;
  instructorName?: string;
}

export async function issueCourseCertificate(params: IssueCertificateParams): Promise<CourseCertificate> {
  const { student, syllabus, tradeName, stats, instructorName } = params;
  const issueDate = new Date().toISOString();
  const certId = generateCertificateId(syllabus.courseCode, student.uid);
  const certHash = generateCertificateHash(certId, issueDate);

  const cert: CourseCertificate = {
    id: certId,
    studentUid: student.uid,
    studentName: student.fullName || student.username,
    studentUsername: student.username,
    studentEmail: student.email,
    studentLevel: student.level,
    tradeName,
    courseCode: syllabus.courseCode,
    courseTitle: syllabus.title,
    syllabusId: syllabus.id,
    issueDate,
    completionStats: stats,
    instructorSignature: instructorName || "Director of Academic Accreditation",
    certificateHash: certHash
  };

  // Save to Firebase
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "issued_certificates", cert.id), cert);
    } catch (e) {
      console.warn("Firestore issueCourseCertificate error:", e);
    }
  }

  // Save to LocalStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CERTIFICATES_STORAGE_KEY);
      const list: CourseCertificate[] = raw ? JSON.parse(raw) : [];
      const existingIdx = list.findIndex(c => c.id === cert.id || (c.studentUid === student.uid && c.syllabusId === syllabus.id));
      if (existingIdx >= 0) {
        list[existingIdx] = cert;
      } else {
        list.push(cert);
      }
      localStorage.setItem(CERTIFICATES_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  return cert;
}

export async function getStudentCertificates(studentUid: string): Promise<CourseCertificate[]> {
  let list: CourseCertificate[] = [];

  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "issued_certificates"), where("studentUid", "==", studentUid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as CourseCertificate);
      }
    } catch (e) {
      console.warn("Firestore getStudentCertificates error:", e);
    }
  }

  if (list.length === 0 && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CERTIFICATES_STORAGE_KEY);
      if (raw) {
        const all: CourseCertificate[] = JSON.parse(raw);
        list = all.filter(c => c.studentUid === studentUid);
      }
    } catch (e) {}
  }

  return list;
}

export async function getAllIssuedCertificates(): Promise<CourseCertificate[]> {
  let list: CourseCertificate[] = [];

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, "issued_certificates"));
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as CourseCertificate);
      }
    } catch (e) {
      console.warn("Firestore getAllIssuedCertificates error:", e);
    }
  }

  if (list.length === 0 && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CERTIFICATES_STORAGE_KEY);
      if (raw) list = JSON.parse(raw);
    } catch (e) {}
  }

  return list;
}
