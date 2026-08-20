import { useState } from "react";
import { MapPin, RefreshCw, History, Gauge } from "lucide-react";
import { useDriverLocations } from "../hooks/useDriverLocations.js";
import { fetchDriverLocationHistory } from "../lib/api.js";
import { timeAgo } from "../lib/format.js";
import Modal from "./Modal.jsx";

// Google Maps'i harita widget'ı/API anahtarı gerekmeden açan bir link -
// tıklayınca o koordinatta haritayı açar (uygulama yüklüyse mobilde
// Google Maps app'ine yönlenir).
function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Sürücülerin Android app'inden bildirdiği son konumlar (bkz.
// worker/driverLocations.js) - "şu an nerede" her zaman konum
// geçmişindeki EN SON kayıttan canlı hesaplanıyor, ayrı bir "son konum"
// alanı/tablosu yok. Henüz hiç konum bildirmemiş sürücüler listede hiç
// görünmez (Android app henüz yazılmadığı için şu an herkes bu durumda).
export default function DriverLocationsDashboard() {
  const { locations, loading, error, reload } = useDriverLocations();
  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  async function openHistory(loc) {
    setHistoryFor(loc);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await fetchDriverLocationHistory(loc.driverId));
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card">
          <MapPin size={18} />
          <div>
            <div className="stat-value">{locations.length}</div>
            <div className="stat-label">Konum Bildiren Sürücü</div>
          </div>
        </div>
      </div>

      <div className="qr-scan-toggle-row">
        <button type="button" className="icon-btn labeled" onClick={reload}>
          <RefreshCw size={16} />
          Yenile
        </button>
      </div>

      <p className="dashboard-hint">
        Sürücü Android app'inden konum bildirdikçe burada güncellenir - liste 30 saniyede bir otomatik yenilenir.
        Henüz konum bildirmemiş sürücüler burada görünmez.
      </p>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Yükleniyor…</p>
      ) : locations.length === 0 ? (
        <p className="empty-state">Henüz konum bildiren sürücü yok.</p>
      ) : (
        <div className="scan-table-wrap">
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Sürücü</th>
                  <th>Son Konum</th>
                  <th>Ne Zaman</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.driverId}>
                    <td>
                      {loc.driverAd}
                      <div className="muted code-cell">{loc.driverKod}</div>
                    </td>
                    <td className="muted">
                      <a href={mapsUrl(loc.lat, loc.lng)} target="_blank" rel="noreferrer">
                        {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                      </a>
                      {loc.hiz != null && (
                        <div className="muted">
                          <Gauge size={12} /> {Math.round(loc.hiz)} km/s
                        </div>
                      )}
                    </td>
                    <td className="muted">{timeAgo(loc.createdAt)}</td>
                    <td className="row-actions">
                      <button className="icon-btn" onClick={() => openHistory(loc)} aria-label="Geçmiş" title="Konum Geçmişi">
                        <History size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {historyFor && (
        <Modal title={`${historyFor.driverAd} - Konum Geçmişi`} onClose={() => setHistoryFor(null)}>
          {historyLoading ? (
            <p className="empty-state">Yükleniyor…</p>
          ) : historyError ? (
            <p className="form-error">{historyError}</p>
          ) : history.length === 0 ? (
            <p className="empty-state">Geçmiş kaydı yok.</p>
          ) : (
            <dl className="live-card-fields">
              {history.map((h) => (
                <div key={h.id} className="live-card-row">
                  <dt>{timeAgo(h.createdAt)}</dt>
                  <dd>
                    <a href={mapsUrl(h.lat, h.lng)} target="_blank" rel="noreferrer">
                      {h.lat.toFixed(5)}, {h.lng.toFixed(5)}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Modal>
      )}
    </div>
  );
}
