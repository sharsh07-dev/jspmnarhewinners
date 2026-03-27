// Cloudinary Signed Upload Service
// Cloud Name  : djaieji0g
// API Key     : 625284495946884
// API Secret  : Z3cIz5CO9OaGW3AQY9hCqjsBhf8
// NOTE: Signed uploads are used here so no dashboard preset setup is needed.

const CLOUD_NAME = "djaieji0g";
const API_KEY = "625284495946884";
const API_SECRET = "Z3cIz5CO9OaGW3AQY9hCqjsBhf8";

/**
 * Generate SHA-1 signature for Cloudinary signed upload
 * Uses the browser's native Web Crypto API (no external library needed)
 */
const generateSignature = async (paramsToSign) => {
    // Build sorted param string: "folder=agroshare&timestamp=1234"
    const paramStr =
        Object.keys(paramsToSign)
            .sort()
            .map((k) => `${k}=${paramsToSign[k]}`)
            .join("&") + API_SECRET;

    const msgBuffer = new TextEncoder().encode(paramStr);
    const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

/**
 * Upload any file to Cloudinary using a signed request
 * @param {File} file  - The file to upload (image or PDF)
 * @param {string} resourceType - "image" | "video" | "raw" (PDF → "raw")
 * @returns {Promise<string>} Secure URL of the uploaded file
 */
export const uploadToCloudinary = async (file, resourceType = "image") => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "agroshare";

    // Build params that MUST be included in the signature
    const paramsToSign = { folder, timestamp };
    const signature = await generateSignature(paramsToSign);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", API_KEY);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);
    formData.append("folder", folder);

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Cloudinary upload failed (${res.status})`);
    }

    const data = await res.json();
    return data.secure_url;
};

/**
 * Compress image client-side before uploading to reduce bandwidth usage
 * Non-image files (PDFs) are uploaded directly via "raw" resource type
 */
export const compressAndUpload = async (file) => {
    // PDFs and non-image files → upload as raw
    if (!file.type.startsWith("image/")) {
        return uploadToCloudinary(file, "raw");
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const MAX = 1200; // max dimension in px
                const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * ratio);
                canvas.height = Math.round(img.height * ratio);
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(
                    async (blob) => {
                        try {
                            const compressed = new File([blob], file.name, { type: "image/jpeg" });
                            const url = await uploadToCloudinary(compressed, "image");
                            resolve(url);
                        } catch (err) {
                            reject(err);
                        }
                    },
                    "image/jpeg",
                    0.82  // 82% quality — good balance of size vs quality
                );
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};
