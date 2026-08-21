import { useMemo, useState } from "react";
import { Package, Plus, Pencil, Trash2, X, Search } from "lucide-react";

const EMPTY_FORM = {
  ad: "",
  birim: "",
  paletBasinaAdet: "",
  paletUzunlukCm: "",
  paletGenislikCm: "",
  paletYukseklikCm: "",
  paletAgirlikKg: "",
  notMetni: "",
};

function toFormShape(p) {
  return {
    ad: p.ad || "",
    birim: p.birim || "",
    paletBasinaAdet: p.paletBasinaAdet ?? "",
    paletUzunlukCm: p.paletUzunlukCm ?? "",
    paletGenislikCm: p.paletGenislikCm ?? "",
    paletYukseklikCm: p.paletYukseklikCm ?? "",
    paletAgirlikKg: p.paletAgirlikKg ?? "",
    notMetni: p.notMetni || "",
  };
}

// Ürün kataloğu: "bu üründen bir palete kaç tane sığar" ve "palet ne kadar
// büyük/ağır" burada BİR KEZ tanımlanır. Paletler ekranında ürün adı
// girildiğinde (aynı isimle eşleşirse) miktar ve palet boyutu buradan
// otomatik önerilir - suggestZoneForProduct'taki "bir kere tanımla, her
// yerde otomatik kullan" felsefesiyle aynı. Palet boyutları 3D yükleme
// ekranının ileride gerçek ölçülerle çalışması için temel oluşturuyor.
export default function ProductsDashboard({ products, loading, error, addProduct, editProduct, removeProduct }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState("");

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm(toFormShape(p));
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSubmitError(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => [p.ad, p.birim].some((v) => v?.toLowerCase().includes(q)));
  }, [products, query]);

  async function handleSubmit(e) {
    e.preventDefault();
    const ad = form.ad.trim();
    if (!ad) return setSubmitError("Ürün adı zorunlu.");

    setSubmitting(true);
    setSubmitError(null);
    const fields = {
      ad,
      birim: form.birim.trim(),
      paletBasinaAdet: form.paletBasinaAdet === "" ? null : Number(form.paletBasinaAdet),
      paletUzunlukCm: form.paletUzunlukCm === "" ? null : Number(form.paletUzunlukCm),
      paletGenislikCm: form.paletGenislikCm === "" ? null : Number(form.paletGenislikCm),
      paletYukseklikCm: form.paletYukseklikCm === "" ? null : Number(form.paletYukseklikCm),
      paletAgirlikKg: form.paletAgirlikKg === "" ? null : Number(form.paletAgirlikKg),
      notMetni: form.notMetni.trim(),
    };
    try {
      if (editingId) {
        await editProduct(editingId, fields);
        setEditingId(null);
      } else {
        await addProduct(fields);
      }
      setForm(EMPTY_FORM);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function paletOlcusu(p) {
    if (!p.paletUzunlukCm && !p.paletGenislikCm && !p.paletYukseklikCm) return "-";
    return `${p.paletUzunlukCm ?? "?"} × ${p.paletGenislikCm ?? "?"} × ${p.paletYukseklikCm ?? "?"} cm`;
  }

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card">
          <Package size={18} />
          <div>
            <div className="stat-value">{products.length}</div>
            <div className="stat-label">Tanımlı Ürün</div>
          </div>
        </div>
      </div>

      <p className="dashboard-hint">
        Bir ürünü burada tanımlayıp palet başına adedini ve palet boyutunu girerseniz, "Paletler" ekranında o ürün
        adı yazıldığında miktar ve boyutlar otomatik önerilir.
      </p>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="pr-ad">Ürün Adı *</label>
          <input id="pr-ad" type="text" value={form.ad} onChange={(e) => updateField("ad", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="pr-birim">Birim</label>
          <input id="pr-birim" type="text" placeholder="adet / kg / koli..." value={form.birim} onChange={(e) => updateField("birim", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="pr-palet-adet">Palet Başına Adet</label>
          <input
            id="pr-palet-adet"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.paletBasinaAdet}
            onChange={(e) => updateField("paletBasinaAdet", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="pr-uzunluk">Palet Uzunluk (cm)</label>
          <input id="pr-uzunluk" type="number" inputMode="decimal" step="0.1" min="0" value={form.paletUzunlukCm} onChange={(e) => updateField("paletUzunlukCm", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="pr-genislik">Palet Genişlik (cm)</label>
          <input id="pr-genislik" type="number" inputMode="decimal" step="0.1" min="0" value={form.paletGenislikCm} onChange={(e) => updateField("paletGenislikCm", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="pr-yukseklik">Palet Yükseklik (cm)</label>
          <input id="pr-yukseklik" type="number" inputMode="decimal" step="0.1" min="0" value={form.paletYukseklikCm} onChange={(e) => updateField("paletYukseklikCm", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="pr-agirlik">Palet Ağırlık (kg)</label>
          <input id="pr-agirlik" type="number" inputMode="decimal" step="0.1" min="0" value={form.paletAgirlikKg} onChange={(e) => updateField("paletAgirlikKg", e.target.value)} />
        </div>

        <div className="field field-wide">
          <label htmlFor="pr-not">Not</label>
          <input id="pr-not" type="text" value={form.notMetni} onChange={(e) => updateField("notMetni", e.target.value)} />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {submitting ? "Kaydediliyor…" : editingId ? "Güncelle" : "Ürün Ekle"}
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
          <input type="text" placeholder="Ürün adı ya da birimde ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">{products.length === 0 ? "Henüz ürün tanımı yok." : "Aramayla eşleşen kayıt yok."}</p>
        ) : (
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Palet Başına</th>
                  <th>Palet Boyutu</th>
                  <th>Ağırlık</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={editingId === p.id ? "editing-row" : ""}>
                    <td>
                      {p.ad}
                      {p.birim && <div className="muted">{p.birim}</div>}
                    </td>
                    <td className="muted">{p.paletBasinaAdet != null ? `${p.paletBasinaAdet} ${p.birim || ""}`.trim() : "-"}</td>
                    <td className="muted">{paletOlcusu(p)}</td>
                    <td className="muted">{p.paletAgirlikKg != null ? `${p.paletAgirlikKg} kg` : "-"}</td>
                    <td className="row-actions">
                      <button className="icon-btn" onClick={() => startEdit(p)} aria-label="Düzenle" title="Düzenle">
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => {
                          if (window.confirm(`${p.ad} silinsin mi? Geçmiş palet kayıtları etkilenmez, sadece otomatik öneri durur.`)) removeProduct(p.id);
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
