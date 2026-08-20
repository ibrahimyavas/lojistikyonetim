import { Fragment, useCallback, useMemo, useState } from "react";
import { Route, PackageCheck, AlertTriangle, Plus, Pencil, Trash2, X, Search, QrCode, Check } from "lucide-react";
import { useShipments } from "../hooks/useShipments.js";
import { useCameraScanner } from "../hooks/useCameraScanner.js";
import { QR_ONLY_FORMATS, resolveQrOnlyDetector } from "../lib/barcodeDetector.js";
import { parseRoutePayload, parseRouteRef } from "../lib/qrPayload.js";
import { fetchShipment } from "../lib/api.js";
import { todayISO, trDate, isPastDate, groupByDate } from "../lib/format.js";
import DatePicker from "./DatePicker.jsx";
import CameraPanel from "./CameraPanel.jsx";
import Modal from "./Modal.jsx";

// Etiket Bas'ta bastığımız güzergah QR'ları (bkz. lib/qrPayload.js) burada
// tekrar okunuyor.
const QR_CROP_REGION = { widthPct: 0.8, heightPct: 0.8 };

const EMPTY_FORM = {
  yon: "giden",
  tarafAdi: "",
  tarafTelefon: "",
  barkod: "",
  urunAdi: "",
  aracId: "",
  surucuId: "",
  cikisKonumu: "",
  varisKonumu: "",
  planlananTarih: todayISO(),
  durum: "planlandi",
  notMetni: "",
  teslimDepoId: "",
  teslimAlanKisi: "",
};

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

function isGecikti(s) {
  return (s.durum === "planlandi" || s.durum === "yolda") && isPastDate(s.planlananTarih);
}

function toFormShape(s) {
  return {
    yon: s.yon || "giden",
    tarafAdi: s.tarafAdi || "",
    tarafTelefon: s.tarafTelefon || "",
    barkod: s.barkod || "",
    urunAdi: s.urunAdi || "",
    aracId: s.aracId || "",
    surucuId: s.surucuId || "",
    cikisKonumu: s.cikisKonumu || "",
    varisKonumu: s.varisKonumu || "",
    planlananTarih: s.planlananTarih || todayISO(),
    durum: s.durum || "planlandi",
    notMetni: s.notMetni || "",
    teslimDepoId: s.teslimDepoId || "",
    teslimAlanKisi: s.teslimAlanKisi || "",
  };
}

