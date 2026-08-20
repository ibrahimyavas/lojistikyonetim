import { useState } from "react";
import { Route, ShieldCheck } from "lucide-react";
import { useShipments } from "../hooks/useShipments.js";
import { trDate, isPastDate } from "../lib/format.js";
import EPodModal from "./EPodModal.jsx";

const DURUM_OPTIONS = [
  { value: "planlandi", label: "Planlandı" },
  { value: "yolda", label: "Yolda" },
  { value: "teslim_edildi", label: "Teslim Edildi" },
  { value: "iptal", label: "İptal" },
];
const DURUM_BADGE_CLASS = {
  planlandi: "status-warning",
  yolda: "status-good",
  teslim_edildi: "status-good",
  iptal: "status-muted",
};

// Şoför rolünün TEK ekranı - normal sekme/sidebar sistemi yerine App.jsx
// doğrudan bunu render ediyor. `useShipments` aynı hook, ama backend
// (worker/shipments.js) Şoför oturumunda otomatik olarak sadece KENDİ
// sevkiyatlarını döndürüyor - burada ayrıca bir filtre YOK, sunucu zaten
// filtreliyor.
export default function DriverPortalDashboard() {
  const { shipments, loading, error, updateOne, reload } = useShipments();
  const [podShipment, setPodShipment] = useState(null);

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card">
          <Route size={18} />
          <div>
            <div className="stat-value">{shipments.filter((s) => s.durum !== "teslim_edildi" && s.durum !== "iptal").length}</div>
            <div className="stat-label">Bekleyen Sevkiyatım</div>
          </div>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Yükleniyor…</p>
      ) : shipments.length === 0 ? (
        <p className="empty-state">Size atanmış bir sevkiyat yok.</p>
      ) : (
        <div className="scan-table-wrap">
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Taraf</th>
                  <th>Ürün</th>
                  <th>Varış</th>
                  <th>Planlanan</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id}>
                    <td>{s.tarafAdi}</td>
                    <td className="muted">{s.urunAdi || "-"}</td>
                    <td className="muted">{s.varisKonumu || "-"}</td>
                    <td className="muted">
                      {trDate(s.planlananTarih)}
                      {isPastDate(s.planlananTarih) && (s.durum === "planlandi" || s.durum === "yolda") && (
                        <span className="status-badge status-danger">Gecikti</span>
                      )}
                    </td>
                    <td>
                      <select
                        className={`status-badge ${DURUM_BADGE_CLASS[s.durum]}`}
                        value={s.durum}
                        onChange={(e) => updateOne(s.id, { durum: e.target.value })}
                      >
                        {DURUM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="row-actions">
                      <button
                        className="icon-btn"
                        onClick={() => setPodShipment(s)}
                        aria-label="Dijital Teslim Kanıtı (e-POD)"
                        title="Teslim Al & İmzalat"
                      >
                        <ShieldCheck size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {podShipment && (
        <EPodModal
          shipment={podShipment}
          onClose={() => setPodShipment(null)}
          onSuccess={() => {
            setPodShipment(null);
            // EPodModal doğrudan fetch ile (bkz. lib/api.js submitProofOfDelivery)
            // sunucuya yazıyor, useShipments'in kendi state'ini GÜNCELLEMİYOR -
            // e-POD sonrası durum='teslim_edildi' değişikliğinin listede
            // görünmesi için elle yeniden yüklemek gerekiyor.
            reload();
          }}
        />
      )}
    </div>
  );
}
