// Bu proje sadece QR (güzergah etiketleri) okuyor - barkod-okuyucu
// ERP'sindeki gibi ürün barkodu (EAN/UPC/Code128...) tarama ihtiyacı yok,
// bu yüzden ağır native/zxing-wasm barkod dedektör altyapısı hiç
// PORTLANMADI - sadece QR moduna özel, hafif nimiq/qr-scanner tabanlı
// dedektör var (bkz. qrScannerDetector.js).
export const QR_ONLY_FORMATS = ["qr_code"];

// getSupportedFormats() reporting "qr_code" doesn't guarantee the native
// implementation actually decodes QR reliably in practice - so QR mode
// never uses the browser's native BarcodeDetector, regardless of what it
// claims to support. Dynamically imported so its code (and the qr-scanner
// worker it sets up) only downloads when someone actually opens a QR
// scanner panel.
export async function resolveQrOnlyDetector() {
  const { QrScannerDetector } = await import("./qrScannerDetector.js");
  return { Impl: QrScannerDetector, usingNative: false };
}
