/** Upper bound for uploaded logo files before base64 encoding (~⅔ MB string in DB). */
export const MAX_COMPANY_LOGO_BYTES = 512 * 1024;

export function assertCompanyLogoFileSize(file: File): void {
  if (file.size > MAX_COMPANY_LOGO_BYTES) {
    throw new Error(
      `Logo must be ${MAX_COMPANY_LOGO_BYTES / 1024} KB or smaller (before encoding).`,
    );
  }
}

/** Reads an image file as a `data:image/...;base64,...` URL for `companies.company_logo_url`. */
export function fileToImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result;
      if (typeof s !== "string" || !s.startsWith("data:image/")) {
        reject(new Error("Could not encode image — use PNG, JPG, GIF, or WebP."));
        return;
      }
      resolve(s);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}
