import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  Sparkles,
  CheckCircle2,
  Package,
  Clock,
  ShieldCheck,
  Plus
} from "lucide-react";
import { fetchPallets, fetchWarehouses, fetchWarehouseTransfers, createWarehouseTransfer } from "../lib/api";
import { calculateInventoryForecasts, calculateFefoRiskMatrix } from "../lib/forecastingAlgorithms";

export default function ReplenishmentDashboard() {
  const [pallets, setPallets] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingTransfer, setCreatingTransfer] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [palletsData, whData, transfersData] = await Promise.all([
        fetchPallets(),
        fetchWarehouses(),
        fetchWarehouseTransfers()
      ]);
      setPallets(palletsData || []);
      setWarehouses(whData || []);
      setTransfers(transfersData || []);
    } catch (e) {
      console.warn("İkmal verileri yüklenirken hata:", e);
    } finally {
      setLoading(false);
    }
  };

  const { forecastResults, replenishmentAlerts, parameters } = calculateInventoryForecasts(
    pallets,
    warehouses,
    transfers
  );

  const fefoRisks = calculateFefoRiskMatrix(pallets);

  const handleCreateAutoTransfer = async (alertItem) => {
    setCreatingTransfer(true);
    try {
      await createWarehouseTransfer({
        urunAdi: alertItem.urun_adi,
        miktar: alertItem.onerilen_miktar,
        birim: alertItem.birim,
        kaynakDepoId: alertItem.kaynak_depo_id,
        hedefDepoId: alertItem.hedef_depo_id,
        durum: "planlandi",
        tarih: new Date().toISOString().split("T")[0],
        notMetni: `Otomatik İkmal Algoritması: ${alertItem.sebep}`
      });
      alert(`[${alertItem.urun_adi}] için ikmal transferi oluşturuldu.`);
      await loadData();
    } catch (e) {
      alert("Transfer oluşturulurken hata oluştu.");
    } finally {
      setCreatingTransfer(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Üst Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Talep Tahmini & Otomatik İkmal Motoru (ROP / FEFO)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Güvenlik stoku hesaplama, tükenme riski erken uyarısı ve depolar arası otomatik ikmal önerileri.
          </p>
        </div>

        {/* Parametre Rozeti */}
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>Güvenlik Katsayısı: <span className="font-bold text-slate-900 dark:text-white">Z=1.65 (%95)</span></div>
          <div>Tedarik Süresi: <span className="font-bold text-slate-900 dark:text-white">{parameters.leadTimeDays} Gün</span></div>
        </div>
      </div>

      {/* Kritik Stok & Otomatik Transfer Önerileri */}
      {replenishmentAlerts.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Kritik Stok Uyarısı & Önerilen İkmal Transferleri ({replenishmentAlerts.length})
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {replenishmentAlerts.map((alert, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-sm flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {alert.urun_adi} ➔ {alert.hedef_depo_adi}
                  </div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    {alert.sebep}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Önerilen Miktar: {alert.onerilen_miktar} {alert.birim}
                  </div>
                </div>

                <button
                  onClick={() => handleCreateAutoTransfer(alert)}
                  disabled={creatingTransfer}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-xs flex items-center gap-1 shrink-0 shadow-md shadow-rose-600/20 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Transfer Başlat
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stok Sağlığı ve ROP Tahmin Tablosu */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Depo Bazlı Stok Sağlığı ve Reorder Point (ROP) Matrisi
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2.5">Depo</th>
                <th className="py-2.5">Ürün Adı</th>
                <th className="py-2.5 text-right">Mevcut Stok</th>
                <th className="py-2.5 text-right">Güvenlik Stoku</th>
                <th className="py-2.5 text-right">Sipariş Eşiği (ROP)</th>
                <th className="py-2.5 text-right">Kalan Gün</th>
                <th className="py-2.5">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {forecastResults.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 font-medium text-slate-900 dark:text-white">{item.depo_adi}</td>
                  <td className="py-2.5 font-medium">{item.urun_adi}</td>
                  <td className="py-2.5 text-right font-mono font-bold">{item.mevcut_stok} {item.birim}</td>
                  <td className="py-2.5 text-right font-mono text-slate-500">{item.guvenlik_stoku} {item.birim}</td>
                  <td className="py-2.5 text-right font-mono text-slate-500">{item.rop} {item.birim}</td>
                  <td className="py-2.5 text-right font-mono font-semibold text-blue-600">~{item.kalan_gun} Gün</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${item.durumRenk}`}>
                      {item.durum}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FEFO (First Expired First Out) Raf Ömrü Risk Matrisi */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600" />
          FEFO (İlk Biten İlk Çıkar) Raf Ömrü & SKT Risk Matrisi
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2.5">Palet Kodu</th>
                <th className="py-2.5">Ürün Adı</th>
                <th className="py-2.5">Parti No</th>
                <th className="py-2.5">Üretim Tarihi</th>
                <th className="py-2.5">Tahmini SKT</th>
                <th className="py-2.5 text-right">Kalan Gün</th>
                <th className="py-2.5">Öncelik / Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {fefoRisks.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 font-mono font-bold text-slate-900 dark:text-white">{item.kod}</td>
                  <td className="py-2.5 font-medium">{item.urun_adi}</td>
                  <td className="py-2.5 text-slate-500">{item.parti_no || "-"}</td>
                  <td className="py-2.5 text-slate-500">{item.uretim_tarihi}</td>
                  <td className="py-2.5 font-medium">{item.tahmini_skt}</td>
                  <td className="py-2.5 text-right font-mono font-bold">
                    {item.kalan_gun > 0 ? `${item.kalan_gun} Gün` : "Doldu"}
                  </td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${item.badgeClass}`}>
                      {item.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
