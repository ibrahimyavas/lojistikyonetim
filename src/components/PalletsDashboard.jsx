import { useEffect, useMemo, useState } from "react";
import { Boxes, Plus, Trash2, Search, LogOut, History, ArrowRightLeft, X, Sparkles } from "lucide-react";
import { usePallets } from "../hooks/usePallets.js";
import { todayISO, trDate } from "../lib/format.js";
import { suggestZoneForProduct } from "../lib/slottingAlgorithms.js";
import DatePicker from "./DatePicker.jsx";
import Modal from "./Modal.jsx";

const EMPTY_FORM = {
  urunAdi: "",
  kod: "",
  warehouseId: "",
  zoneId: "",
  partiNo: "",
  uretimTarihi: "",
  miktar: "",
  birim: "",
  tarih: todayISO(),
  notMetni: "",
};

// Palet = depodaki envanterin taşıma birimi. Bu ekran hem MAL KABUL (yeni
// palet ekleme - her ekleme bir "giriş" hareketi olarak loglanır) hem MAL
// ÇIKIŞ'ı (durumu "Sevk Edildi" yapmak - bir "çıkış" hareketi loglanır)
// tek yerden yönetiyor. Liste sunucudan FIFO sırasıyla (en eski üretim
// tarihi önce) geliyor - aynı üründen depoda birden fazla parti varsa,
// hangisinin önce çıkması gerektiğini "FIFO" rozeti gösteriyor.
export default function PalletsDashboard({ warehouses = [], zones = [], products = [] }) {
  const { pallets, loading, error, addPallet, editPallet, removePallet, fetchMovements } = usePallets();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState("");
  const [showShipped, setShowShipped] = useState(false);
  // Tarih (üretim tarihi) / miktar filtreleri veri girişi formundan AYRI -
  // sonuç tablosunun üstünde.
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

  const [movementsFor, setMovementsFor] = useState(null); // pallet obj
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Bölüm otomatik önerildiğinde true - kullanıcı elle bölüm seçerse ya da
  // ürün/depo değişip yeni bir öneri beklenirken false'a döner. Sadece
  // arayüzde "✨ Otomatik önerildi" rozetini göstermek için, veriyi
  // etkilemiyor.
  const [zoneAutoFilled, setZoneAutoFilled] = useState(false);

  // Miktar/birim ürün kataloğundan (bkz. ProductsDashboard) otomatik
  // dolduğunda true - kullanıcı elle miktar/birim girerse false'a döner.
  // Sadece rozet göstermek için, zoneAutoFilled ile aynı desen.
  const [productAutoFilled, setProductAutoFilled] = useState(false);

  function updateField(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "warehouseId") next.zoneId = ""; // depo değişince bölüm seçimi sıfırlanır
      return next;
    });
    if (field === "zoneId" || field === "warehouseId") setZoneAutoFilled(false);
    if (field === "miktar" || field === "birim") setProductAutoFilled(false);
  }

  const productByName = useMemo(() => {
    const byName = new Map();
    products.forEach((p) => byName.set(p.ad.trim().toLowerCase(), p));
    return byName;
  }, [products]);

  // OTOMATIK MİKTAR/BİRİM ÖNERİSİ: ürün adı, ürün kataloğunda tam eşleşen
  // bir kayda sahipse ve miktar/birim henüz elle girilmemişse, "bu üründen
  // bir palete kaç tane sığar" (paletBasinaAdet) ve birimi otomatik
  // doldurur. Katalogda kayıtlı olmayan (serbest metinle girilen) ürünler
  // etkilenmez - hiçbir şey zorlanmaz.
  useEffect(() => {
    const product = productByName.get(form.urunAdi.trim().toLowerCase());
    if (!product) return;
    if (form.miktar || form.birim) return;
    setForm((f) =>
      f.miktar || f.birim
        ? f
        : { ...f, miktar: product.paletBasinaAdet != null ? String(product.paletBasinaAdet) : f.miktar, birim: product.birim || f.birim }
    );
    setProductAutoFilled(true);
  }, [form.urunAdi, form.miktar, form.birim, productByName]);

  // OTOMATIK BÖLÜM ÖNERİSİ: ürün adı + depo girildiğinde ve bölüm henüz
  // seçilmemişken, ABC hız sınıfına ve mevcut doluluğa göre en uygun boş
  // bölümü otomatik doldurur (bkz. lib/slottingAlgorithms.js
  // suggestZoneForProduct). Kullanıcı isterse açılır menüden değiştirebilir
  // - hiçbir zaman elle yapılmış bir seçimin üzerine yazmaz.
  useEffect(() => {
    const urunAdi = form.urunAdi.trim();
    if (!urunAdi || !form.warehouseId || form.zoneId) return;
    const suggestion = suggestZoneForProduct(urunAdi, pallets, zones, form.warehouseId);
    if (!suggestion) return;
    setForm((f) => (f.zoneId || f.warehouseId !== suggestion.zone.warehouseId ? f : { ...f, zoneId: suggestion.zoneId }));
    setZoneAutoFilled(true);
  }, [form.urunAdi, form.warehouseId, form.zoneId, pallets, zones]);

  const matchedProduct = useMemo(
    () => productByName.get(form.urunAdi.trim().toLowerCase()) || null,
    [productByName, form.urunAdi]
  );

  const zoneSuggestionLabel = useMemo(() => {
    if (!zoneAutoFilled || !form.zoneId) return null;
    const zone = zones.find((z) => z.id === form.zoneId);
    if (!zone) return null;
    return `${zone.kod}${zone.ad ? ` (${zone.ad})` : ""}`;
  }, [zoneAutoFilled, form.zoneId, zones]);

  const warehouseName = useMemo(() => {
    const byId = new Map(warehouses.map((w) => [w.id, w.ad]));
    return (id) => byId.get(id) || "-";
  }, [warehouses]);

  const zoneLabel = useMemo(() => {
    const byId = new Map(zones.map((z) => [z.id, z.kod]));
    return (id) => (id ? byId.get(id) || "-" : "-");
  }, [zones]);

  const zonesForSelectedWarehouse = useMemo(
    () => zones.filter((z) => z.warehouseId === form.warehouseId),
    [zones, form.warehouseId]
  );

  // Aynı üründen depoda birden fazla parti varsa, listede (zaten FIFO
  // sıralı) İLK rastlanan "önce çıkması gereken" partidir.
  const fifoFirstByProduct = useMemo(() => {
    const seen = new Set();
    const result = new Set();
    for (const p of pallets) {
      if (p.durum !== "depoda") continue;
      if (!seen.has(p.urunAdi)) {
        seen.add(p.urunAdi);
        result.add(p.id);
      }
    }
    return result;
  }, [pallets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = miktarMin === "" ? null : Number(miktarMin);
    const max = miktarMax === "" ? null : Number(miktarMax);
    return pallets.filter((p) => {
      if (!showShipped && p.durum === "sevk_edildi") return false;
      if (q) {
        const matches = [p.urunAdi, p.kod, p.partiNo, warehouseName(p.warehouseId), zoneLabel(p.zoneId)].some((v) =>
          v?.toLowerCase().includes(q)
        );
        if (!matches) return false;
      }
      if (dateFrom && (!p.uretimTarihi || p.uretimTarihi < dateFrom)) return false;
      if (dateTo && (!p.uretimTarihi || p.uretimTarihi > dateTo)) return false;
      if (min != null && (p.miktar == null || p.miktar < min)) return false;
      if (max != null && (p.miktar == null || p.miktar > max)) return false;
      return true;
    });
  }, [pallets, query, showShipped, warehouseName, zoneLabel, dateFrom, dateTo, miktarMin, miktarMax]);

  const stats = useMemo(() => {
    const depoda = pallets.filter((p) => p.durum === "depoda").length;
    return { depoda, toplam: pallets.length };
  }, [pallets]);

  // Kapasite (bkz. WarehouseZonesDashboard - artık palet SAYISI) burada
  // ZORUNLU değil, sadece UYARIYOR - gerçek depoda geçici bir aşım fiziksel
  // olarak mümkün olabiliyor, admin isterse yine de devam edebilir. Kapasite
  // tanımlı değilse (kapasite=null) hiç kontrol yapılmıyor.
  function checkZoneCapacity(zoneId) {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone || zone.kapasite == null) return true;
    if (zone.doluluk + 1 > zone.kapasite) {
      return window.confirm(
        `${zone.kod} bölümü kapasitenin üstüne çıkacak (${zone.doluluk + 1} / ${zone.kapasite} palet). Yine de devam edilsin mi?`
      );
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const urunAdi = form.urunAdi.trim();
    if (!urunAdi) return setSubmitError("Ürün adı zorunlu.");
    if (form.zoneId && !checkZoneCapacity(form.zoneId)) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await addPallet({
        urunAdi,
        kod: form.kod.trim(),
        warehouseId: form.warehouseId || null,
        zoneId: form.zoneId || null,
        partiNo: form.partiNo.trim(),
        uretimTarihi: form.uretimTarihi || "",
        miktar: form.miktar === "" ? null : Number(form.miktar),
        birim: form.birim.trim(),
        tarih: form.tarih,
        notMetni: form.notMetni.trim(),
      });
      setForm({ ...EMPTY_FORM, warehouseId: form.warehouseId, zoneId: form.zoneId, tarih: form.tarih });
      setZoneAutoFilled(false);
      setProductAutoFilled(false);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShipOut(p) {
    if (!window.confirm(`${p.urunAdi} (${p.kod}) sevk edildi olarak işaretlensin mi?`)) return;
    await editPallet(p.id, { durum: "sevk_edildi", tarih: todayISO() });
  }

  async function handleZoneChange(p, zoneId) {
    if (zoneId && !checkZoneCapacity(zoneId)) return;
    await editPallet(p.id, { zoneId: zoneId || "", tarih: todayISO() });
  }

  async function openMovements(p) {
    setMovementsFor(p);
    setMovementsLoading(true);
    try {
      setMovements(await fetchMovements(p.id));
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card">
          <Boxes size={18} />
          <div>
            <div className="stat-value">{stats.depoda}</div>
            <div className="stat-label">Depoda</div>
          </div>
        </div>
        <div className="stat-card">
          <LogOut size={18} />
          <div>
            <div className="stat-value">{stats.toplam - stats.depoda}</div>
            <div className="stat-label">Sevk Edildi</div>
          </div>
        </div>
      </div>

      <p className="dashboard-hint">
        Yeni palet eklemek MAL KABUL'dür. Tablodan "Sevk Et" MAL ÇIKIŞ'tır. Aynı üründen depoda birden fazla parti
        varsa "FIFO" rozetli olan - üretim tarihi en eski olan - önce çıkmalı.
      </p>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="pl-urun">Ürün Adı *</label>
          <input
            id="pl-urun"
            type="text"
            list="pl-urun-katalog"
            value={form.urunAdi}
            onChange={(e) => updateField("urunAdi", e.target.value)}
            required
          />
          <datalist id="pl-urun-katalog">
            {products.map((p) => (
              <option key={p.id} value={p.ad} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label htmlFor="pl-kod">Palet Kodu</label>
          <input id="pl-kod" type="text" placeholder="Boş bırakılırsa otomatik üretilir" value={form.kod} onChange={(e) => updateField("kod", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="pl-parti">Parti No</label>
          <input id="pl-parti" type="text" value={form.partiNo} onChange={(e) => updateField("partiNo", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="pl-uretim">Üretim Tarihi</label>
          <DatePicker id="pl-uretim" value={form.uretimTarihi} onChange={(v) => updateField("uretimTarihi", v)} allowClear />
        </div>

        <div className="field">
          <label htmlFor="pl-miktar">Miktar</label>
          <input id="pl-miktar" type="number" inputMode="decimal" step="0.01" value={form.miktar} onChange={(e) => updateField("miktar", e.target.value)} />
          {productAutoFilled && (form.miktar || form.birim) && (
            <span
              className="status-badge status-good"
              style={{ cursor: "default", alignSelf: "flex-start" }}
              title="Ürün kataloğundaki 'palet başına adet' değerinden otomatik dolduruldu, dilerseniz değiştirebilirsiniz."
            >
              <Sparkles size={12} style={{ marginRight: 4 }} /> Ürün kataloğundan önerildi
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="pl-birim">Birim</label>
          <input id="pl-birim" type="text" placeholder="adet / kg / koli..." value={form.birim} onChange={(e) => updateField("birim", e.target.value)} />
        </div>

        {matchedProduct && (matchedProduct.paletUzunlukCm || matchedProduct.paletGenislikCm || matchedProduct.paletYukseklikCm || matchedProduct.paletAgirlikKg) && (
          <p className="dashboard-hint field-wide" style={{ margin: 0 }}>
            Dolu palet boyutu (ürün kataloğundan): {matchedProduct.paletUzunlukCm ?? "?"} × {matchedProduct.paletGenislikCm ?? "?"} ×{" "}
            {matchedProduct.paletYukseklikCm ?? "?"} cm
            {matchedProduct.paletAgirlikKg ? ` · ~${matchedProduct.paletAgirlikKg} kg` : ""}
          </p>
        )}

        <div className="field">
          <label htmlFor="pl-depo">Depo</label>
          <select id="pl-depo" value={form.warehouseId} onChange={(e) => updateField("warehouseId", e.target.value)}>
            <option value="">— Seçilmedi —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="pl-bolum">Bölüm</label>
          <select id="pl-bolum" value={form.zoneId} onChange={(e) => updateField("zoneId", e.target.value)} disabled={!form.warehouseId}>
            <option value="">— Seçilmedi —</option>
            {zonesForSelectedWarehouse.map((z) => (
              <option key={z.id} value={z.id}>
                {z.kod}
              </option>
            ))}
          </select>
          {zoneSuggestionLabel && (
            <span
              className="status-badge status-good"
              style={{ cursor: "default", alignSelf: "flex-start" }}
              title="Ürünün hız sınıfına ve bölüm doluluğuna göre otomatik seçildi, dilerseniz değiştirebilirsiniz."
            >
              <Sparkles size={12} style={{ marginRight: 4 }} /> Otomatik önerildi: {zoneSuggestionLabel}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="pl-tarih">Kabul Tarihi</label>
          <DatePicker id="pl-tarih" value={form.tarih} onChange={(v) => updateField("tarih", v)} />
        </div>

        <div className="field field-wide">
          <label htmlFor="pl-not">Not</label>
          <input id="pl-not" type="text" value={form.notMetni} onChange={(e) => updateField("notMetni", e.target.value)} />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            <Plus size={16} />
            {submitting ? "Kaydediliyor…" : "Mal Kabul (Palet Ekle)"}
          </button>
        </div>
      </form>

      <div className="scan-table-wrap">
        <div className="scan-search">
          <Search size={16} />
          <input type="text" placeholder="Ürün, kod, parti ya da depoda ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <label className="checkbox-inline">
          <input type="checkbox" checked={showShipped} onChange={(e) => setShowShipped(e.target.checked)} />
          Sevk edilenleri de göster
        </label>

        <div className="filter-row">
          <div className="filter-field">
            <label htmlFor="pl-filter-from">Üretim tarihi (başlangıç)</label>
            <DatePicker id="pl-filter-from" value={dateFrom} onChange={setDateFrom} allowClear />
          </div>
          <div className="filter-field">
            <label htmlFor="pl-filter-to">Üretim tarihi (bitiş)</label>
            <DatePicker id="pl-filter-to" value={dateTo} onChange={setDateTo} allowClear />
          </div>
          <div className="filter-field">
            <label htmlFor="pl-filter-min">Miktar (en az)</label>
            <input id="pl-filter-min" type="number" inputMode="decimal" value={miktarMin} onChange={(e) => setMiktarMin(e.target.value)} />
          </div>
          <div className="filter-field">
            <label htmlFor="pl-filter-max">Miktar (en çok)</label>
            <input id="pl-filter-max" type="number" inputMode="decimal" value={miktarMax} onChange={(e) => setMiktarMax(e.target.value)} />
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
          <p className="empty-state">{pallets.length === 0 ? "Henüz palet kaydı yok." : "Aramayla/filtreyle eşleşen kayıt yok."}</p>
        ) : (
          <div className="scan-table-scroll">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Parti / Üretim</th>
                  <th>Miktar</th>
                  <th>Konum</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.urunAdi}
                      <div className="muted code-cell">{p.kod}</div>
                    </td>
                    <td className="muted">
                      {p.partiNo || "-"}
                      {p.uretimTarihi ? ` · ${trDate(p.uretimTarihi)}` : ""}
                      {fifoFirstByProduct.has(p.id) && <span className="status-badge status-warning">FIFO</span>}
                    </td>
                    <td className="muted">{p.miktar != null ? `${p.miktar} ${p.birim || ""}`.trim() : "-"}</td>
                    <td className="muted">
                      {p.durum === "depoda" ? (
                        <select value={p.zoneId || ""} onChange={(e) => handleZoneChange(p, e.target.value)} disabled={!p.warehouseId}>
                          <option value="">— Bölüm yok —</option>
                          {zones.filter((z) => z.warehouseId === p.warehouseId).map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.kod}
                            </option>
                          ))}
                        </select>
                      ) : (
                        `${warehouseName(p.warehouseId)} / ${zoneLabel(p.zoneId)}`
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${p.durum === "depoda" ? "status-good" : "status-muted"}`}>
                        {p.durum === "depoda" ? "Depoda" : "Sevk Edildi"}
                      </span>
                    </td>
                    <td className="row-actions">
                      {p.durum === "depoda" && (
                        <button className="icon-btn" onClick={() => handleShipOut(p)} aria-label="Sevk Et" title="Sevk Et (Mal Çıkış)">
                          <ArrowRightLeft size={15} />
                        </button>
                      )}
                      <button className="icon-btn" onClick={() => openMovements(p)} aria-label="Hareketler" title="Hareket Geçmişi">
                        <History size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => {
                          if (window.confirm(`${p.urunAdi} (${p.kod}) silinsin mi? Hareket geçmişi de silinir. Bu geri alınamaz.`)) removePallet(p.id);
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

      {movementsFor && (
        <Modal title={`${movementsFor.urunAdi} - Hareketler`} onClose={() => setMovementsFor(null)}>
          {movementsLoading ? (
            <p className="empty-state">Yükleniyor…</p>
          ) : movements.length === 0 ? (
            <p className="empty-state">Hareket kaydı yok.</p>
          ) : (
            <dl className="live-card-fields">
              {movements.map((m) => (
                <div key={m.id} className="live-card-row">
                  <dt>
                    {m.tur === "giris" ? "Giriş" : m.tur === "cikis" ? "Çıkış" : "Transfer"}
                    {m.tarih ? ` · ${trDate(m.tarih)}` : ""}
                  </dt>
                  <dd>
                    {m.miktar != null ? m.miktar : ""} {zoneLabel(m.zoneId) !== "-" ? `· ${zoneLabel(m.zoneId)}` : ""}
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
