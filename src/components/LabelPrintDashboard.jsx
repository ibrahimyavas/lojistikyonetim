import { useMemo, useState } from "react";
import { Plus, Trash2, Printer, Tag, Eye } from "lucide-react";
import { useShipments } from "../hooks/useShipments.js";
import { useWarehouseTransfers } from "../hooks/useWarehouseTransfers.js";
import { useLabelQueue } from "../hooks/useLabelQueue.js";
import { buildRoutePayload, buildRouteRef } from "../lib/qrPayload.js";
import BarcodeLabel, { QR_SIZE_OPTIONS } from "./BarcodeLabel.jsx";
import Modal from "./Modal.jsx";

const FORMAT_OPTIONS = [
  { value: "code_128", label: "Code 128 (genel amaçlı, önerilen)" },
  { value: "ean_13", label: "EAN-13" },
  { value: "ean_8", label: "EAN-8" },
  { value: "upc_a", label: "UPC-A" },
  { value: "upc_e", label: "UPC-E" },
  { value: "code_39", label: "Code 39" },
  { value: "itf", label: "ITF" },
  { value: "codabar", label: "Codabar" },
  { value: "qr_code", label: "QR Kod" },
];

const EMPTY_FORM = { barkod: "", urunAdi: "", format: "code_128", nereden: "", nereye: "", boyut: "orta" };

