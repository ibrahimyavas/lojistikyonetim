import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import {
  Box,
  Layers,
  Maximize2,
  RotateCcw,
  Truck,
  PackageCheck,
  Plus,
  Trash2,
  Scale,
  Sparkles,
  Save,
  Info,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import {
  CONTAINER_PRESETS,
  solve3DContainerPacking
} from "../lib/packing3dAlgorithms";
import { fetchPackingPlans, savePackingPlan, deletePackingPlan } from "../lib/api";

export default function Packing3DDashboard() {
  const containerMountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const meshGroupRef = useRef(null);

  const [selectedPreset, setSelectedPreset] = useState("standart_tir");
  const [containerSpecs, setContainerSpecs] = useState(CONTAINER_PRESETS.standart_tir);
  const [boxItems, setBoxItems] = useState([
    { id: "1", ad: "A Tipi Ağır Koli", u: 80, g: 60, y: 50, agirlik: 45, adet: 40, kirilabilir: false, color: "#3b82f6" },
    { id: "2", ad: "B Tipi Standart Kutu", u: 60, g: 40, y: 40, agirlik: 20, adet: 60, kirilabilir: false, color: "#10b981" },
    { id: "3", ad: "C Tipi Hafif Ürün", u: 50, g: 40, y: 30, agirlik: 8, adet: 50, kirilabilir: false, color: "#f59e0b" },
    { id: "4", ad: "Hassas Elektronik", u: 40, g: 30, y: 30, agirlik: 12, adet: 25, kirilabilir: true, color: "#ec4899" }
  ]);

  const [packingResult, setPackingResult] = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);
  const [planTitle, setPlanTitle] = useState("Ana Sevkiyat 3D Yükleme Planı");
  const [layerHeightLimit, setLayerHeightLimit] = useState(260);
  const [showWireframeOnly, setShowWireframeOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("3d_view"); // 3d_view | items | saved_plans

  // Preset seçimi değiştiğinde
  const handlePresetChange = (presetKey) => {
    setSelectedPreset(presetKey);
    const specs = CONTAINER_PRESETS[presetKey];
    if (specs) {
      setContainerSpecs(specs);
      setLayerHeightLimit(specs.yukseklik);
    }
  };

  // 3D Paketleme Algoritmasını Çalıştır
  const runOptimization = () => {
    const res = solve3DContainerPacking(containerSpecs, boxItems);
    setPackingResult(res);
    render3DScene(res, containerSpecs, layerHeightLimit, showWireframeOnly);
  };

  useEffect(() => {
    runOptimization();
  }, [containerSpecs]);

  useEffect(() => {
    loadSavedPlans();
  }, []);

  const loadSavedPlans = async () => {
    try {
      const plans = await fetchPackingPlans();
      setSavedPlans(plans);
    } catch (e) {
      console.warn("Kayıtlı planlar alınamadı:", e);
    }
  };

  // Three.js 3D Sahne Kurulumu
  useEffect(() => {
    const mount = containerMountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 450;

    // Sahne
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Slate-900
    sceneRef.current = scene;

    // Kamera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    camera.position.set(2000, 1500, 2500);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    // Işıklar
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(1500, 2500, 1500);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.4);
    dirLight2.position.set(-1500, -1000, -1500);
    scene.add(dirLight2);

    // Grup
    const group = new THREE.Group();
    scene.add(group);
    meshGroupRef.current = group;

    // Basit Orbit Kontrol Simülasyonu (Mouse drag ile rotasyon)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging || !group) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      group.rotation.y += deltaX * 0.006;
      group.rotation.x += deltaY * 0.006;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z += e.deltaY * 1.5;
      camera.position.z = Math.max(800, Math.min(6000, camera.position.z));
    };

    // Dokunmatik (telefon/tablet) desteği - depo/şoför tarafı bunu
    // muhtemelen masaüstünden değil telefondan açacak, mouse-only kontrol
    // orada 3D görünümü tamamen etkileşimsiz (sadece sabit bir resim)
    // bırakırdı. Tek parmak = döndürme (mouse drag ile aynı mantık), iki
    // parmak = kıstırma (pinch) ile yakınlaştırma (wheel ile aynı mantık).
    let pinchStartDistance = null;

    function touchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        isDragging = false;
        pinchStartDistance = touchDistance(e.touches);
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        group.rotation.y += deltaX * 0.006;
        group.rotation.x += deltaY * 0.006;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && pinchStartDistance != null) {
        e.preventDefault();
        const newDistance = touchDistance(e.touches);
        const delta = pinchStartDistance - newDistance; // parmaklar açılırsa (yakınlaştır) negatif
        camera.position.z += delta * 3;
        camera.position.z = Math.max(800, Math.min(6000, camera.position.z));
        pinchStartDistance = newDistance;
      }
    };

    const onTouchEnd = (e) => {
      if (e.touches.length === 0) {
        isDragging = false;
        pinchStartDistance = null;
      }
    };

    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("wheel", onWheel, { passive: false });
    mount.addEventListener("touchstart", onTouchStart, { passive: true });
    mount.addEventListener("touchmove", onTouchMove, { passive: false });
    mount.addEventListener("touchend", onTouchEnd, { passive: true });

    // Animasyon Döngüsü
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mount || !renderer || !camera) return;
      const newW = mount.clientWidth;
      const newH = mount.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      mount.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("wheel", onWheel);
      mount.removeEventListener("touchstart", onTouchStart);
      mount.removeEventListener("touchmove", onTouchMove);
      mount.removeEventListener("touchend", onTouchEnd);
      if (renderer.domElement) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // 3D Nesneleri Sahneye Çizme
  const render3DScene = (res, specs, heightLimit, wireframeOnly) => {
    const group = meshGroupRef.current;
    if (!group) return;

    // Önceki nesneleri temizle
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    }

    const { uzunluk: cL, genislik: cW, yukseklik: cH } = specs;
    const offsetX = -cL / 2;
    const offsetY = -cW / 2;
    const offsetZ = -cH / 2;

    // Konteyner Tel Kafesi (Wireframe Bounds)
    const containerGeo = new THREE.BoxGeometry(cL, cW, cH);
    const wireframeGeo = new THREE.WireframeGeometry(containerGeo);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2, transparent: true, opacity: 0.7 });
    const containerWireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
    containerWireframe.position.set(0, 0, 0);
    group.add(containerWireframe);

    // Zemin Taban Plakası
    const floorGeo = new THREE.PlaneGeometry(cL, cW);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, 0, -cH / 2);
    group.add(floor);

    // Kolileri Ekle
    if (res && res.packedBoxes) {
      res.packedBoxes.forEach((b) => {
        if (b.z > heightLimit) return; // Katman filtresi

        const boxGeo = new THREE.BoxGeometry(b.u - 1, b.g - 1, b.y_h - 1);
        const boxMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(b.color),
          roughness: 0.3,
          metalness: 0.1,
          wireframe: wireframeOnly,
          transparent: true,
          opacity: 0.92
        });

        const boxMesh = new THREE.Mesh(boxGeo, boxMat);
        // Merkez pozisyonu hesapla
        const posX = offsetX + b.x + b.u / 2;
        const posY = offsetY + b.y + b.g / 2;
        const posZ = offsetZ + b.z + b.y_h / 2;

        boxMesh.position.set(posX, posY, posZ);

        // Koli kenarlık çizgisi
        const edgeGeo = new THREE.EdgesGeometry(boxGeo);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1 });
        const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
        boxMesh.add(edgeMesh);

        group.add(boxMesh);
      });
    }

    // Ağırlık Merkezi (Center of Gravity) İşaretçisi
    if (res?.metrics?.centerOfGravity) {
      const cog = res.metrics.centerOfGravity;
      const cogGeo = new THREE.SphereGeometry(15, 16, 16);
      const cogMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const cogMesh = new THREE.Mesh(cogGeo, cogMat);
      cogMesh.position.set(offsetX + cog.x, offsetY + cog.y, offsetZ + cog.z);
      group.add(cogMesh);
    }
  };

  // Katman veya tel kafes değiştiğinde tekrar çiz
  useEffect(() => {
    if (packingResult) {
      render3DScene(packingResult, containerSpecs, layerHeightLimit, showWireframeOnly);
    }
  }, [layerHeightLimit, showWireframeOnly]);

  // Yeni Koli Ekle
  const addBoxItem = () => {
    const newItem = {
      id: Date.now().toString(),
      ad: "Yeni Kargo Kalemi",
      u: 50,
      g: 40,
      y: 35,
      agirlik: 15,
      adet: 20,
      kirilabilir: false,
      color: "#6366f1"
    };
    setBoxItems([...boxItems, newItem]);
  };

  const removeBoxItem = (id) => {
    setBoxItems(boxItems.filter((i) => i.id !== id));
  };

  const updateBoxItem = (id, field, value) => {
    setBoxItems(
      boxItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSavePlan = async () => {
    if (!packingResult) return;
    setSaving(true);
    try {
      await savePackingPlan({
        baslik: planTitle,
        konteynerTipi: selectedPreset,
        konteynerU: containerSpecs.uzunluk,
        konteynerG: containerSpecs.genislik,
        konteynerY: containerSpecs.yukseklik,
        maksAgirlikKg: containerSpecs.maksAgirlik,
        toplamKoliSayisi: packingResult.metrics.packedCount,
        toplamAgirlikKg: packingResult.metrics.totalWeightKg,
        hacimDolulukOrani: packingResult.metrics.volumeUtilizationPercent,
        agirlikMerkezi: packingResult.metrics.centerOfGravity,
        koliVerileri: boxItems
      });
      await loadSavedPlans();
      alert("3D Yükleme Planı başarıyla kaydedildi!");
    } catch (e) {
      alert("Plan kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const resetCamera = () => {
    if (meshGroupRef.current) {
      meshGroupRef.current.rotation.set(0.4, 0.6, 0);
    }
    if (cameraRef.current) {
      cameraRef.current.position.set(2000, 1500, 2500);
    }
  };

  // Kayıtlı bir planı çalışma alanına geri yükler - önceden `savedPlans`
  // çekiliyordu ama hiçbir yerde gösterilmiyordu/geri yüklenemiyordu,
  // kaydetmenin tek yönlü (yaz ama asla oku) bir işlem olmasını düzeltiyor.
  const handleLoadPlan = (plan) => {
    const preset = CONTAINER_PRESETS[plan.konteynerTipi];
    setSelectedPreset(plan.konteynerTipi);
    setContainerSpecs({
      ad: preset?.ad || plan.konteynerTipi,
      uzunluk: plan.konteynerU,
      genislik: plan.konteynerG,
      yukseklik: plan.konteynerY,
      maksAgirlik: plan.maksAgirlikKg,
      aciklama: preset?.aciklama || ""
    });
    setLayerHeightLimit(plan.konteynerY);
    if (plan.koliVerileri && plan.koliVerileri.length > 0) {
      setBoxItems(plan.koliVerileri);
    }
    setPlanTitle(plan.baslik);
    setActiveTab("3d_view");
  };

  const handleDeletePlan = async (id) => {
    if (!window.confirm("Bu plan silinsin mi? Bu geri alınamaz.")) return;
    try {
      await deletePackingPlan(id);
      await loadSavedPlans();
    } catch (e) {
      alert("Plan silinirken hata oluştu.");
    }
  };

  const metrics = packingResult?.metrics;

  return (
    <div className="space-y-6">
      {/* Üst Bar & Konteyner Seçici */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Box className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              3D Kargo & Konteyner / Tır Yükleme Optimizasyonu
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            3D Bin Packing algoritması ile hacim, dingil ağırlık dengesi ve istifleme simülasyonu.
          </p>
        </div>

        {/* Konteyner / Taşıyıcı Tipi Seçimi */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(CONTAINER_PRESETS).map(([key, item]) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                selectedPreset === key
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              {item.ad.split("(")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Sekmeler - 3D Görünüm / Kayıtlı Planlar */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("3d_view")}
          className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition flex items-center gap-1.5 ${
            activeTab === "3d_view"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Box className="w-3.5 h-3.5" /> 3D Görünüm
        </button>
        <button
          onClick={() => setActiveTab("saved_plans")}
          className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition flex items-center gap-1.5 ${
            activeTab === "saved_plans"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Save className="w-3.5 h-3.5" /> Kayıtlı Planlar ({savedPlans.length})
        </button>
      </div>

      {/* KPI Kartları */}
      {activeTab === "3d_view" && metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Hacim Doluluğu</span>
              <Maximize2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              %{metrics.volumeUtilizationPercent}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {metrics.totalPackedVolumeM3} m³ / {metrics.containerVolumeM3} m³
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Toplam Ağırlık</span>
              <Scale className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {(metrics.totalWeightKg / 1000).toFixed(1)} Ton
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Kapasite: {(metrics.maxWeightKg / 1000).toFixed(1)} Ton (%{metrics.weightUtilizationPercent})
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Yüklenen Koli</span>
              <PackageCheck className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {metrics.packedCount} / {metrics.totalBoxes}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {metrics.unpackedCount > 0 ? (
                <span className="text-rose-500 font-medium">{metrics.unpackedCount} koli sığmadı</span>
              ) : (
                <span className="text-emerald-600 font-medium">✓ Tüm koliler yerleşti</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Dingil Dengesi</span>
              <AlertTriangle
                className={`w-4 h-4 ${metrics.axleBalance.isBalanced ? "text-emerald-500" : "text-amber-500"}`}
              />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              Ön: %{metrics.axleBalance.frontPercent} | Arka: %{metrics.axleBalance.rearPercent}
            </div>
            <div className="text-[11px] mt-1 font-medium">
              {metrics.axleBalance.isBalanced ? (
                <span className="text-emerald-600">✓ Dengeli Ağırlık</span>
              ) : (
                <span className="text-amber-600">⚠ Dengesiz Yük Dağılımı</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Ağırlık Merkezi (CoG)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            </div>
            <div className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 mt-1">
              X:{metrics.centerOfGravity.x} Y:{metrics.centerOfGravity.y}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Z (Yükseklik): {metrics.centerOfGravity.z} cm
            </div>
          </div>
        </div>
      )}

      {/* Ana Çalışma Alanı: 3D Görünüm & Kalem Listesi - "Kayıtlı Planlar"
          sekmesindeyken UNMOUNT edilmiyor (sadece CSS ile gizleniyor) -
          içindeki containerMountRef Three.js renderer'ının bağlı olduğu TEK
          DOM düğümü, unmount edilirse aşağıdaki Three.js useEffect'i
          (yalnızca bir kez, [] bağımlılıkla çalışıyor) o düğümü asla
          yeniden bulamaz, sekmeye geri dönünce 3D görünüm boş kalırdı. */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${activeTab === "3d_view" ? "" : "hidden"}`}>
        {/* Sol Kolon: 3D WebGL Canvas (7 kolon) */}
        <div className="lg:col-span-7 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex flex-col relative shadow-xl min-h-[480px]">
          {/* 3D Canvas Kontrol Araç Çubuğu */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>3D İnteraktif Simülasyon</span>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={resetCamera}
                title="Açıyı Sıfırla"
                className="p-2 bg-slate-900/80 backdrop-blur-md hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowWireframeOnly(!showWireframeOnly)}
                title="Kafes Modu"
                className={`p-2 backdrop-blur-md rounded-xl border transition ${
                  showWireframeOnly
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800"
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* WebGL Canvas Konteyneri */}
          <div
            ref={containerMountRef}
            className="w-full flex-1 min-h-[420px] cursor-grab active:cursor-grabbing"
          />

          {/* Alt Katman Kaydırıcı (Layer Slider) */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 gap-4">
            <span className="shrink-0 font-medium">Katman Yüksekliği:</span>
            <input
              type="range"
              min={20}
              max={containerSpecs.yukseklik}
              value={layerHeightLimit}
              onChange={(e) => setLayerHeightLimit(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <span className="font-mono text-blue-400 shrink-0">{layerHeightLimit} cm</span>
          </div>
        </div>

        {/* Sağ Kolon: Koli Yönetimi ve Yükleme Listesi (5 kolon) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Yüklenecek Kargo Kalemleri
              </h3>
              <p className="text-xs text-slate-500">Boyut (U x G x Y cm), Ağırlık ve Adet</p>
            </div>
            <button
              onClick={addBoxItem}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-xl text-xs font-medium flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Kalem Ekle
            </button>
          </div>

          {/* Koli Kalem Listesi */}
          <div className="flex-1 overflow-y-auto my-3 space-y-3 max-h-[360px] pr-1">
            {boxItems.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <input
                      type="text"
                      value={item.ad}
                      onChange={(e) => updateBoxItem(item.id, "ad", e.target.value)}
                      className="font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={() => removeBoxItem(item.id)}
                    className="text-slate-400 hover:text-rose-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block">U (cm)</label>
                    <input
                      type="number"
                      value={item.u}
                      onChange={(e) => updateBoxItem(item.id, "u", Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">G (cm)</label>
                    <input
                      type="number"
                      value={item.g}
                      onChange={(e) => updateBoxItem(item.id, "g", Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Y (cm)</label>
                    <input
                      type="number"
                      value={item.y}
                      onChange={(e) => updateBoxItem(item.id, "y", Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Adet</label>
                    <input
                      type="number"
                      value={item.adet}
                      onChange={(e) => updateBoxItem(item.id, "adet", Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-blue-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-500">Birim Ağırlık: {item.agirlik} kg</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.kirilabilir}
                      onChange={(e) => updateBoxItem(item.id, "kirilabilir", e.target.checked)}
                      className="rounded accent-rose-500"
                    />
                    <span className={item.kirilabilir ? "text-rose-600 font-medium" : "text-slate-500"}>
                      Kırılabilir / Üste Koy
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Optimizasyon Çalıştır ve Kaydet */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <button
              onClick={runOptimization}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition"
            >
              <Sparkles className="w-4 h-4" /> 3D Yerleşimi Yeniden Hesapla (3D Bin Packing)
            </button>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                placeholder="Plan Başlığı"
              />
              <button
                onClick={handleSavePlan}
                disabled={saving}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Kayıtlı Planlar - önceden `savedPlans` çekiliyordu ama hiçbir
          yerde gösterilmiyordu; kaydetme tek yönlü (yaz ama asla oku) bir
          işlemdi. Artık gerçek bir liste + Yükle/Sil. */}
      {activeTab === "saved_plans" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          {savedPlans.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">
              Henüz kayıtlı bir yükleme planı yok - "3D Görünüm" sekmesinde bir plan hesaplayıp kaydedin.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white">{plan.baslik}</h4>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-slate-400 hover:text-rose-500 transition shrink-0"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Info className="w-3 h-3 shrink-0" />
                      {(CONTAINER_PRESETS[plan.konteynerTipi]?.ad || plan.konteynerTipi || "").split("(")[0]}
                    </div>
                    <div>Hacim doluluğu: %{plan.hacimDolulukOrani}</div>
                    <div>
                      Ağırlık: {(plan.toplamAgirlikKg / 1000).toFixed(1)} ton · {plan.toplamKoliSayisi} koli
                    </div>
                    <div className="text-slate-400">
                      {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString("tr-TR") : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoadPlan(plan)}
                    className="mt-3 w-full py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Bu Planı Yükle
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
