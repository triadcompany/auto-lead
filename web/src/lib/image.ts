/**
 * Resize an image File to a square of `size` pixels using a center-crop
 * (cover) strategy. Returns a JPEG File suitable for upload.
 *
 * Used to keep avatar uploads small and avoid distortion when the source
 * image is not square.
 */
export async function resizeAndCropToSquare(
  file: File,
  size = 512,
  quality = 0.9,
): Promise<File> {
  // Decode the image
  const bitmap = await createImageBitmap(file).catch(async () => {
    // Fallback for browsers without createImageBitmap support
    const img = await loadImageElement(file);
    return img as unknown as ImageBitmap;
  });

  const sourceW = (bitmap as any).width as number;
  const sourceH = (bitmap as any).height as number;

  // Center-crop to square
  const cropSize = Math.min(sourceW, sourceH);
  const sx = (sourceW - cropSize) / 2;
  const sy = (sourceH - cropSize) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap as any,
    sx,
    sy,
    cropSize,
    cropSize,
    0,
    0,
    size,
    size,
  );

  // Free memory if it was a real ImageBitmap
  if ((bitmap as any).close) (bitmap as any).close();

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      "image/jpeg",
      quality,
    ),
  );

  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
