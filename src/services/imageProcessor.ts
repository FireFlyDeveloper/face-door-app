/**
 * Image processing utilities for the React + Capacitor app.
 * Compresses, resizes, and converts captured images to base64 for BT transfer.
 */

const TARGET_WIDTH = 640;   // 480p width
const TARGET_HEIGHT = 480;  // 480p height
const JPEG_QUALITY = 0.6;   // JPEG quality (0-1)

export interface ProcessedImage {
  base64: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Load an image from a File or Blob into an HTML Image element.
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Resize an image to target dimensions while maintaining aspect ratio.
 * Centres the result on a canvas with the exact target size.
 */
function resizeImage(
  img: HTMLImageElement,
  maxW: number,
  maxH: number,
): { canvas: HTMLCanvasElement; w: number; h: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  let w = img.width;
  let h = img.height;

  // Scale down to fit within maxW x maxH
  if (w > maxW || h > maxH) {
    const ratio = Math.min(maxW / w, maxH / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  return { canvas, w, h };
}

/**
 * Process a captured image: resize to 480p, convert to JPEG base64.
 * Returns the base64 string WITHOUT the data:image/jpeg;base64, prefix.
 */
export async function processImage(file: File | Blob): Promise<ProcessedImage> {
  const img = await loadImage(file);
  const { canvas, w, h } = resizeImage(img, TARGET_WIDTH, TARGET_HEIGHT);

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

  return {
    base64,
    width: w,
    height: h,
    sizeBytes: Math.round((base64.length * 3) / 4), // approximate
  };
}

/**
 * Process multiple images in parallel.
 */
export async function processImages(files: (File | Blob)[]): Promise<ProcessedImage[]> {
  return Promise.all(files.map(processImage));
}
