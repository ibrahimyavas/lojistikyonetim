import { useMemo, useState } from "react";
import { Truck, Plus, Pencil, Trash2, X, Search } from "lucide-react";
import { useVehicles } from "../hooks/useVehicles.js";

const EMPTY_FORM = { plaka: "", markaModel: "", durum: "aktif", surucuId: "", notMetni: "" };

const DURUM_OPTIONS = [
  { value: "aktif", label: "Aktif" },
  { value: "bakimda", label: "Bakımda" },
  { value: "pasif", label: "Pasif" },
];
const DURUM_BADGE_CLASS = { aktif: "status-good", bakimda: "status-warning", pasif: "status-muted" };

function toFormShape(v) {
  return {
    plaka: v.plaka || "",
    markaModel: v.markaModel || "",
    durum: v.durum || "aktif",
    surucuId: v.surucuId || "",
    notMetni: v.notMetni || "",
  };
}

export default function VehiclesDashboard({ drivers = [] }) {
  const { vehicles, loading, error, addVehicle, editVehicle, removeVehicle } = useVehicles();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState("");

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(v) {
    setEditingId(v.id);
    setForm(toFormShape(v));
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSubmitError(null);
  }

  const driverName = useMemo(() => {
    const byId = new Map(drivers.map((d) => [d.id, d.ad]));
    return (id) => (id ? byId.get(id) || "-" : "-");
  }, [drivers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => [v.plaka, v.markaModel].some((val) => val?.toLowerCase().includes(q)));
  }, [vehicles, query]);

  async function handleSubmit(e) {
    e.preventDefault();
    const plaka = form.plaka.trim();
    if (!plaka) return setSubmitError("Plaka zorunlu.");

    setSubmitting(true);
    setSubmitError(null);
    const fields = {
      plaka,
      markaModel: form.markaModel.trim(),
      durum: form.durum,
      surucuId: form.surucuId || null,
      notMetni: form.notMetni.trim(),
    };
    try {
      if (editingId) {
        await editVehicle(editingId, fields);
        setEditingId(null);
      } else {
        await addVehicle(fields);
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
          <Truck size={18} />
          <div>
            <div className="stat-value">{vehicles.length}</div>
            <div className="stat-label">Araç</div>
          </div>
        </div>
      </div>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="veh-plaka">Plaka *</label>
          <input id="veh-plaka" type="text" value={form.plaka} onChange={(e) => updateField("plaka", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="veh-model">Marka / Model</label>
          <input id="veh-model" type="text" value={form.markaModel} onChange={(e) => updateField("markaModel", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="veh-surucu">Sürücü (opsiyonel)</label>
          <select id="veh-surucu" value={form.surucuId} onChange={(e) => updateField("surucuId", e.target.value)}>
            <option value="">— Atanmamış —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="veh-durum">Durum</label>
          <select id="veh-durum" value={form.durum} onChange={(e) => updateField("durum", e.target.value)}>
            {DURUM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-wide">
          <label htmlFor="veh-not">Not</label>
          <input id="veh-not" type="text" value={form.notMetni} onChange={(e) => updateField("notMetni", e.target.value)} />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {submitting ? "Kaydediliyor…" : editingId ? "Güncelle" : "Araç Ekle"}
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
          <input type="text" placeholder="Plaka ya da modelde ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">{vehicles.length === 0 ? "Henüz araç kaydı yok." : "Aramayla eşleşen kayıt yok."}</p>
        ) : (
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Plaka</th>
                  <th>Marka / Model</th>
                  <th>Sürücü</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className={editingId === v.id ? "editing-row" : ""}>
                    <td className="code-cell">{v.plaka}</td>
                    <td className="muted">{v.markaModel || "-"}</td>
                    <td className="muted">{driverName(v.surucuId)}</td>
                    <td>
                      <select
                        className={`status-badge ${DURUM_BADGE_CLASS[v.durum]}`}
                        value={v.durum}
                        onChange={(e) => editVehicle(v.id, { durum: e.target.value })}
                      >
                        {DURUM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="row-actions">
                      <button className="icon-btn" onClick={() => startEdit(v)} aria-label="Düzenle" title="Düzenle">
                        <Pencil size={15} />
                      </button>
                      <button className="icon-btn danger" onClick={() => removeVehicle(v.id)} aria-label="Sil" title="Sil">
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
