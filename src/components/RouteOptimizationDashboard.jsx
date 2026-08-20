import React, { useState, useEffect } from "react";
import {
  Navigation,
  MapPin,
  Sparkles,
  Truck,
  Fuel,
  Leaf,
  Clock,
  Coins,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  Printer,
  CheckCircle,
  FileText,
  TrendingDown
} from "lucide-react";
import {
  TURKEY_COORDINATES,
  solveOptimalRoute2Opt,
  calculateFuelAndEmissions,
  estimateTravelTimeMinutes
} from "../lib/routingAlgorithms";
import { fetchOptimizedRoutes, saveOptimizedRoute, deleteOptimizedRoute } from "../lib/api";

export default function RouteOptimizationDashboard() {
  const [originKey, setOriginKey] = useState("merkez_tuzla");
  const [vehicleType, setVehicleType] = useState("kamyon"); // tir | kamyon | kamyonet | panelvan
  const [routeTitle, setRouteTitle] = useState("Marmara & Ege Çoklu Teslimat Rotası");

  const [waypoints, setWaypoints] = useState([
    { id: "1", ad: "Merkez Ana Depo (Tuzla)", lat: 40.8533, lng: 29.3033, tur: "baslangic", paketAdedi: 0, agirlikKg: 0 },
    { id: "2", ad: "Bursa Dağıtım Noktası", lat: 40.2144, lng: 28.9833, tur: "teslimat", paketAdedi: 24, agirlikKg: 1200 },
    { id: "3", ad: "Eskişehir OSB Dağıtım", lat: 39.7767, lng: 30.5206, tur: "teslimat", paketAdedi: 35, agirlikKg: 1800 },
    { id: "4", ad: "Anadolu Bölge Deposu (Gebze)", lat: 40.8142, lng: 29.4358, tur: "toplama", paketAdedi: 15, agirlikKg: 900 },
    { id: "5", ad: "İzmir - Kemalpaşa Lojistik", lat: 38.4286, lng: 27.4189, tur: "teslimat", paketAdedi: 40, agirlikKg: 2500 }
  ]);

  const [optimizedResult, setOptimizedResult] = useState(null);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("planner"); // planner | saved_routes

  // 2-Opt Optimizasyon Algoritmasını Çalıştır
  const handleOptimizeRoute = () => {
    const result = solveOptimalRoute2Opt(waypoints);
    setOptimizedResult(result);
    setWaypoints(result.orderedPoints);
  };

  useEffect(() => {
    loadSavedRoutes();
  }, []);

  const loadSavedRoutes = async () => {
    try {
      const routes = await fetchOptimizedRoutes();
      setSavedRoutes(routes);
    } catch (e) {
      console.warn("Kayıtlı rotalar alınamadı:", e);
    }
  };

  // Yeni Durak Ekle
  const addWaypoint = (coordKey) => {
    const coord = TURKEY_COORDINATES[coordKey];
    if (!coord) return;
    const newWp = {
      id: Date.now().toString(),
      ad: coord.ad,
      lat: coord.lat,
      lng: coord.lng,
      tur: "teslimat",
      paketAdedi: 10,
      agirlikKg: 500
    };
    setWaypoints([...waypoints, newWp]);
    setOptimizedResult(null);
  };

  // Durak Sırasını Değiştir
  const moveWaypoint = (index, direction) => {
    if (index === 0 && direction === -1) return; // Başlangıç sabit
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= waypoints.length) return;

    const newWps = [...waypoints];
    const temp = newWps[index];
    newWps[index] = newWps[targetIdx];
    newWps[targetIdx] = temp;
    setWaypoints(newWps);
    setOptimizedResult(null);
  };

  const removeWaypoint = (index) => {
    if (waypoints.length <= 2) {
      alert("Rotada en az 2 durak bulunmalıdır.");
      return;
    }
    setWaypoints(waypoints.filter((_, i) => i !== index));
    setOptimizedResult(null);
  };

  // Metrikler
  const totalKm = optimizedResult
    ? optimizedResult.totalDistanceKm
    : solveOptimalRoute2Opt(waypoints).totalDistanceKm;

  const totalWeightTon = Number(
    (waypoints.reduce((sum, w) => sum + (Number(w.agirlikKg) || 0), 0) / 1000).toFixed(1)
  );

  const durationMins = estimateTravelTimeMinutes(totalKm);
  const durationHours = (durationMins / 60).toFixed(1);
  const ecoMetrics = calculateFuelAndEmissions(totalKm, totalWeightTon, vehicleType);

  const handleSaveRoute = async () => {
    setSaving(true);
    try {
      await saveOptimizedRoute({
        ad: routeTitle,
        toplamMesafeKm: totalKm,
        tahminiSureDk: durationMins,
        tahminiYakitLitre: ecoMetrics.fuelLiters,
        karbonEmisyonKg: ecoMetrics.co2Kg,
        toplamAgirlikKg: totalWeightTon * 1000,
        durum: "aktif",
        waypoints: waypoints.map((w, idx) => ({
          siraNo: idx + 1,
          tur: w.tur,
          adresBaslik: w.ad,
          lat: w.lat,
          lng: w.lng,
          paketAdedi: w.paketAdedi,
          agirlikKg: w.agirlikKg
        }))
      });
      await loadSavedRoutes();
      alert("Optimize edilmiş rota başarıyla kaydedildi!");
    } catch (e) {
      alert("Rota kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  // Basit İnteraktif SVG Harita Projeksiyonu
  // Koordinatları SVG kutusu (500x350) içine ölçekle
  const minLat = Math.min(...waypoints.map((w) => w.lat)) - 0.4;
  const maxLat = Math.max(...waypoints.map((w) => w.lat)) + 0.4;
  const minLng = Math.min(...waypoints.map((w) => w.lng)) - 0.5;
  const maxLng = Math.max(...waypoints.map((w) => w.lng)) + 0.5;

  const projectPoint = (lat, lng) => {
    const x = ((lng - minLng) / (maxLng - minLng || 1)) * 440 + 30;
    const y = (1 - (lat - minLat) / (maxLat - minLat || 1)) * 260 + 40;
    return { x, y };
  };

  const pathPoints = waypoints.map((w) => projectPoint(w.lat, w.lng));
  const svgPathData = pathPoints.reduce(
    (acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
    ""
  );

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Araç Tipi */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Navigation className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Çok Duraklı Rota & VRP / TSP Optimizasyon Motoru
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            2-Opt sezgisel algoritması ile mesafe kısaltma, yakıt ve karbon salınımı hesaplama.
          </p>
        </div>

        {/* Araç Filo Seçici */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Araç Tipi:</span>
          {["tir", "kamyon", "kamyonet", "panelvan"].map((type) => (
            <button
              key={type}
              onClick={() => setVehicleType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium uppercase transition ${
                vehicleType === type
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Toplam Mesafe</span>
            <Navigation className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {totalKm} km
          </div>
          {optimizedResult?.savingsKm > 0 && (
            <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
              <TrendingDown className="w-3 h-3" /> {optimizedResult.savingsKm} km tasarruf (%{optimizedResult.savingsPercent})
            </div>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Sürüş Süresi</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            ~{durationHours} Saat
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{durationMins} dakika sürüş</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Yakıt Tüketimi</span>
            <Fuel className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {ecoMetrics.fuelLiters} L
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Dizel Yakıt</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Yakıt Maliyeti</span>
            <Coins className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {ecoMetrics.fuelCostTL.toLocaleString("tr-TR")} ₺
          </div>
          <div className="text-[11px] text-slate-500 mt-1">@44₺ / Litre</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>CO₂ Emisyonu</span>
            <Leaf className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {ecoMetrics.co2Kg} kg
          </div>
          <div className="text-[11px] text-slate-500 mt-1">GLEC Standardı</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Toplam Yük</span>
            <Truck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {totalWeightTon} Ton
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{waypoints.length} Durak</div>
        </div>
      </div>

      {/* Ana Çalışma Alanı: Harita ve Durak Sıralayıcı */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sol Kolon: İnteraktif Vektörel Güzergah Haritası (7 kolon) */}
        <div className="lg:col-span-7 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex flex-col relative shadow-xl min-h-[420px]">
          <div className="absolute top-3 left-3 z-10 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Türkiye Lojistik Koridoru Haritası</span>
          </div>

          {/* SVG Rota Gösterimi */}
          <div className="w-full flex-1 flex items-center justify-center p-4">
            <svg viewBox="0 0 500 350" className="w-full h-full max-h-[380px]">
              {/* Rota Çizgisi */}
              <path
                d={svgPathData}
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeDasharray="6,3"
                className="transition-all duration-500"
              />

              {/* Durak Noktaları */}
              {waypoints.map((w, idx) => {
                const pt = projectPoint(w.lat, w.lng);
                const isStart = idx === 0;
                const isEnd = idx === waypoints.length - 1;

                return (
                  <g key={w.id} className="cursor-pointer group">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isStart ? 12 : 9}
                      fill={isStart ? "#10b981" : isEnd ? "#3b82f6" : "#f59e0b"}
                      stroke="#0f172a"
                      strokeWidth="2.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y + 4}
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {idx + 1}
                    </text>
                    <text
                      x={pt.x}
                      y={pt.y - 12}
                      fill="#e2e8f0"
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                      className="opacity-90 group-hover:opacity-100 drop-shadow-md"
                    >
                      {w.ad.split("(")[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Yeşil: Çıkış Deposu | Turuncu: Ara Duraklar | Mavi: Son Varış</span>
            <span className="font-mono text-emerald-400">2-Opt / TSP Hazır</span>
          </div>
        </div>

        {/* Sağ Kolon: Durak Listesi & Sıralama Kontrolleri (5 kolon) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Güzergah Durak Listesi
              </h3>
              <p className="text-xs text-slate-500">Durak sırası ve teslimat yükleri</p>
            </div>

            {/* Hızlı Şehir Ekle Açılır Menüsü */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addWaypoint(e.target.value);
                  e.target.value = "";
                }
              }}
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-xl border border-slate-300 dark:border-slate-700 outline-none"
            >
              <option value="">+ Durak Ekle...</option>
              {Object.entries(TURKEY_COORDINATES).map(([k, item]) => (
                <option key={k} value={k}>
                  {item.ad}
                </option>
              ))}
            </select>
          </div>

          {/* Durak Sıralama Listesi */}
          <div className="flex-1 overflow-y-auto my-3 space-y-2 max-h-[320px] pr-1">
            {waypoints.map((w, idx) => (
              <div
                key={w.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      idx === 0
                        ? "bg-emerald-600 text-white"
                        : idx === waypoints.length - 1
                        ? "bg-blue-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {w.ad}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {w.paketAdedi} Paket • {w.agirlikKg} kg • {w.tur}
                    </div>
                  </div>
                </div>

                {/* Kontroller: Yukarı/Aşağı/Sil */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => moveWaypoint(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveWaypoint(idx, 1)}
                    disabled={idx === waypoints.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeWaypoint(idx)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Optimizasyon Butonu ve Kaydetme */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <button
              onClick={handleOptimizeRoute}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
            >
              <Sparkles className="w-4 h-4" /> En İdeal Rotayı Çöz (2-Opt TSP Algoritması)
            </button>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={routeTitle}
                onChange={(e) => setRouteTitle(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                placeholder="Rota Başlığı"
              />
              <button
                onClick={handleSaveRoute}
                disabled={saving}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
