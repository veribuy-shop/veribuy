import { ImagePickerAsset } from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

const MAX_SIDE = 2048;

/**
 * Shrinks a photo for upload and re-encodes it as JPEG. Re-encoding also drops
 * EXIF data, so a seller's GPS location never leaves the phone, and it turns
 * HEIC into a format the server accepts. Same size limit as the web form.
 */
export async function prepareImage(asset: Pick<ImagePickerAsset, 'uri' | 'width' | 'height'>): Promise<string> {
  const longest = Math.max(asset.width ?? 0, asset.height ?? 0);
  const resize =
    longest > MAX_SIDE
      ? [{ resize: asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE } }]
      : [];
  const result = await manipulateAsync(asset.uri, resize, { compress: 0.85, format: SaveFormat.JPEG });
  return result.uri;
}
