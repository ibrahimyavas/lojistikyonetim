import { Fragment, useCallback, useMemo, useState } from "react";
import { ArrowRightLeft, PackageCheck, Plus, Pencil, Trash2, X, Search, QrCode, Check } from "lucide-react";
import { useWarehouseTransfers } from "../hooks/useWarehouseTransfers.js";
import { useCameraScanner } from "../hooks/useCameraScanner.js";
import { QR_ONLY_FORMATS, resolveQrOnlyDetector } from "../lib/barcodeDetector.js";
import { parseRoutePayload, parseRouteRef } from "../lib/qrPayload.js";
import { fetchWarehouseTransfer } from "../lib/api.js";
import { todayISO, trDate, groupByDate } from "../lib/format.js";
import DatePicker from "./DatePicker.jsx";
import CameraPanel from "./CameraPanel.jsx";
import Modal from "./Modal.jsx";

// Etiket Bas'ta bastığımız güzergah QR'ları burada tekrar okunuyor -
// Sevkiyat'taki QR modu ile aynı altyapı/kırpma bölgesi.
const QR_CROP_REGION = { widthPct: 0.8, heightPct: 0.8 };

const EMPTY_FORM = {
  barkod: "",
  urunAdi: "",
  miktar: "",
  birim: "",
  kaynakDepoId: "",
  hedefDepoId: "",
  tarih: todayISO(),
  durum: "planlandi",
  notMetni: "",
};

const DURUM_OPTIONS = [
  { value: "planlandi", label: "Planlandı" },
  { value: "tamamlandi", label: "Tamamlandı" },
];
const DURUM_BADGE_CLASS = { planlandi: "status-warning", tamamlandi: "status-good" };

function toFormShape(t) {
  return {
    barkod: t.barkod || "",
    urunAdi: t.urunAdi || "",
    miktar: t.miktar ?? "",
    birim: t.birim || "",
    kaynakDepoId: t.kaynakDepoId || "",
    hedefDepoId: t.hedefDepoId || "",
    tarih: t.tarih || todayISO(),
    durum: t.durum || "planlandi",
    notMetni: t.notMetni || "",
  };
}

