import cloudinary from "@/configs/cloudinary.config";

export function uploadImageToCloudinary(
  buffer: Buffer,
  userId: number
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "images",
          public_id: `user_${userId}`,
          overwrite: true, // ghi đè image cũ
          resource_type: "image",
        },
        (error, result) => {
          if (error || !result) {
            reject(error);
            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      )
      .end(buffer);
  });
}
