import { useMemo, useState } from "react";
import { UserCog, Plus, Pencil, Trash2, X, Search, KeyRound } from "lucide-react";
import { useUsers } from "../hooks/useUsers.js";

const EMPTY_FORM = { ad: "", kullaniciAdi: "", sifre: "", rol: "operator" };

const ROL_OPTIONS = [
  { value: "yonetici", label: "Yönetici" },
  { value: "operator", label: "Operatör" },
];

function toFormShape(u) {
  return { ad: u.ad || "", kullaniciAdi: u.kullaniciAdi || "", sifre: "", rol: u.rol || "operator" };
}

// Web paneli kullanıcıları (Yönetici/Operatör) - Şoför rolü burada YOK,
// ayrı bir kullanıcı kaydı değil, Sürücüler ekranındaki kod+PIN aynen web
// girişi için de geçerli (bkz. worker/auth.js). Bu ekran sadece Yönetici'ye
// görünür (App.jsx TABS filtresi) ve backend'de de Yönetici-only
// (worker/index.js ROUTE_GROUPS) - çift katmanlı koruma.
export default function UsersDashboard() {
  const { users, loading, error, addUser, editUser, removeUser } = useUsers();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState("");

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(u) {
    setEditingId(u.id);
    setForm(toFormShape(u));
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSubmitError(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.ad, u.kullaniciAdi].some((v) => v?.toLowerCase().includes(q)));
  }, [users, query]);

  async function handleSubmit(e) {
    e.preventDefault();
    const ad = form.ad.trim();
    const kullaniciAdi = form.kullaniciAdi.trim();
    if (!ad) return setSubmitError("Ad zorunlu.");
    if (!kullaniciAdi) return setSubmitError("Kullanıcı adı zorunlu.");
    if (!editingId && form.sifre.trim().length < 4) return setSubmitError("Şifre en az 4 karakter olmalı.");
    if (form.sifre && form.sifre.trim().length < 4) return setSubmitError("Şifre en az 4 karakter olmalı.");

    setSubmitting(true);
    setSubmitError(null);
    const fields = { ad, kullaniciAdi, rol: form.rol };
    if (form.sifre.trim()) fields.sifre = form.sifre.trim();
    try {
      if (editingId) {
        await editUser(editingId, fields);
        setEditingId(null);
      } else {
        await addUser({ ...fields, sifre: form.sifre.trim() });
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
          <UserCog size={18} />
          <div>
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Kullanıcı</div>
          </div>
        </div>
      </div>

      <p className="dashboard-hint">
        Şoför rolü burada yok - Sürücüler ekranındaki kod+PIN aynı zamanda web paneline giriş için de geçerli.
      </p>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="us-ad">Ad *</label>
          <input id="us-ad" type="text" value={form.ad} onChange={(e) => updateField("ad", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="us-kullaniciadi">
            <KeyRound size={14} /> Kullanıcı Adı *
          </label>
          <input id="us-kullaniciadi" type="text" value={form.kullaniciAdi} onChange={(e) => updateField("kullaniciAdi", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="us-rol">Rol</label>
          <select id="us-rol" value={form.rol} onChange={(e) => updateField("rol", e.target.value)}>
            {ROL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="us-sifre">Şifre {editingId ? "(değiştirmek için doldur)" : "*"}</label>
          <input
            id="us-sifre"
            type="text"
            value={form.sifre}
            onChange={(e) => updateField("sifre", e.target.value)}
            placeholder={editingId ? "Boş bırak = değişmesin" : "En az 4 karakter"}
          />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {submitting ? "Kaydediliyor…" : editingId ? "Güncelle" : "Kullanıcı Ekle"}
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
          <input type="text" placeholder="Ad ya da kullanıcı adında ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">{users.length === 0 ? "Henüz kullanıcı yok." : "Aramayla eşleşen kayıt yok."}</p>
        ) : (
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Kullanıcı Adı</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className={editingId === u.id ? "editing-row" : ""}>
                    <td>{u.ad}</td>
                    <td className="code-cell">{u.kullaniciAdi}</td>
                    <td className="muted">{ROL_OPTIONS.find((o) => o.value === u.rol)?.label || u.rol}</td>
                    <td>
                      <button
                        type="button"
                        className={`status-badge ${u.aktif ? "status-good" : "status-muted"}`}
                        onClick={() => editUser(u.id, { aktif: !u.aktif })}
                        title="Aktif/pasif değiştir"
                      >
                        {u.aktif ? "Aktif" : "Pasif"}
                      </button>
                    </td>
                    <td className="row-actions">
                      <button className="icon-btn" onClick={() => startEdit(u)} aria-label="Düzenle" title="Düzenle">
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => {
                          if (window.confirm(`${u.ad} silinsin mi? Bu geri alınamaz.`)) removeUser(u.id);
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
