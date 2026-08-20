import { useMemo, useState } from "react";
import { LayoutGrid, Plus, Pencil, Trash2, X, Search } from "lucide-react";

const EMPTY_FORM = { warehouseId: "", kod: "", ad: "", kapasite: "", notMetni: "" };

function toFormShape(z) {
  return {
    warehouseId: z.warehouseId || "",
    kod: z.kod || "",
    ad: z.ad || "",
    kapasite: z.kapasite ?? "",
    notMetni: z.notMetni || "",
  };
}

// Depo bölümü/rafı/alanı tanımı - kapasite ve doluluk (bkz.
// worker/warehouseZones.js, Paletler'den CANLI hesaplanıyor) burada
// izleniyor. Palet yerleştirme/çıkarma işlemleri "Paletler" ekranında.
// `zones` App.jsx'te tek yerden çekiliyor - Paletler ekranı da aynı listeyi
// kullanıyor.
export default function WarehouseZonesDashboard({ warehouses = [], zones, loading, error, addZone, editZone, removeZone }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState("");

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(z) {
    setEditingId(z.id);
    setForm(toFormShape(z));
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSubmitError(null);
  }

  const warehouseName = useMemo(() => {
    const byId = new Map(warehouses.map((w) => [w.id, w.ad]));
    return (id) => byId.get(id) || "-";
  }, [warehouses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => [z.kod, z.ad, warehouseName(z.warehouseId)].some((v) => v?.toLowerCase().includes(q)));
  }, [zones, query, warehouseName]);

  async function handleSubmit(e) {
    e.preventDefault();
    const kod = form.kod.trim();
    if (!form.warehouseId) return setSubmitError("Depo zorunlu.");
    if (!kod) return setSubmitError("Bölüm kodu zorunlu.");

    setSubmitting(true);
    setSubmitError(null);
    const fields = {
      warehouseId: form.warehouseId,
      kod,
      ad: form.ad.trim(),
      kapasite: form.kapasite === "" ? null : Number(form.kapasite),
      notMetni: form.notMetni.trim(),
    };
    try {
      if (editingId) {
        await editZone(editingId, fields);
        setEditingId(null);
      } else {
        await addZone(fields);
      }
      setForm({ ...EMPTY_FORM, warehouseId: form.warehouseId });
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
          <LayoutGrid size={18} />
          <div>
            <div className="stat-value">{zones.length}</div>
            <div className="stat-label">Depo Bölümü</div>
          </div>
        </div>
      </div>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="wz-depo">Depo *</label>
          <select id="wz-depo" value={form.warehouseId} onChange={(e) => updateField("warehouseId", e.target.value)} required>
            <option value="">— Seçin —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="wz-kod">Bölüm Kodu *</label>
          <input id="wz-kod" type="text" placeholder="ör. A-01" value={form.kod} onChange={(e) => updateField("kod", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="wz-ad">Ad</label>
          <input id="wz-ad" type="text" value={form.ad} onChange={(e) => updateField("ad", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="wz-kapasite">Kapasite - kaç palet sığar (opsiyonel)</label>
          <input
            id="wz-kapasite"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={form.kapasite}
            onChange={(e) => updateField("kapasite", e.target.value)}
          />
        </div>

        <div className="field field-wide">
          <label htmlFor="wz-not">Not</label>
          <input id="wz-not" type="text" value={form.notMetni} onChange={(e) => updateField("notMetni", e.target.value)} />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {submitting ? "Kaydediliyor…" : editingId ? "Güncelle" : "Bölüm Ekle"}
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
          <input type="text" placeholder="Kod, ad ya da depoda ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">{zones.length === 0 ? "Henüz depo bölümü yok." : "Aramayla eşleşen kayıt yok."}</p>
        ) : (
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Depo</th>
                  <th>Bölüm</th>
                  <th>Doluluk</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((z) => {
                  const pct = z.kapasite ? Math.min(100, Math.round((z.doluluk / z.kapasite) * 100)) : null;
                  return (
                    <tr key={z.id} className={editingId === z.id ? "editing-row" : ""}>
                      <td className="muted">{warehouseName(z.warehouseId)}</td>
                      <td>
                        {z.kod}
                        {z.ad && <div className="muted">{z.ad}</div>}
                      </td>
                      <td>
                        {z.kapasite ? (
                          <div className="capacity-cell">
                            <div className="capacity-bar">
                              <div
                                className={`capacity-bar-fill ${pct >= 90 ? "capacity-bar-full" : ""}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="muted">
                              {z.doluluk} / {z.kapasite} palet (%{pct})
                            </span>
                          </div>
                        ) : (
                          <span className="muted">{z.doluluk} palet (kapasite belirtilmedi)</span>
                        )}
                      </td>
                      <td className="row-actions">
                        <button className="icon-btn" onClick={() => startEdit(z)} aria-label="Düzenle" title="Düzenle">
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => {
                            if (window.confirm(`${z.kod} bölümü silinsin mi? Bu geri alınamaz.`)) removeZone(z.id);
                          }}
                          aria-label="Sil"
                          title="Sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
