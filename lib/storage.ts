import { storage } from "./firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

/**
 * Uploads a File or Blob to Firebase Storage and returns the permanent public download URL.
 */
export async function uploadFileToStorage(
  file: File | Blob,
  folder: string = "syllabi_docs",
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!storage) {
    throw new Error("Firebase Storage is not configured properly.");
  }

  const rawName = (file as File).name || `image_${Date.now()}.png`;
  const safeName = rawName.replace(/[^a-zA-Z0-9_.-]/g, "_");
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
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (urlErr) {
          reject(urlErr);
        }
      }
    );
  });
}

/**
 * Compresses an image blob or data URL to an optimized, lightweight WebP/JPEG data URL.
 * Useful as a fallback when offline or if Storage fails.
 */
export async function compressImageToDataUrl(
  source: Blob | string,
  maxWidth: number = 1200,
  quality: number = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Try WebP, fall back to JPEG
      let dataUrl = canvas.toDataURL("image/webp", quality);
      if (!dataUrl.startsWith("data:image/webp")) {
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(dataUrl);
    };

    img.onerror = (err) => reject(err);

    if (typeof source === "string") {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Uploads a Blob, blob: URL, or base64 data URL to Firebase Storage.
 * Falls back to an optimized compressed data URL if storage fails.
 */
export async function uploadBlobOrDataUrl(
  source: Blob | string,
  folder: string = "syllabus_images"
): Promise<string> {
  try {
    let blob: Blob;
    if (typeof source === "string") {
      if (source.startsWith("http") && !source.startsWith("http://localhost") && !source.includes("blob:")) {
        // Already a permanent remote URL
        return source;
      }
      const res = await fetch(source);
      blob = await res.blob();
    } else {
      blob = source;
    }

    if (storage) {
      return await uploadFileToStorage(blob, folder);
    }
  } catch (err) {
    console.warn("Storage upload failed, attempting offline compression fallback:", err);
  }

  // Fallback: compress to optimized data URL under Firestore size limits
  return await compressImageToDataUrl(source);
}
