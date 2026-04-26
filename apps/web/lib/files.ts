export type EncodedFile = {
  fileName: string;
  contentType: string;
  base64Content: string;
};

export async function fileToBase64Payload(file: File): Promise<EncodedFile> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });

  return {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    base64Content: dataUrl.split(',')[1] ?? dataUrl,
  };
}

export async function filesToBase64Payloads(files: FileList | File[]) {
  return Promise.all(Array.from(files).map((file) => fileToBase64Payload(file)));
}
