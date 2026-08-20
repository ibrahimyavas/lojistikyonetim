import { useEffect } from "react";
import { X } from "lucide-react";

// Genel amaçlı, hafif bir popup - Etiket Bas'ın "oluşturulmuş QR'ı göster/
// yazdır" popup'ı ve Sevkiyat/Depo Transferleri'nin "Canlı Bilgi" kartı
// için kullanılıyor. Yazdırma sırasında zaten otomatik gizleniyor (@media
// print zaten .print-area dışındaki her şeyi gizliyor, bkz. index.css).
export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Kapat" title="Kapat">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
