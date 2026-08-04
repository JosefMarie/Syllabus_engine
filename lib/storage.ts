import { storage } from "./firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export async function uploadFileToStorage(
  file: File,
  folder: string = "syllabi_docs",
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!storage) {
    throw new Error("Firebase Storage is not configured properly.");
  }

  const fileExtension = file.name.split(".").pop();
  const safeName = file.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${Date.now()}_${safeName}`;
  const storageRef = ref(storage, `${folder}/${fileName}`);

  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error("Storage upload error:", error);
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}
