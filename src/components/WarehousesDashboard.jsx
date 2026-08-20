import { useMemo, useState } from "react";
import { Warehouse, Plus, Pencil, Trash2, X, Search } from "lucide-react";

const EMPTY_FORM = { ad: "", konum: "", kapasite: "", notMetni: "" };

function toFormShape(w) {
  return { ad: w.ad || "", konum: w.konum || "", kapasite: w.kapasite ?? "", notMetni: w.notMetni || "" };
}

// `warehouses` App.jsx'te tek yerden çekiliyor (bkz. useWarehouses orada) -
// Sevkiyat/Depo Transferleri/Paletler/Depo Bölümleri ekranlarının hepsi
// aynı listeyi kullanıyor; burada ayrıca bir hook çağrılmıyor ki bir
// düzenleme diğer ekranlarda da anında görünsün.
export default function WarehousesDashboard({ warehouses, loading, error, addWarehouse, editWarehouse, removeWarehouse }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState("");

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(w) {
    setEditingId(w.id);
    setForm(toFormShape(w));
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSubmitError(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter((w) => [w.ad, w.konum].some((v) => v?.toLowerCase().includes(q)));
  }, [warehouses, query]);

  async function handleSubmit(e) {
    e.preventDefault();
    const ad = form.ad.trim();
    if (!ad) return setSubmitError("Ad zorunlu.");

    setSubmitting(true);
    setSubmitError(null);
    const fields = {
      ad,
      konum: form.konum.trim(),
      kapasite: form.kapasite === "" ? null : Number(form.kapasite),
      notMetni: form.notMetni.trim(),
    };
    try {
      if (editingId) {
        await editWarehouse(editingId, fields);
        setEditingId(null);
      } else {
        await addWarehouse(fields);
      }
      setForm(EMPTY_FORM);
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
          <Warehouse size={18} />
          <div>
            <div className="stat-value">{warehouses.length}</div>
            <div className="stat-label">Depo</div>
          </div>
        </div>
      </div>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="wh-ad">Ad *</label>
          <input id="wh-ad" type="text" value={form.ad} onChange={(e) => updateField("ad", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="wh-konum">Konum</label>
          <input id="wh-konum" type="text" value={form.konum} onChange={(e) => updateField("konum", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="wh-kapasite">Kapasite (opsiyonel)</label>
          <input
            id="wh-kapasite"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.kapasite}
            onChange={(e) => updateField("kapasite", e.target.value)}
          />
        </div>

        <div className="field field-wide">
          <label htmlFor="wh-not">Not</label>
          <input id="wh-not" type="text" value={form.notMetni} onChange={(e) => updateField("notMetni", e.target.value)} />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {submitting ? "Kaydediliyor…" : editingId ? "Güncelle" : "Depo Ekle"}
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
          <input type="text" placeholder="Ad ya da konumda ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">{warehouses.length === 0 ? "Henüz depo kaydı yok." : "Aramayla eşleşen kayıt yok."}</p>
        ) : (
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Konum</th>
                  <th>Kapasite</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} className={editingId === w.id ? "editing-row" : ""}>
                    <td>{w.ad}</td>
                    <td className="muted">{w.konum || "-"}</td>
                    <td className="muted">{w.kapasite ?? "-"}</td>
                    <td className="row-actions">
                      <button className="icon-btn" onClick={() => startEdit(w)} aria-label="Düzenle" title="Düzenle">
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => {
                          if (window.confirm(`${w.ad} silinsin mi? Bağlı depo bölümleri de silinir. Bu geri alınamaz.`)) removeWarehouse(w.id);
                        }}
                        aria-label="Sil"
                        title="Sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