// Sevkiyat/Depo Transferi kayıtlarından güzergah bilgisiyle barkod/QR
// etiketi üretir - hem serbest metin (elle girilen güzergah) hem "canlı
// referans" (bir kayıttan seçilirse) QR'ı destekliyor, bkz.
// resolveQrPayload aşağıda.
export default function LabelPrintDashboard({ warehouses = [] }) {
  const { shipments } = useShipments();
  const { transfers } = useWarehouseTransfers();
  const { items, addItem, updateCount, removeItem, clearAll } = useLabelQueue();
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [selectedTransferId, setSelectedTransferId] = useState("");
  // Kuyruktaki bir etiketi büyük önizlemede görmek/tek başına yazdırmak için
  // - bkz. Modal.jsx. Doluyken yazdırma alanı SADECE bu etiketi içeriyor
  // (aşağıdaki print-area), kuyruğun geri kalanı etkilenmiyor.
  const [previewItem, setPreviewItem] = useState(null);

  const isQr = form.format === "qr_code";

  function warehouseName(id) {
    return warehouses.find((w) => w.id === id)?.ad || "?";
  }

  // Sadece güzergahı (nereden/nereye) dolduruyor. Bir sevkiyat seçilince QR
  // artık o kayda CANLI bağlanır (bkz. resolveQrPayload) - iki seçiciden
  // sadece biri aktif olabilir.
  function pickShipment(id) {
    setSelectedShipmentId(id);
    setSelectedTransferId("");
    const s = shipments.find((sv) => sv.id === id);
    if (s) {
      setForm((f) => ({
        ...f,
        urunAdi: s.urunAdi || f.urunAdi,
        barkod: s.barkod || f.barkod,
        nereden: s.cikisKonumu || f.nereden,
        nereye: s.varisKonumu || f.nereye,
      }));
    }
  }

  // Aynı mantık, Depo Transferleri için - kaynak/hedef depo adı nereden/
  // nereye'ye eşliyor.
  function pickTransfer(id) {
    setSelectedTransferId(id);
    setSelectedShipmentId("");
    const t = transfers.find((tr) => tr.id === id);
    if (t) {
      setForm((f) => ({
        ...f,
        urunAdi: t.urunAdi || f.urunAdi,
        barkod: t.barkod || f.barkod,
        nereden: warehouseName(t.kaynakDepoId),
        nereye: warehouseName(t.hedefDepoId),
      }));
    }
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    // Nereden/nereye elle değiştirilirse artık seçilen kayıtla birebir
    // uyuşmuyor demektir - canlı referans QR'ını değil, eski statik metin
    // QR'ını kullanmaya geri dön (bkz. resolveQrPayload).
    if (field === "nereden" || field === "nereye") {
      setSelectedShipmentId("");
      setSelectedTransferId("");
    }
  }

  // QR içeriğini çözer: bir Sevkiyat/Transfer kaydı seçiliyse (ve elle
  // değiştirilmediyse) CANLI referans QR'ı üretir - okutan taraf her
  // seferinde o kaydın o anki halini sunucudan çeker. Aksi halde (elle
  // girilen/bağlantısız güzergah) bilgiyi doğrudan metin olarak QR'a gömer.
  function resolveQrPayload({ urunAdi, barkod, nereden, nereye }) {
    if (!isQr) return null;
    if (selectedShipmentId) return buildRouteRef("shipment", selectedShipmentId);
    if (selectedTransferId) return buildRouteRef("transfer", selectedTransferId);
    if (nereden || nereye) return buildRoutePayload({ urunAdi, barkod, nereden, nereye });
    return null;
  }

  function handleAdd(e) {
    e.preventDefault();
    const barkod = form.barkod.trim();
    if (!barkod) return;
    const urunAdi = form.urunAdi.trim();
    const nereden = form.nereden.trim();
    const nereye = form.nereye.trim();
    const hasRoute = isQr && (nereden || nereye || selectedShipmentId || selectedTransferId);
    addItem({
      barkod,
      urunAdi,
      format: form.format,
      boyut: isQr ? form.boyut : undefined,
      nereden: hasRoute ? nereden : "",
      nereye: hasRoute ? nereye : "",
      qrPayload: resolveQrPayload({ urunAdi, barkod, nereden, nereye }),
    });
  }

  const totalLabels = useMemo(() => items.reduce((sum, it) => sum + it.adet, 0), [items]);

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card">
          <Tag size={18} />
          <div>
            <div className="stat-value">{items.length}</div>
            <div className="stat-label">Kuyrukta Etiket</div>
          </div>
        </div>
        <div className="stat-card">
          <Printer size={18} />
          <div>
            <div className="stat-value">{totalLabels}</div>
            <div className="stat-label">Toplam Etiket</div>
          </div>
        </div>
      </div>

      <form className="product-form" onSubmit={handleAdd}>
        <div className="field">
          <label htmlFor="lb-kod">Kod *</label>
          <input id="lb-kod" type="text" value={form.barkod} onChange={(e) => updateField("barkod", e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="lb-ad">Ürün Adı</label>
          <input id="lb-ad" type="text" value={form.urunAdi} onChange={(e) => updateField("urunAdi", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="lb-format">Format</label>
          <select id="lb-format" value={form.format} onChange={(e) => updateField("format", e.target.value)}>
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isQr && (
          <>
            <div className="field">
              <label htmlFor="lb-boyut">QR Boyutu</label>
              <select id="lb-boyut" value={form.boyut} onChange={(e) => updateField("boyut", e.target.value)}>
                {QR_SIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field-wide">
              <label htmlFor="lb-sevkiyat-sec">Sevkiyattan güzergah doldur (opsiyonel)</label>
              <select id="lb-sevkiyat-sec" value={selectedShipmentId} onChange={(e) => pickShipment(e.target.value)}>
                <option value="">— Elle gir —</option>
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tarafAdi} ({s.cikisKonumu || "?"} → {s.varisKonumu || "?"})
                  </option>
                ))}
              </select>
            </div>

            <div className="field field-wide">
              <label htmlFor="lb-transfer-sec">Depo Transferinden güzergah doldur (opsiyonel)</label>
              <select id="lb-transfer-sec" value={selectedTransferId} onChange={(e) => pickTransfer(e.target.value)}>
                <option value="">— Elle gir —</option>
                {transfers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.urunAdi} ({warehouseName(t.kaynakDepoId)} → {warehouseName(t.hedefDepoId)})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="lb-nereden">Nereden</label>
              <input id="lb-nereden" type="text" value={form.nereden} onChange={(e) => updateField("nereden", e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="lb-nereye">Nereye</label>
              <input id="lb-nereye" type="text" value={form.nereye} onChange={(e) => updateField("nereye", e.target.value)} />
            </div>

            {(selectedShipmentId || selectedTransferId) && (
              <p className="field field-wide dashboard-hint">
                Bu QR canlı bağlı: kayıt Sevkiyat/Depo Transferleri'nde güncellendikçe (durum, güzergah) aynı
                etiketi okutunca güncel bilgi görünür - nereden/nereye'yi elle değiştirirseniz bağlantı kopar.
              </p>
            )}
          </>
        )}

        <div className="field field-wide">
          <label>Önizleme</label>
          {form.barkod ? (
            <BarcodeLabel
              barkod={form.barkod}
              urunAdi={form.urunAdi}
              format={form.format}
              boyut={isQr ? form.boyut : undefined}
              nereden={isQr ? form.nereden : ""}
              nereye={isQr ? form.nereye : ""}
              qrPayload={resolveQrPayload({
                urunAdi: form.urunAdi,
                barkod: form.barkod,
                nereden: form.nereden,
                nereye: form.nereye,
              })}
            />
          ) : (
            <p className="empty-state">Önizleme için bir kod girin.</p>
          )}
        </div>

        <button type="submit" className="submit-btn" disabled={!form.barkod.trim()}>
          <Plus size={16} />
          Kuyruğa Ekle
        </button>
      </form>

      <div className="scan-table-wrap">
        {items.length === 0 ? (
          <p className="empty-state">Kuyruk boş. Yukarıdan etiket ekleyin.</p>
        ) : (
          <>
            <div className="scan-table-scroll">
              <table className="scan-table">
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Kod</th>
                    <th>Format</th>
                    <th>Güzergah</th>
                    <th>Adet</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.urunAdi || "-"}</td>
                      <td className="code-cell">{it.barkod}</td>
                      <td className="muted">{FORMAT_OPTIONS.find((o) => o.value === it.format)?.label.split(" (")[0] || it.format}</td>
                      <td className="muted">{it.nereden || it.nereye ? `${it.nereden || "?"} → ${it.nereye || "?"}` : "-"}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="qty-input"
                          value={it.adet}
                          onChange={(e) => updateCount(it.id, Number(e.target.value) || 1)}
                        />
                      </td>
                      <td className="row-actions">
                        <button
                          className="icon-btn"
                          onClick={() => setPreviewItem(it)}
                          aria-label="Görüntüle ve yazdır"
                          title="Görüntüle ve yazdır"
                        >
                          <Eye size={15} />
                        </button>
                        <button className="icon-btn danger" onClick={() => removeItem(it.id)} aria-label="Sil" title="Sil">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="toolbar">
              <div className="toolbar-group">
                <button type="button" className="icon-btn labeled danger" onClick={clearAll}>
                  <Trash2 size={16} />
                  Kuyruğu Temizle
                </button>
              </div>
              <div className="toolbar-group">
                <button type="button" className="submit-btn" onClick={() => window.print()}>
                  <Printer size={16} />
                  Yazdır ({totalLabels} etiket)
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Ekranda gizli - sadece yazdırma sırasında görünür (bkz. index.css
          @media print). previewItem doluyken (bkz. Modal) yalnızca O
          etiketi içerir - kuyruğun geri kalanı yanlışlıkla yazdırılmaz. */}
      <div className="print-area">
        {(previewItem ? [previewItem] : items).flatMap((it) =>
          Array.from({ length: it.adet }, (_, i) => (
            <BarcodeLabel
              key={`${it.id}-${i}`}
              barkod={it.barkod}
              urunAdi={it.urunAdi}
              format={it.format}
              boyut={it.boyut}
              qrPayload={it.qrPayload}
              nereden={it.nereden}
              nereye={it.nereye}
            />
          ))
        )}
      </div>

      {previewItem && (
        <Modal title={previewItem.urunAdi || previewItem.barkod} onClose={() => setPreviewItem(null)}>
          <BarcodeLabel
            barkod={previewItem.barkod}
            urunAdi={previewItem.urunAdi}
            format={previewItem.format}
            boyut={previewItem.boyut}
            qrPayload={previewItem.qrPayload}
            nereden={previewItem.nereden}
            nereye={previewItem.nereye}
          />
          <p className="dashboard-hint">
            {previewItem.adet} adet yazdırılacak
            {previewItem.format === "qr_code"
              ? ` · ${QR_SIZE_OPTIONS.find((o) => o.value === previewItem.boyut)?.label || QR_SIZE_OPTIONS[1].label}`
              : ""}
          </p>
          <button type="button" className="submit-btn" onClick={() => window.print()}>
            <Printer size={16} />
            Bu Etiketi Yazdır
          </button>
        </Modal>
      )}
    </div>
  );
}
