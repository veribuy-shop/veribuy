/**
 * Shrinks evidence photos in the browser before upload.
 *
 * Phone photos saved as PNG are often 5–10 MB; several of those uploaded at
 * once over mobile data time out. Re-encoding to a 2048px JPEG keeps plenty
 * of detail for buyers and reviewers at a fraction of the size, and drops
 * EXIF/GPS metadata on the way. Anything the browser can't decode (e.g. HEIC
 * on Chrome) is uploaded unchanged — the server accepts and converts it.
 */

const MAX_EDGE_PX = 2048;
const JPEG_QUALITY = 0.85;
/** Small files are already fast to upload — leave them untouched. */
const SKIP_BELOW_BYTES = 1.5 * 1024 * 1024;
const RESIZABLE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/** Returns the target size for an image, keeping the aspect ratio. */
export function scaledDimensions(width: number, height: number, maxEdge = MAX_EDGE_PX): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

export async function prepareImageForUpload(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') return file;
  if (!RESIZABLE_TYPES.has(file.type.toLowerCase())) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    const target = scaledDimensions(bitmap.width, bitmap.height);
    const needsResize = target.width !== bitmap.width || target.height !== bitmap.height;
    if (!needsResize && file.size < SKIP_BELOW_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG has no alpha: paint white so transparent PNG areas don't turn black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
