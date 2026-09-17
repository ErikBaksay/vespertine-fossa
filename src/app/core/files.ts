export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${['B','KB','MB','GB'][unit]}`;
}
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  // Give the browser time to consume the download, then release the original.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function isPreviewImage(mime: string): boolean { return /^image\/(png|jpeg|gif|webp|avif|bmp|x-icon)$/.test(mime); }