// Şirket içi depo arası ürün hareketleri - müşteri/tedarikçiye giden
// sevkiyatlar için "Sevkiyat" sekmesini kullanın. Kaynak/hedef artık
// gerçek Warehouses kayıtlarına bağlı (serbest metin değil) - barkod-
// okuyucu ERP'sindeki İç Lojistik modülünün özelleşmiş hali.
export default function WarehouseTransfersDashboard({ warehouses = [] }) {
  const { transfers, loading, error, addTransfer, updateOne, removeTransfer } = useWarehouseTransfers();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastHit, setLastHit] = useState(null);
  // Tarih/miktar filtreleri veri girişi formundan AYRI - sonuç tablosunun
  // üstünde, arama kutusunun yanında duruyor.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [miktarMin, setMiktarMin] = useState("");
  const [miktarMax, setMiktarMax] = useState("");
  const hasActiveFilters = Boolean(dateFrom || dateTo || miktarMin || miktarMax);
  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setMiktarMin("");
    setMiktarMax("");
  }

  const [liveRef, setLiveRef] = useState(null);
  const [liveRecord, setLiveRecord] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [liveHedef, setLiveHedef] = useState("");

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

  async function handleLiveHedefSave() {
    if (!liveRecord || !liveHedef) return;
    await updateOne(liveRecord.id, { hedefDepoId: liveHedef });
    setLiveRecord((r) => (r ? { ...r, hedefDepoId: liveHedef } : r));
  }

  const handleQrDetect = useCallback((code) => {
    setLastHit({ code, ts: Date.now() });

    const ref = parseRouteRef(code);
    if (ref) {
      setLiveRef(ref);
      setLiveRecord(null);
      if (ref.tur !== "transfer") {
        setLiveError("Bu QR bir Sevkiyat'a ait - Sevkiyat ekranından okutun.");
        setLiveLoading(false);
        return;
      }
      setLiveError(null);
      setLiveLoading(true);
      fetchWarehouseTransfer(ref.id)
        .then((t) => {
          setLiveRecord(t);
          setLiveHedef(t.hedefDepoId || "");
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

  const warehouseLabel = useMemo(() => {
    const byId = new Map(warehouses.map((w) => [w.id, w.ad]));
    return (id) => (id ? byId.get(id) || "-" : "-");
  }, [warehouses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = miktarMin === "" ? null : Number(miktarMin);
    const max = miktarMax === "" ? null : Number(miktarMax);
    return transfers.filter((t) => {
      if (q) {
        const matches = [t.urunAdi, t.barkod, warehouseLabel(t.kaynakDepoId), warehouseLabel(t.hedefDepoId)].some(
          (v) => v?.toLowerCase().includes(q)
        );
        if (!matches) return false;
      }
      if (dateFrom && (!t.tarih || t.tarih < dateFrom)) return false;
      if (dateTo && (!t.tarih || t.tarih > dateTo)) return false;
      if (min != null && (t.miktar == null || t.miktar < min)) return false;
      if (max != null && (t.miktar == null || t.miktar > max)) return false;
      return true;
    });
  }, [transfers, query, warehouseLabel, dateFrom, dateTo, miktarMin, miktarMax]);

  const groups = useMemo(() => groupByDate(filtered, (t) => t.tarih), [filtered]);

  const stats = useMemo(() => {
    const planlanan = transfers.filter((t) => t.durum === "planlandi").length;
    const bugun = transfers.filter((t) => t.tarih === todayISO()).length;
    return { planlanan, bugun };
  }, [transfers]);

  function startEdit(t) {
    setEditingId(t.id);
    setForm(toFormShape(t));
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, tarih: form.tarih });
    setSubmitError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const urunAdi = form.urunAdi.trim();
    if (!urunAdi) {
      setSubmitError("Ürün adı zorunlu.");
      return;
    }
    if (!form.kaynakDepoId || !form.hedefDepoId) {
      setSubmitError("Kaynak ve hedef depo zorunlu.");
      return;
    }
    if (form.kaynakDepoId === form.hedefDepoId) {
      setSubmitError("Kaynak ve hedef depo aynı olamaz.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const fields = {
      barkod: form.barkod.trim(),
      urunAdi,
      miktar: form.miktar === "" ? null : Number(form.miktar),
      birim: form.birim.trim(),
      kaynakDepoId: form.kaynakDepoId,
      hedefDepoId: form.hedefDepoId,
      tarih: form.tarih,
      durum: form.durum,
      notMetni: form.notMetni.trim(),
    };
    try {
      if (editingId) {
        await updateOne(editingId, fields);
        setEditingId(null);
      } else {
        await addTransfer(fields);
      }
      setForm({ ...EMPTY_FORM, tarih: form.tarih });
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
          <ArrowRightLeft size={18} />
          <div>
            <div className="stat-value">{stats.planlanan}</div>
            <div className="stat-label">Planlanan Transfer</div>
          </div>
        </div>
        <div className="stat-card">
          <PackageCheck size={18} />
          <div>
            <div className="stat-value">{stats.bugun}</div>
            <div className="stat-label">Bugün</div>
          </div>
        </div>
      </div>

      <p className="dashboard-hint">
        Depolarımız arası ürün hareketleri - müşteri/tedarikçiye giden sevkiyatlar için "Sevkiyat" sekmesini kullanın.
      </p>

      <div className="qr-scan-toggle-row">
        <button
          type="button"
          className={`icon-btn labeled ${scannerOpen ? "active" : ""}`}
          onClick={() => setScannerOpen((v) => !v)}
        >
          <QrCode size={16} />
          {scannerOpen ? "Taramayı Kapat" : "QR ile Transfer Doldur"}
        </button>
      </div>

      {scannerOpen && (
        <CameraPanel camera={camera} cameraOn={scannerOpen} onToggleCamera={() => setScannerOpen(false)} scanMode="qr" lastHit={lastHit} />
      )}

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="wt-barkod">Barkod</label>
          <input id="wt-barkod" type="text" value={form.barkod} onChange={(e) => updateField("barkod", e.target.value)} placeholder="Taranan kod ya da elle girin" />
        </div>

        <div className="field">
          <label htmlFor="wt-urun">Ürün Adı *</label>
          <input id="wt-urun" type="text" value={form.urunAdi} onChange={(e) => updateField("urunAdi", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="wt-miktar">Miktar</label>
          <input id="wt-miktar" type="number" inputMode="decimal" step="0.01" value={form.miktar} onChange={(e) => updateField("miktar", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="wt-birim">Birim</label>
          <input id="wt-birim" type="text" placeholder="adet / kg / palet..." value={form.birim} onChange={(e) => updateField("birim", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="wt-kaynak">Kaynak Depo *</label>
          <select id="wt-kaynak" value={form.kaynakDepoId} onChange={(e) => updateField("kaynakDepoId", e.target.value)} required>
            <option value="">— Seçin —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="wt-hedef">Hedef Depo *</label>
          <select id="wt-hedef" value={form.hedefDepoId} onChange={(e) => updateField("hedefDepoId", e.target.value)} required>
            <option value="">— Seçin —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="wt-tarih">Tarih</label>
          <DatePicker id="wt-tarih" value={form.tarih} onChange={(v) => updateField("tarih", v)} />
        </div>

        <div className="field">
          <label htmlFor="wt-durum">Durum</label>
          <select id="wt-durum" value={form.durum} onChange={(e) => updateField("durum", e.target.value)}>
            {DURUM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-wide">
          <label htmlFor="wt-not">Not</label>
          <input id="wt-not" type="text" value={form.notMetni} onChange={(e) => updateField("notMetni", e.target.value)} />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {submitting ? "Kaydediliyor…" : editingId ? "Güncelle" : "Transfer Ekle"}
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
          <input type="text" placeholder="Ürün, barkod ya da depoda ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="filter-row">
          <div className="filter-field">
            <label htmlFor="wt-filter-from">Tarih (başlangıç)</label>
            <DatePicker id="wt-filter-from" value={dateFrom} onChange={setDateFrom} allowClear />
          </div>
          <div className="filter-field">
            <label htmlFor="wt-filter-to">Tarih (bitiş)</label>
            <DatePicker id="wt-filter-to" value={dateTo} onChange={setDateTo} allowClear />
          </div>
          <div className="filter-field">
            <label htmlFor="wt-filter-min">Miktar (en az)</label>
            <input id="wt-filter-min" type="number" inputMode="decimal" value={miktarMin} onChange={(e) => setMiktarMin(e.target.value)} />
          </div>
          <div className="filter-field">
            <label htmlFor="wt-filter-max">Miktar (en çok)</label>
            <input id="wt-filter-max" type="number" inputMode="decimal" value={miktarMax} onChange={(e) => setMiktarMax(e.target.value)} />
          </div>
          {hasActiveFilters && (
            <button type="button" className="icon-btn" onClick={clearFilters}>
              <X size={14} /> Filtreleri Temizle
            </button>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">
            {transfers.length === 0 ? "Henüz transfer kaydı yok." : "Aramayla/filtreyle eşleşen kayıt yok."}
          </p>
        ) : (
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Miktar</th>
                  <th>Kaynak → Hedef</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="date-divider">
                      <td colSpan={5}>{g.label}</td>
                    </tr>
                    {g.items.map((t) => (
                      <tr key={t.id} className={editingId === t.id ? "editing-row" : ""}>
                        <td>
                          {t.urunAdi}
                          {t.barkod && <div className="muted code-cell">{t.barkod}</div>}
                        </td>
                        <td className="muted">{t.miktar != null ? `${t.miktar} ${t.birim || ""}`.trim() : "-"}</td>
                        <td className="muted">
                          {warehouseLabel(t.kaynakDepoId)} → {warehouseLabel(t.hedefDepoId)}
                        </td>
                        <td>
                          <select
                            className={`status-badge ${DURUM_BADGE_CLASS[t.durum]}`}
                            value={t.durum}
                            onChange={(e) => updateOne(t.id, { durum: e.target.value })}
                          >
                            {DURUM_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="row-actions">
                          <button className="icon-btn" onClick={() => startEdit(t)} aria-label="Düzenle" title="Düzenle">
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => {
                              if (window.confirm(`${t.urunAdi} transferi silinsin mi? Bu geri alınamaz.`)) removeTransfer(t.id);
                            }}
                            aria-label="Sil"
                            title="Sil"
                          >
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
        <Modal title="Depo Transferi - Canlı Bilgi" onClose={closeLiveCard}>
          {liveLoading ? (
            <p className="empty-state">Yükleniyor…</p>
          ) : liveError ? (
            <p className="form-error">{liveError}</p>
          ) : liveRecord ? (
            <>
              <dl className="live-card-fields">
                <div className="live-card-row">
                  <dt>Ürün</dt>
                  <dd>{liveRecord.urunAdi}</dd>
                </div>
                <div className="live-card-row">
                  <dt>Miktar</dt>
                  <dd>{liveRecord.miktar != null ? `${liveRecord.miktar} ${liveRecord.birim || ""}`.trim() : "-"}</dd>
                </div>
                <div className="live-card-row">
                  <dt>Kaynak Depo</dt>
                  <dd>{warehouseLabel(liveRecord.kaynakDepoId)}</dd>
                </div>
                <div className="live-card-row">
                  <dt>Tarih</dt>
                  <dd>{trDate(liveRecord.tarih) || "-"}</dd>
                </div>
              </dl>

              <div className="field">
                <label htmlFor="wt-live-durum">Durum</label>
                <select
                  id="wt-live-durum"
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
                <label htmlFor="wt-live-hedef">Hedef Depo</label>
                <div className="live-card-location-edit">
                  <select id="wt-live-hedef" value={liveHedef} onChange={(e) => setLiveHedef(e.target.value)}>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.ad}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="icon-btn" onClick={handleLiveHedefSave} title="Kaydet">
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
