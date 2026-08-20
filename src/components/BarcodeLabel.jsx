import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

// Our format ids (shared with the scanner - see lib/barcodeDetector.js) to
// the format strings JsBarcode actually expects.
const JSBARCODE_FORMAT = {
  ean_13: "EAN13",
  ean_8: "EAN8",
  upc_a: "UPC",
  upc_e: "UPCE",
  code_128: "CODE128",
  code_39: "CODE39",
  itf: "ITF",
  codabar: "CODABAR",
};

// QR'ın basılacağı fiziksel boyut - yalnızca format === "qr_code" için
// anlamlı. `px` canvas çözünürlüğü (büyük boyutta daha yoğun/çok satırlı
// güzergah QR'ları bile net kalsın diye), `mm` ise yazdırma sırasında
// .label-card'ın gerçek fiziksel kare boyutu (bkz. index.css @media print).
export const QR_SIZE_OPTIONS = [
  { value: "kucuk", label: "Küçük (25mm)", mm: 25, px: 80 },
  { value: "orta", label: "Orta (40mm)", mm: 40, px: 120 },
  { value: "buyuk", label: "Büyük (60mm)", mm: 60, px: 170 },
];
const QR_SIZE_BY_VALUE = Object.fromEntries(QR_SIZE_OPTIONS.map((o) => [o.value, o]));
const DEFAULT_QR_SIZE = "orta";

// Renders one printable label: barcode/QR + optional ürün adı + güzergah.
// Used both for the live preview while filling out the form and, many times
// over, inside the print sheet.
//
// `qrPayload` (QR only): when set, this is what actually gets encoded into
// the QR instead of the plain `barkod` - see lib/qrPayload.js (statik metin
// ya da canlı referans). `nereden`/`nereye` are shown as visible text on
// the label too, so a human glancing at it sees the route without needing
// to scan anything.
export default function BarcodeLabel({ barkod, urunAdi, format, qrPayload, nereden, nereye, boyut }) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const qrSize = QR_SIZE_BY_VALUE[boyut] || QR_SIZE_BY_VALUE[DEFAULT_QR_SIZE];

  useEffect(() => {
    setError(null);
    if (!barkod) return;

    if (format === "qr_code") {
      if (!canvasRef.current) return;
      // margin: QR spesifikasyonunun önerdiği "sessiz bölge" (quiet zone)
      // en az 4 modül - daha ince bir kenar boşluğu, dedektörün finder
      // pattern'leri (köşe kareleri) bulmasını zorlaştırıp okuma
      // güvenilirliğini gerçek anlamda düşürür, özellikle etiket
      // yazıcısının baskı kalitesi mükemmel olmadığında. errorCorrectionLevel
      // varsayılanı ('M', ~%15) yeterli - daha yükseği (Q/H) aynı fiziksel
      // boyutta modülleri küçültüp tam tersi etki yapardı.
      QRCode.toCanvas(canvasRef.current, qrPayload || barkod, { margin: 4, width: qrSize.px }).catch((err) =>
        setError(err?.message || "QR kod üretilemedi.")
      );
      return;
    }

    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, barkod, {
        format: JSBARCODE_FORMAT[format] || "CODE128",
        width: 2,
        height: 45,
        displayValue: true,
        fontSize: 13,
        margin: 4,
      });
    } catch (err) {
      // Most common cause: the code's length/checksum doesn't fit the
      // chosen symbology (e.g. a 9-digit code picked as EAN-13).
      setError(err?.message || "Bu kod bu formatla üretilemedi.");
    }
  }, [barkod, format, qrPayload, qrSize.px]);

  const printStyle =
    format === "qr_code" ? { "--print-w": `${qrSize.mm}mm`, "--print-h": `${qrSize.mm}mm` } : undefined;

  return (
    <div className="label-card" style={printStyle}>
      {urunAdi && <div className="label-title">{urunAdi}</div>}
      {error ? (
        <div className="label-error">{error}</div>
      ) : format === "qr_code" ? (
        <canvas ref={canvasRef} />
      ) : (
        <svg ref={svgRef} />
      )}
      {(nereden || nereye) && (
        <div className="label-route">
          {nereden || "?"} → {nereye || "?"}
        </div>
      )}
    </div>
  );
}
