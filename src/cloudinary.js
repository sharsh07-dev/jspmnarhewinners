// Legacy shim – all upload logic is now in src/services/cloudinary.js
export { uploadToCloudinary as uploadImage, compressAndUpload } from "./services/cloudinary.js";
