interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  maxSizeMB: 1,
};

export const compressImage = (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    // Skip non-image files
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    // Detect HEIC/HEIF (iOS default camera format) — always re-encode to JPEG
    const isHeic =
      /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

    // Skip if already small enough AND not HEIC (HEIC must be converted)
    if (
      !isHeic &&
      opts.maxSizeMB &&
      file.size <= opts.maxSizeMB * 1024 * 1024
    ) {
      resolve(file);
      return;
    }


    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > opts.maxWidth! || height > opts.maxHeight!) {
        const ratio = Math.min(opts.maxWidth! / width, opts.maxHeight! / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw with white background for transparency handling
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to compress image"));
            return;
          }

          // Create new file with original name, ensure .jpg extension
          const newName = file.name.replace(/\.(heic|heif|png|webp)$/i, ".jpg");
          const compressedFile = new File([blob], newName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        "image/jpeg",
        opts.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(
        new Error(
          "Unable to read this image. If it's a HEIC photo from iPhone, please change your camera setting to 'Most Compatible' (Settings → Camera → Formats) or pick a JPEG."
        )
      );
    };

    img.src = URL.createObjectURL(file);
  });
};

export const compressImages = async (
  files: File[],
  options?: CompressionOptions
): Promise<File[]> => {
  // Sequential on purpose: iOS Safari can OOM when decoding multiple
  // large HEIC/JPEG images into <canvas> in parallel.
  const out: File[] = [];
  for (const file of files) {
    out.push(await compressImage(file, options));
  }
  return out;
};


