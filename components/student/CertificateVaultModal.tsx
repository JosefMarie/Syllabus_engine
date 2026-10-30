"use client";

import React, { useState } from "react";
import { CourseCertificate } from "@/types/certificate";
import { 
  Award, 
  Printer, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  X, 
  Sparkles, 
  Calendar, 
  BookOpen, 
  ExternalLink 
} from "lucide-react";

interface CertificateVaultModalProps {
  certificates: CourseCertificate[];
  isOpen: boolean;
  onClose: () => void;
  selectedCertificate?: CourseCertificate | null;
}

export default function CertificateVaultModal({
  certificates,
  isOpen,
  onClose,
  selectedCertificate: initialCert
}: CertificateVaultModalProps) {
  const [activeCert, setActiveCert] = useState<CourseCertificate | null>(
    initialCert || (certificates.length > 0 ? certificates[0] : null)
  );

  if (!isOpen) return null;

  const current = activeCert || (certificates.length > 0 ? certificates[0] : null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-left">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Accredited Certificate Vault</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Official Record
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Verified certificates of curriculum mastery and outcome completion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {current && (
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Certificate</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Selector Pills if multiple */}
        {certificates.length > 1 && (
          <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2 overflow-x-auto print:hidden">
            <span className="text-xs text-slate-400 font-mono shrink-0">Your Credentials:</span>
            {certificates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCert(c)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  current?.id === c.id
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "bg-slate-800/80 text-slate-300 hover:text-white"
                }`}
              >
                {c.courseCode}
              </button>
            ))}
          </div>
        )}

        {/* Modal Body / Certificate Canvas */}
        <div className="p-6 overflow-y-auto flex-1 flex items-center justify-center bg-slate-950">
          {!current ? (
            <div className="text-center py-16 text-slate-500 space-y-3">
              <Award className="w-16 h-16 mx-auto opacity-30 text-amber-400" />
              <h4 className="text-base font-bold text-slate-300">No Certificates Awarded Yet</h4>
              <p className="text-xs max-w-sm mx-auto text-slate-400">
                Complete 100% of subtopics in any syllabus and pass all course assessments to earn your accredited digital certificate!
              </p>
            </div>
          ) : (
            <div className="w-full max-w-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0B0F19] border-4 border-amber-500/60 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden text-center text-slate-200 certificate-print-area">
              {/* Inner Decorative Golden Border */}
              <div className="absolute inset-2 sm:inset-3 border-2 border-amber-500/30 rounded-2xl pointer-events-none" />
              <div className="absolute inset-3 sm:inset-4 border border-cyan-500/20 rounded-xl pointer-events-none" />

              {/* Watermark Logo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                <Award className="w-96 h-96 text-amber-400" />
              </div>

              {/* Header Institution */}
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold tracking-widest uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Digital Syllabus Platform • Accredited Certificate</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif tracking-wider font-extrabold text-white mt-2">
                  CERTIFICATE OF COMPLETION
                </h1>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">
                  This is officially certified and awarded to
                </p>
              </div>

              {/* Student Name */}
              <div className="relative z-10 my-6 sm:my-8 border-b-2 border-amber-500/40 pb-4 max-w-lg mx-auto">
                <h2 className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 tracking-tight">
                  {current.studentName}
                </h2>
                <span className="text-xs text-slate-400 font-mono block mt-1">
                  Academic Trade: <strong className="text-cyan-300">{current.tradeName}</strong> ({current.studentLevel})
                </span>
              </div>

              {/* Course Completed */}
              <div className="relative z-10 space-y-1 mb-8 max-w-xl mx-auto">
                <p className="text-xs text-slate-300 leading-relaxed">
                  For successfully demonstrating mastery of all competency standards, learning outcomes, and practical assessments in
                </p>
                <div className="text-lg sm:text-xl font-bold text-white mt-2">
                  {current.courseCode}: {current.courseTitle}
                </div>
              </div>

              {/* Stats Highlights & Official Seal */}
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center justify-between pt-4 border-t border-slate-700/60 text-xs">
                {/* Date & Subtopics */}
                <div className="text-center sm:text-left space-y-0.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Date Issued</span>
                  <span className="font-bold text-white font-mono">
                    {new Date(current.issueDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {current.completionStats.totalSubtopics} Topics Completed
                  </span>
                </div>

                {/* Golden Seal */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 p-0.5 shadow-xl shadow-amber-950/80 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-slate-900 flex flex-col items-center justify-center text-amber-400 border border-amber-300/40">
                      <Award className="w-7 h-7" />
                      <span className="text-[8px] font-bold font-mono tracking-tighter uppercase">VERIFIED</span>
                    </div>
                  </div>
                  {current.completionStats.honorsStanding && (
                    <span className="inline-block mt-1 text-[9px] font-bold text-amber-300 font-mono uppercase tracking-wider">
                      🌟 With Honors
                    </span>
                  )}
                </div>

                {/* Signature & ID */}
                <div className="text-center sm:text-right space-y-0.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Authorized Signature</span>
                  <div className="font-serif italic text-base text-amber-200">
                    {current.instructorSignature}
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono block truncate max-w-[200px] sm:ml-auto">
                    ID: {current.id}
                  </span>
                </div>
              </div>

              {/* Verification Hash Footer */}
              <div className="relative z-10 mt-6 pt-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>Cryptographic Proof: {current.certificateHash}</span>
                <span className="text-cyan-400">syllabus-ad688.web.app/verify</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
