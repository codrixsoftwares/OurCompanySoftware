import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'gymcfo5j',
  api_key: process.env.CLOUDINARY_API_KEY || '562398213255798',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'Tc3PqC0KnNq7UpxnvS4Ff4yZT2A',
  secure: true
});

export async function uploadToCloudinary(fileBase64: string, folder: string = 'codrix_docs'): Promise<string> {
  const result = await cloudinary.uploader.upload(fileBase64, {
    folder: `codrix/${folder}`,
    resource_type: 'auto'
  });
  return result.secure_url;
}

export default cloudinary;
