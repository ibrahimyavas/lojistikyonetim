import { useMemo, useState } from "react";
import { Users, Plus, Pencil, Trash2, X, Search, KeyRound } from "lucide-react";

const EMPTY_FORM = { ad: "", kod: "", telefon: "", pin: "", notMetni: "" };

function toFormShape(d) {
  return { ad: d.ad || "", kod: d.kod || "", telefon: d.telefon || "", pin: "", notMetni: d.notMetni || "" };
}

// Sürücü kaydı = Android app'e giriş kimliği (kod + PIN, bkz.
// worker/driverAuth.js) + araç atama listelerinde (VehiclesDashboard)
// seçenek olarak kullanılan kayıt. PIN sadece OLUŞTURURKEN zorunlu -
// düzenlerken boş bırakılırsa mevcut PIN değişmez (worker bu alanı hiç
// göndermeyiz). `drivers` App.jsx'te tek yerden çekiliyor (bkz. useDrivers
// orada) - VehiclesDashboard'un atama seçicisi de aynı listeyi kullanıyor.
export default function DriversDashboard({ drivers, loading, error, addDriver, editDriver, removeDriver }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState("");

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(d) {
    setEditingId(d.id);
    setForm(toFormShape(d));
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSubmitError(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => [d.ad, d.kod, d.telefon].some((v) => v?.toLowerCase().includes(q)));
  }, [drivers, query]);

  async function handleSubmit(e) {
    e.preventDefault();
    const ad = form.ad.trim();
    const kod = form.kod.trim();
    if (!ad) return setSubmitError("Ad zorunlu.");
    if (!kod) return setSubmitError("Kod zorunlu.");
    if (!editingId && form.pin.trim().length < 4) return setSubmitError("PIN en az 4 karakter olmalı.");
    if (form.pin && form.pin.trim().length < 4) return setSubmitError("PIN en az 4 karakter olmalı.");

    setSubmitting(true);
    setSubmitError(null);
    const fields = { ad, kod, telefon: form.telefon.trim(), notMetni: form.notMetni.trim() };
    if (form.pin.trim()) fields.pin = form.pin.trim();
    try {
      if (editingId) {
        await editDriver(editingId, fields);
        setEditingId(null);
      } else {
        await addDriver({ ...fields, pin: form.pin.trim() });
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
          <Users size={18} />
          <div>
            <div className="stat-value">{drivers.length}</div>
            <div className="stat-label">Sürücü</div>
          </div>
        </div>
      </div>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="drv-ad">Ad *</label>
          <input id="drv-ad" type="text" value={form.ad} onChange={(e) => updateField("ad", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="drv-kod">
            <KeyRound size={14} /> Kod *
          </label>
          <input
            id="drv-kod"
            type="text"
            value={form.kod}
            onChange={(e) => updateField("kod", e.target.value)}
            placeholder="Android app girişinde kullanılır"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="drv-telefon">Telefon</label>
          <input id="drv-telefon" type="text" value={form.telefon} onChange={(e) => updateField("telefon", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="drv-pin">PIN {editingId ? "(değiştirmek için doldur)" : "*"}</label>
          <input
            id="drv-pin"
            type="text"
            inputMode="numeric"
            value={form.pin}
            onChange={(e) => updateField("pin", e.target.value)}
            placeholder={editingId ? "Boş bırak = değişmesin" : "En az 4 karakter"}
          />
        </div>

        <div className="field field-wide">
          <label htmlFor="drv-not">Not</label>
          <input id="drv-not" type="text" value={form.notMetni} onChange={(e) => updateField("notMetni", e.target.value)} />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {submitting ? "Kaydediliyor…" : editingId ? "Güncelle" : "Sürücü Ekle"}
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
          <input type="text" placeholder="Ad, kod ya da telefonda ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">{drivers.length === 0 ? "Henüz sürücü kaydı yok." : "Aramayla eşleşen kayıt yok."}</p>
        ) : (
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Kod</th>
                  <th>Telefon</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className={editingId === d.id ? "editing-row" : ""}>
                    <td>{d.ad}</td>
                    <td className="code-cell">{d.kod}</td>
                    <td className="muted">{d.telefon || "-"}</td>
                    <td>
                      <button
                        type="button"
                        className={`status-badge ${d.aktif ? "status-good" : "status-muted"}`}
                        onClick={() => editDriver(d.id, { aktif: !d.aktif })}
                        title="Aktif/pasif değiştir"
                      >
                        {d.aktif ? "Aktif" : "Pasif"}
                      </button>
                    </td>
                    <td className="row-actions">
                      <button className="icon-btn" onClick={() => startEdit(d)} aria-label="Düzenle" title="Düzenle">
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => {
                          if (window.confirm(`${d.ad} silinsin mi? Bu geri alınamaz.`)) removeDriver(d.id);
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
