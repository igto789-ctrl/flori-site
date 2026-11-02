// Только для браузера: использует canvas.
export const MAX_BYTES = 4 * 1024 * 1024;

// Фото с телефона бывают 5–10 МБ: уменьшаем до 2000 px и пересохраняем в JPEG.
export async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || !file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // браузер не смог открыть картинку — отправим как есть, сервер проверит
  }
}
