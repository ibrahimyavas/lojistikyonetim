// QR moduna özel dedektör: nimiq/qr-scanner (https://github.com/nimiq/qr-scanner)
// kütüphanesini sarmalar - üretimde yaygın kullanılan, olgun bir üçüncü
// parti proje.
//
// Neden bu kütüphane:
//  - ZXing'in optimize edilmiş bir JS türevini kullanıyor; düz jsQR tabanlı
//    kütüphanelere kıyasla belirgin daha yüksek okuma oranı sağlıyor.
//  - Dekode işlemini bir Web Worker'da çalıştırıyor - ana thread'i (kamera
//    önizlemesi + arayüz) bloklamıyor.
//  - Devam eden taramalarda motoru (worker) tekrar tekrar kurmadan yeniden
//    kullanmaya izin veriyor (performans için önerilen kullanım şekli).
//
// Kütüphane varsayılan olarak tarayıcının native BarcodeDetector'ını
// mevcutsa tercih ediyor - bazı cihazlarda native "destekliyorum" diyor ama
// gerçekte güvenilir çalışmıyor, bu yüzden _disableBarcodeDetector=true ile
// bunu tamamen devre dışı bırakıp her zaman worker motorunu zorluyoruz.
import QrScanner from "qr-scanner";

QrScanner._disableBarcodeDetector = true;

// Worker'ı yalnızca bir kez oluşturup tüm detect() çağrılarında yeniden
// kullanıyoruz - her karede yeni bir worker açmak ciddi bir performans
// kaybı olurdu.
let enginePromise = null;
function getEngine() {
  if (!enginePromise) enginePromise = QrScanner.createQrEngine();
  return enginePromise;
}

export class QrScannerDetector {
  constructor() {
    // scanImage'in her çağrıda yeniden kullanacağı canvas - kendi
    // boyutlandırmasını otomatik yapıyor, bizim ayrıca ayarlamamıza gerek yok.
    this._canvas = document.createElement("canvas");
  }

  async detect(source) {
    try {
      const result = await QrScanner.scanImage(source, {
        qrEngine: getEngine(),
        canvas: this._canvas,
        returnDetailedScanResult: true,
      });
      return [{ rawValue: result.data, format: "qr_code", cornerPoints: result.cornerPoints }];
    } catch {
      // "No QR code found" (her karede beklenen normal durum) ya da geçici
      // bir dekode hatası - boş sonuç döndürmek useCameraScanner'ın zaten
      // bildiği "bu karede bir şey yok" davranışıyla birebir örtüşüyor.
      return [];
    }
  }
}