// Dış sevkiyat (müşteriye giden / tedarikçiden gelen) - şirket içi depo/raf
// hareketleri için "Depo Transferleri" sekmesini kullanın. Araç/sürücü
// artık gerçek Vehicles/Drivers kayıtlarına bağlı (serbest metin değil) -
// barkod-okuyucu ERP'sindeki Lojistik modülünün özelleşmiş hali.
export default function ShipmentsDashboard({ vehicles = [], drivers = [], warehouses = [] }) {
  const { shipments, loading, error, addShipment, updateOne, removeShipment } = useShipments();

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastHit, setLastHit] = useState(null);

  // "Canlı" (ID referanslı) bir QR okutulunca açılan bilgi kartı - bkz.
  // lib/qrPayload.js buildRouteRef/parseRouteRef. liveRecord her okutmada
  // sunucudan TAZE çekiliyor, yerel shipments listesine güvenmiyoruz.
  const [liveRef, setLiveRef] = useState(null);
  const [liveRecord, setLiveRecord] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [liveVaris, setLiveVaris] = useState("");

  function closeLiveCard() {
    setLiveRef(null);
    setLiveRecord(null);
    setLiveError(null);
  }

  async function handleLiveDurumChange(durum) {
    if (!liveRecord) return;
    await updateOne(liveRecord.id, { durum });
    setLiveRecord((r) => (r ? { ...r, durum } : r));
  }

  async function handleLiveVarisSave() {
    if (!liveRecord) return;
    await updateOne(liveRecord.id, { varisKonumu: liveVaris });
    setLiveRecord((r) => (r ? { ...r, varisKonumu: liveVaris } : r));
  }

  // Etiket Bas'ta bastığımız güzergah QR'ını okutunca formu tek seferde
  // doldurur. Bir "canlı referans" QR'ıysa (buildRouteRef ile basılmış)
  // formu doldurmak yerine o sevkiyatın GÜNCEL halini sunucudan çekip bir
  // bilgi kartı açıyoruz. Kamera açık kalıyor - kullanıcı "Kapat"a basana
  // kadar art arda tarayabilir.
  const handleQrDetect = useCallback((code) => {
    setLastHit({ code, ts: Date.now() });

    const ref = parseRouteRef(code);
    if (ref) {
      setLiveRef(ref);
      setLiveRecord(null);
      if (ref.tur !== "shipment") {
        setLiveError("Bu QR bir Depo Transferi'ne ait - Depo Transferleri ekranından okutun.");
        setLiveLoading(false);
        return;
      }
      setLiveError(null);
      setLiveLoading(true);
      fetchShipment(ref.id)
        .then((s) => {
          setLiveRecord(s);
          setLiveVaris(s.varisKonumu || "");
        })
        .catch((err) => setLiveError(err.message))
        .finally(() => setLiveLoading(false));
      return;
    }

    const parsed = parseRoutePayload(code);
    setForm((f) => ({
      ...f,
      barkod: parsed?.barkod || code,
      urunAdi: parsed?.urunAdi || f.urunAdi,
      cikisKonumu: parsed?.nereden || f.cikisKonumu,
      varisKonumu: parsed?.nereye || f.varisKonumu,
    }));
  }, []);

  const camera = useCameraScanner({
    enabled: scannerOpen,
    formats: QR_ONLY_FORMATS,
    resolveDetector: resolveQrOnlyDetector,
    cropRegion: QR_CROP_REGION,
    onDetect: handleQrDetect,
  });

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const vehicleLabel = useMemo(() => {
    const byId = new Map(vehicles.map((v) => [v.id, v.plaka]));
    return (id) => (id ? byId.get(id) || "-" : "-");
  }, [vehicles]);

  const driverLabel = useMemo(() => {
    const byId = new Map(drivers.map((d) => [d.id, d.ad]));
    return (id) => (id ? byId.get(id) || "-" : "-");
  }, [drivers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shipments;
    return shipments.filter((s) =>
      [s.tarafAdi, s.urunAdi, s.barkod, vehicleLabel(s.aracId), driverLabel(s.surucuId)].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [shipments, query, vehicleLabel, driverLabel]);

  const groups = useMemo(() => groupByDate(filtered, (s) => s.planlananTarih), [filtered]);

  const stats = useMemo(() => {
    const yolda = shipments.filter((s) => s.durum === "yolda").length;
    const bugunPlanlanan = shipments.filter((s) => s.durum !== "iptal" && s.planlananTarih === todayISO()).length;
    const geciken = shipments.filter(isGecikti).length;
    return { yolda, bugunPlanlanan, geciken };
  }, [shipments]);

  function startEdit(s) {
    setEditingId(s.id);
    setForm(toFormShape(s));
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, planlananTarih: form.planlananTarih });
    setSubmitError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const tarafAdi = form.tarafAdi.trim();
    if (!tarafAdi) {
      setSubmitError("Taraf adı zorunlu.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (editingId) {
        await updateOne(editingId, { ...form, tarafAdi });
        setEditingId(null);
      } else {
        await addShipment({ ...form, tarafAdi });
      }
      setForm({ ...EMPTY_FORM, planlananTarih: form.planlananTarih });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card">
          <Route size={18} />
          <div>
            <div className="stat-value">{stats.yolda}</div>
            <div className="stat-label">Yolda</div>
          </div>
        </div>
        <div className="stat-card">
          <PackageCheck size={18} />
          <div>
            <div className="stat-value">{stats.bugunPlanlanan}</div>
            <div className="stat-label">Bugün Planlanan</div>
          </div>
        </div>
        <div className="stat-card">
          <AlertTriangle size={18} />
          <div>
            <div className="stat-value">{stats.geciken}</div>
            <div className="stat-label">Geciken</div>
          </div>
        </div>
      </div>

      <div className="qr-scan-toggle-row">
        <button
          type="button"
          className={`icon-btn labeled ${scannerOpen ? "active" : ""}`}
          onClick={() => setScannerOpen((v) => !v)}
        >
          <QrCode size={16} />
          {scannerOpen ? "Taramayı Kapat" : "QR ile Sevkiyat Doldur"}
        </button>
      </div>

      {scannerOpen && (
        <CameraPanel camera={camera} cameraOn={scannerOpen} onToggleCamera={() => setScannerOpen(false)} scanMode="qr" lastHit={lastHit} />
      )}

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="sh-yon">Yön</label>
          <select id="sh-yon" value={form.yon} onChange={(e) => updateField("yon", e.target.value)}>
            <option value="giden">Giden (müşteriye)</option>
            <option value="gelen">Gelen (tedarikçiden)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="sh-taraf">Taraf Adı *</label>
          <input id="sh-taraf" type="text" value={form.tarafAdi} onChange={(e) => updateField("tarafAdi", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="sh-taraf-tel">Taraf Telefon</label>
          <input id="sh-taraf-tel" type="text" value={form.tarafTelefon} onChange={(e) => updateField("tarafTelefon", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="sh-barkod">Barkod</label>
          <input
            id="sh-barkod"
            type="text"
            value={form.barkod}
            onChange={(e) => updateField("barkod", e.target.value)}
            placeholder="Taranan kod ya da elle girin"
          />
        </div>

        <div className="field">
          <label htmlFor="sh-urun">Ürün Adı</label>
          <input id="sh-urun" type="text" value={form.urunAdi} onChange={(e) => updateField("urunAdi", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="sh-arac">Araç (opsiyonel)</label>
          <select id="sh-arac" value={form.aracId} onChange={(e) => updateField("aracId", e.target.value)}>
            <option value="">— Atanmamış —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plaka}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="sh-surucu">Sürücü (opsiyonel)</label>
          <select id="sh-surucu" value={form.surucuId} onChange={(e) => updateField("surucuId", e.target.value)}>
            <option value="">— Atanmamış —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="sh-cikis">Çıkış Konumu</label>
          <input id="sh-cikis" type="text" value={form.cikisKonumu} onChange={(e) => updateField("cikisKonumu", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="sh-varis">Varış Konumu</label>
          <input id="sh-varis" type="text" value={form.varisKonumu} onChange={(e) => updateField("varisKonumu", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="sh-tarih">Planlanan Tarih</label>
          <DatePicker id="sh-tarih" value={form.planlananTarih} onChange={(v) => updateField("planlananTarih", v)} />
        </div>

        <div className="field">
          <label htmlFor="sh-durum">Durum</label>
          <select id="sh-durum" value={form.durum} onChange={(e) => updateField("durum", e.target.value)}>
            {DURUM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {form.yon === "gelen" && (
          <>
            <div className="field">
              <label htmlFor="sh-teslim-depo">Teslim Noktası (depo)</label>
              <select id="sh-teslim-depo" value={form.teslimDepoId} onChange={(e) => updateField("teslimDepoId", e.target.value)}>
                <option value="">— Seçilmedi —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.ad}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="sh-teslim-kisi">Teslim Alan Kişi</label>
              <input
                id="sh-teslim-kisi"
                type="text"
                value={form.teslimAlanKisi}
                onChange={(e) => updateField("teslimAlanKisi", e.target.value)}
                placeholder="Malı kim teslim alacak"
              />
            </div>
          </>
        )}

        <div className="field field-wide">
          <label htmlFor="sh-not">Not</label>
          <input id="sh-not" type="text" value={form.notMetni} onChange={(e) => updateField("notMetni", e.target.value)} />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {submitting ? "Kaydediliyor…" : editingId ? "Güncelle" : "Sevkiyat Ekle"}
          </button>
          {editingId && (
            <button type="button" className="icon-btn" onClick={cancelEdit}>
              <X size={16} /> İptal
            </button>
          )}
        </div>
      </form>

      <div className="scan-table-wrap">
        <div className="scan-search">
          <Search size={16} />
          <input type="text" placeholder="Taraf, ürün, araç ya da sürücüde ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">{shipments.length === 0 ? "Henüz sevkiyat kaydı yok." : "Aramayla eşleşen kayıt yok."}</p>
        ) : (
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Yön</th>
                  <th>Taraf</th>
                  <th>Ürün</th>
                  <th>Araç / Sürücü</th>
                  <th>Planlanan</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="date-divider">
                      <td colSpan={7}>{g.label}</td>
                    </tr>
                    {g.items.map((s) => (
                      <tr key={s.id} className={editingId === s.id ? "editing-row" : ""}>
                        <td className="muted">{s.yon === "giden" ? "Giden" : "Gelen"}</td>
                        <td>{s.tarafAdi}</td>
                        <td className="muted">{s.urunAdi || "-"}</td>
                        <td className="muted">
                          {vehicleLabel(s.aracId)}
                          {s.surucuId ? ` · ${driverLabel(s.surucuId)}` : ""}
                        </td>
                        <td className="muted">{trDate(s.planlananTarih)}</td>
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
                          {isGecikti(s) && (
                            <span className="status-badge status-danger" title="Planlanan tarih geçti">
                              Gecikti
                            </span>
                          )}
                        </td>
                        <td className="row-actions">
                          <button className="icon-btn" onClick={() => startEdit(s)} aria-label="Düzenle" title="Düzenle">
                            <Pencil size={15} />
                          </button>
                          <button className="icon-btn danger" onClick={() => removeShipment(s.id)} aria-label="Sil" title="Sil">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {liveRef && (
        <Modal title="Sevkiyat - Canlı Bilgi" onClose={closeLiveCard}>
          {liveLoading ? (
            <p className="empty-state">Yükleniyor…</p>
          ) : liveError ? (
            <p className="form-error">{liveError}</p>
          ) : liveRecord ? (
            <>
              <dl className="live-card-fields">
                <div className="live-card-row">
                  <dt>Taraf</dt>
                  <dd>{liveRecord.tarafAdi}</dd>
                </div>
                <div className="live-card-row">
                  <dt>Ürün</dt>
                  <dd>{liveRecord.urunAdi || "-"}</dd>
                </div>
                <div className="live-card-row">
                  <dt>Araç / Sürücü</dt>
                  <dd>
                    {vehicleLabel(liveRecord.aracId)}
                    {liveRecord.surucuId ? ` · ${driverLabel(liveRecord.surucuId)}` : ""}
                  </dd>
                </div>
                <div className="live-card-row">
                  <dt>Çıkış Konumu</dt>
                  <dd>{liveRecord.cikisKonumu || "-"}</dd>
                </div>
                <div className="live-card-row">
                  <dt>Planlanan Tarih</dt>
                  <dd>{trDate(liveRecord.planlananTarih)}</dd>
                </div>
              </dl>

              <div className="field">
                <label htmlFor="sh-live-durum">Durum</label>
                <select
                  id="sh-live-durum"
                  className={`status-badge ${DURUM_BADGE_CLASS[liveRecord.durum]}`}
                  value={liveRecord.durum}
                  onChange={(e) => handleLiveDurumChange(e.target.value)}
                >
                  {DURUM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="sh-live-varis">Varış Konumu</label>
                <div className="live-card-location-edit">
                  <input id="sh-live-varis" type="text" value={liveVaris} onChange={(e) => setLiveVaris(e.target.value)} />
                  <button type="button" className="icon-btn" onClick={handleLiveVarisSave} title="Kaydet">
                    <Check size={15} />
                  </button>
                </div>
              </div>

              <p className="dashboard-hint">
                Bu bilgi canlıdır - kaydı güncelledikçe (burada ya da tablodan) aynı etiketi tekrar okutunca güncel
                hali görünür.
              </p>
            </>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
