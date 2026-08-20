import React, { useState, useEffect } from "react";
import {
  LayoutGrid,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Warehouse,
  ListOrdered,
  FileSpreadsheet,
  Package,
  Layers,
  ArrowUpRight
} from "lucide-react";
import { fetchPallets, fetchWarehouseZones, fetchWarehouses, createPallet } from "../lib/api";
import {
  calculateAbcVelocityAnalysis,
  generateSlottingRecommendations,
  generateWavePickPath
} from "../lib/slottingAlgorithms";

export default function WarehouseSlottingDashboard() {
  const [pallets, setPallets] = useState([]);
  const [zones, setZones] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedWavePallets, setSelectedWavePallets] = useState([]);
  const [generatedPickPath, setGeneratedPickPath] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [palletsData, zonesData, whData] = await Promise.all([
        fetchPallets(),
        fetchWarehouseZones(),
        fetchWarehouses()
      ]);
      setPallets(palletsData || []);
      setZones(zonesData || []);
      setWarehouses(whData || []);
      if (whData && whData.length > 0) {
        setSelectedWarehouseId(whData[0].id);
      }
    } catch (e) {
      console.warn("Depo slotting verileri yüklenirken hata:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredPallets = selectedWarehouseId
    ? pallets.filter((p) => p.warehouse_id === selectedWarehouseId)
    : pallets;

  const filteredZones = selectedWarehouseId
    ? zones.filter((z) => z.warehouse_id === selectedWarehouseId)
    : zones;

  const abcAnalysis = calculateAbcVelocityAnalysis(filteredPallets);
  const slottingRecommendations = generateSlottingRecommendations(filteredPallets, filteredZones, abcAnalysis);

  const toggleWaveSelect = (pallet) => {
    if (selectedWavePallets.find((p) => p.id === pallet.id)) {
      setSelectedWavePallets(selectedWavePallets.filter((p) => p.id !== pallet.id));
    } else {
      setSelectedWavePallets([...selectedWavePallets, pallet]);
    }
  };

  const handleGenerateWave = () => {
    if (selectedWavePallets.length === 0) {
      alert("Lütfen toplama dalgasına dahil etmek için en az 1 palet seçin.");
      return;
    }
    const path = generateWavePickPath(selectedWavePallets, filteredZones);
    setGeneratedPickPath(path);
  };

  return (
    <div className="space-y-6">
      {/* Üst Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Akıllı Depo Slotting (Yerleşim) & Wave Picking Optimizasyonu
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pareto ABC hız analizi, rampa yakınlık puanlaması ve minimum forklift mesafeli toplama rotaları.
          </p>
        </div>

        {/* Depo Filtresi */}
        <div className="flex items-center gap-2">
          <Warehouse className="w-4 h-4 text-slate-500" />
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-xl border border-slate-300 dark:border-slate-700 outline-none"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.ad}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ABC Velocity Özeti & Slotting Önerileri */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ABC Analizi Tablosu (7 kolon) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                ABC Hız Sınıflandırması (Pareto Analizi)
              </h3>
              <p className="text-xs text-slate-500">
                A: Hızlı sirkülasyon (%80) • B: Standart (%15) • C: Düşük hızlı (%5)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto my-3 flex-1">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2">Sınıf</th>
                  <th className="py-2">Ürün Adı</th>
                  <th className="py-2 text-right">Mevcut Miktar</th>
                  <th className="py-2 text-right">Kümülatif %</th>
                  <th className="py-2">Önerilen Depo Bölgesi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {abcAnalysis.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${item.oncelikRengi}`}>
                        {item.sinif}
                      </span>
                    </td>
                    <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                      {item.urun_adi}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {item.toplam_miktar} {item.birim}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-500">
                      %{item.cumulativePercent}
                    </td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-300 text-[11px]">
                      {item.onerilenBolge}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slotting İyileştirme Önerileri (5 kolon) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Yerleşim (Slotting) İyileştirme Önerileri
              </h3>
              <p className="text-xs text-slate-500">Yanlış konumlanmış palet tespiti</p>
            </div>
            <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-bold rounded-lg text-xs">
              {slottingRecommendations.length} Öneri
            </span>
          </div>

          <div className="flex-1 overflow-y-auto my-3 space-y-3 max-h-[300px] pr-1">
            {slottingRecommendations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                ✓ Tüm paletler ideal depo bölgelerine yerleştirilmiş.
              </div>
            ) : (
              slottingRecommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Palet [{rec.palletKod}] - {rec.urun_adi}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">
                      {rec.mevcutYer}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {rec.oneri}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Wave Picking (Toplama Dalgası & Rota Sıralayıcı) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-blue-600" />
              Depo İçi Toplama Dalgası & Koridor Rotası (Wave Picking)
            </h3>
            <p className="text-xs text-slate-500">
              Paletleri seçin ve S-Shape koridor gezinme algoritması ile minimum adımlı toplama listesi oluşturun.
            </p>
          </div>

          <button
            onClick={handleGenerateWave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition self-start sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5" /> Toplama Dalgası Oluştur ({selectedWavePallets.length} Seçili)
          </button>
        </div>

        {/* Depodaki Paletler Seçim Listesi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredPallets
            .filter((p) => p.durum === "depoda")
            .slice(0, 8)
            .map((p) => {
              const isSelected = Boolean(selectedWavePallets.find((item) => item.id === p.id));
              return (
                <div
                  key={p.id}
                  onClick={() => toggleWaveSelect(p)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100"
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{p.kod}</div>
                    <div className="text-[11px] text-slate-500">{p.urun_adi}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {p.miktar} {p.birim}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="rounded accent-blue-600"
                  />
                </div>
              );
            })}
        </div>

        {/* Üretilen Toplama Rotası */}
        {generatedPickPath && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Optimize Edilmiş Depo Toplama Rotası (S-Shape Koridor Sıralaması)
            </div>

            <div className="space-y-2">
              {generatedPickPath.map((step) => (
                <div
                  key={step.adim}
                  className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {step.toplamaYolu}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
                    Parti: {step.parti_no || "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
