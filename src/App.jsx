import { Fragment, useCallback, useEffect, useState } from "react";
import {
  LogOut, Moon, Sun, Truck, Users, Warehouse, Route, ArrowRightLeft, Tag, Boxes, LayoutGrid, MapPin, UserCog,
  PanelLeft, PanelTop, PanelLeftClose, PanelLeftOpen, Navigation, Box, Layers, TrendingUp, Package
} from "lucide-react";
import { useTheme } from "./hooks/useTheme.js";
import { useNavLayout } from "./hooks/useNavLayout.js";
import { useDrivers } from "./hooks/useDrivers.js";
import { useVehicles } from "./hooks/useVehicles.js";
import { useWarehouses } from "./hooks/useWarehouses.js";
import { useWarehouseZones } from "./hooks/useWarehouseZones.js";
import { useProducts } from "./hooks/useProducts.js";
import { fetchSession, logout } from "./lib/api.js";
import LoginGate from "./components/LoginGate.jsx";
import DriversDashboard from "./components/DriversDashboard.jsx";
import VehiclesDashboard from "./components/VehiclesDashboard.jsx";
import WarehousesDashboard from "./components/WarehousesDashboard.jsx";
import WarehouseZonesDashboard from "./components/WarehouseZonesDashboard.jsx";
import PalletsDashboard from "./components/PalletsDashboard.jsx";
import ShipmentsDashboard from "./components/ShipmentsDashboard.jsx";
import WarehouseTransfersDashboard from "./components/WarehouseTransfersDashboard.jsx";
import LabelPrintDashboard from "./components/LabelPrintDashboard.jsx";
import DriverLocationsDashboard from "./components/DriverLocationsDashboard.jsx";
import RouteOptimizationDashboard from "./components/RouteOptimizationDashboard.jsx";
import Packing3DDashboard from "./components/Packing3DDashboard.jsx";
import WarehouseSlottingDashboard from "./components/WarehouseSlottingDashboard.jsx";
import ReplenishmentDashboard from "./components/ReplenishmentDashboard.jsx";
import UsersDashboard from "./components/UsersDashboard.jsx";
import ProductsDashboard from "./components/ProductsDashboard.jsx";
import DriverPortalDashboard from "./components/DriverPortalDashboard.jsx";

// `roles`: bu sekmeyi hangi roller görebilir - bkz. worker/auth.js'teki üç
// rol (yonetici/operator/sofor). Şoför burada hiç YOK: normal sekme/sidebar
// sistemini hiç görmüyor, App.jsx doğrudan DriverPortalDashboard'a
// yönlendiriyor (aşağıda). Backend zaten aynı kısıtlamaları uyguluyor
// (worker/index.js ROUTE_GROUPS) - bu liste sadece arayüzde neyi
// GÖSTERECEĞİMİZİ belirliyor, tek güvenlik katmanı DEĞİL.
const TABS = [
  { id: "routeOptimization", label: "Rota & VRP Motoru", icon: Navigation, group: "optimizasyon", roles: ["yonetici"] },
  { id: "packing3d", label: "3D Tır/Koli Yükleme", icon: Box, group: "optimizasyon", roles: ["yonetici"] },
  { id: "warehouseSlotting", label: "Slotting & Wave Picking", icon: Layers, group: "optimizasyon", roles: ["yonetici"] },
  { id: "replenishment", label: "Talep & İkmal (ROP/FEFO)", icon: TrendingUp, group: "optimizasyon", roles: ["yonetici"] },
  { id: "shipments", label: "Sevkiyat", icon: Route, group: "operasyon", roles: ["yonetici", "operator"] },
  { id: "warehouseTransfers", label: "Depo Transferleri", icon: ArrowRightLeft, group: "operasyon", roles: ["yonetici", "operator"] },
  { id: "pallets", label: "Paletler (FIFO)", icon: Boxes, group: "operasyon", roles: ["yonetici", "operator"] },
  { id: "locations", label: "Konum Takip", icon: MapPin, group: "operasyon", roles: ["yonetici", "operator"] },
  { id: "labels", label: "Etiket Bas", icon: Tag, group: "operasyon", roles: ["yonetici", "operator"] },
  { id: "vehicles", label: "Araçlar", icon: Truck, group: "tanimlama", roles: ["yonetici"] },
  { id: "drivers", label: "Sürücüler", icon: Users, group: "tanimlama", roles: ["yonetici"] },
  { id: "warehouses", label: "Depolar", icon: Warehouse, group: "tanimlama", roles: ["yonetici"] },
  { id: "warehouseZones", label: "Depo Bölümleri", icon: LayoutGrid, group: "tanimlama", roles: ["yonetici"] },
  { id: "products", label: "Ürünler", icon: Package, group: "tanimlama", roles: ["yonetici"] },
  { id: "users", label: "Kullanıcılar", icon: UserCog, group: "tanimlama", roles: ["yonetici"] },
];

const GROUP_LABELS = { optimizasyon: "Optimizasyon & Algoritmalar", operasyon: "Operasyon", tanimlama: "Tanımlama" };
const GROUP_ORDER = ["optimizasyon", "operasyon", "tanimlama"];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { layout, toggleLayout } = useNavLayout();
  const [authChecked, setAuthChecked] = useState(false);
  const [session, setSession] = useState(null); // { role, id } | null
  const [view, setView] = useState("shipments");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("lojistik:sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });

  // Şoför rolü bu verilerin hiçbirine erişemiyor (backend 403 döner, bkz.
  // worker/index.js ROUTE_GROUPS) - gereksiz/başarısız isteklerden kaçınmak
  // için sadece yönetici/operatör oturumunda çekiliyor.
  const dataEnabled = Boolean(session) && session.role !== "sofor";

  // Araçlar/Sürücüler/Depolar tek yerden çekilip Sevkiyat, Depo Transferleri
  // ve Etiket Bas'a prop olarak veriliyor - hem gereksiz çift fetch'i
  // önlüyor hem de bu ekranların "araç/sürücü/depo seç" listelerini aynı
  // canlı veriyle besliyor (suppliers/customers deseni, bkz.
  // barkod-okuyucu ERP'sindeki App.jsx).
  const { drivers, loading: driversLoading, error: driversError, addDriver, editDriver, removeDriver } =
    useDrivers(dataEnabled);
  const { vehicles, loading: vehiclesLoading, error: vehiclesError, addVehicle, editVehicle, removeVehicle } =
    useVehicles(dataEnabled);
  const {
    warehouses,
    loading: warehousesLoading,
    error: warehousesError,
    addWarehouse,
    editWarehouse,
    removeWarehouse,
  } = useWarehouses(dataEnabled);
  const { zones, loading: zonesLoading, error: zonesError, addZone, editZone, removeZone } =
    useWarehouseZones(dataEnabled);
  const {
    products,
    loading: productsLoading,
    error: productsError,
    addProduct,
    editProduct,
    removeProduct,
  } = useProducts(dataEnabled);

  const visibleTabs = session ? TABS.filter((t) => t.roles.includes(session.role)) : [];
  const navGroups = GROUP_ORDER.map((g) => ({
    id: g,
    label: GROUP_LABELS[g],
    tabs: visibleTabs.filter((t) => t.group === g),
  })).filter((g) => g.tabs.length > 0);

  useEffect(() => {
    fetchSession()
      .then((s) => setSession(s.authenticated ? { role: s.role, id: s.id } : null))
      .catch(() => setSession(null))
      .finally(() => setAuthChecked(true));
  }, []);

  // Operatör oturumunda Yönetici-only bir sekmede kalınmış olabilir (ör.
  // Yönetici çıkış yapıp aynı tarayıcıda Operatör girdi) - görünür değilse
  // ilk görünür sekmeye yönlendir.
  useEffect(() => {
    if (!session || session.role === "sofor") return;
    if (visibleTabs.some((t) => t.id === view)) return;
    if (visibleTabs.length > 0) setView(visibleTabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, visibleTabs]);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("lojistik:sidebarCollapsed", next ? "1" : "0");
      } catch {
        // depolama yoksa tercih sadece bu oturumda kalır
      }
      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      setSession(null);
    }
  }, []);

  if (!authChecked) {
    return <div className="app-loading">Yükleniyor…</div>;
  }

  if (!session) {
    return <LoginGate onSuccess={(s) => setSession(s)} />;
  }

  const themeToggleBtn = (
    <button className="icon-btn" onClick={toggleTheme} title={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}>
      {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );

  const layoutToggleBtn = (
    <button className="icon-btn" onClick={toggleLayout} title={layout === "sidebar" ? "Üst sekme şeridine geç" : "Sol menüye geç"}>
      {layout === "sidebar" ? <PanelTop size={16} /> : <PanelLeft size={16} />}
    </button>
  );

  const logoutBtn = (
    <button className="icon-btn" onClick={handleLogout} title="Çıkış yap">
      <LogOut size={16} />
    </button>
  );

  // Şoför - normal sekme/sidebar sistemi yerine TEK bir ekran (kendi
  // sevkiyatları). Backend zaten her uç noktada bu rolü kısıtlıyor, ama
  // arayüzde de karışık bir menü göstermeye gerek yok.
  if (session.role === "sofor") {
    return (
      <div className="app">
        <header className="app-header">
          <div className="app-header-title">
            <Route size={20} />
            <h1>Sevkiyatlarım</h1>
          </div>
          <div className="app-header-actions">
            {themeToggleBtn}
            {logoutBtn}
          </div>
        </header>
        <DriverPortalDashboard />
      </div>
    );
  }

  const activeDashboard = (
    <>
      {view === "routeOptimization" && <RouteOptimizationDashboard />}
      {view === "packing3d" && <Packing3DDashboard />}
      {view === "warehouseSlotting" && <WarehouseSlottingDashboard />}
      {view === "replenishment" && <ReplenishmentDashboard />}
      {view === "shipments" && <ShipmentsDashboard vehicles={vehicles} drivers={drivers} warehouses={warehouses} />}
      {view === "warehouseTransfers" && <WarehouseTransfersDashboard warehouses={warehouses} />}
      {view === "pallets" && <PalletsDashboard warehouses={warehouses} zones={zones} products={products} />}
      {view === "locations" && <DriverLocationsDashboard />}
      {view === "labels" && <LabelPrintDashboard warehouses={warehouses} />}
      {view === "vehicles" && (
        <VehiclesDashboard
          drivers={drivers}
          vehicles={vehicles}
          loading={vehiclesLoading}
          error={vehiclesError}
          addVehicle={addVehicle}
          editVehicle={editVehicle}
          removeVehicle={removeVehicle}
        />
      )}
      {view === "drivers" && (
        <DriversDashboard
          drivers={drivers}
          loading={driversLoading}
          error={driversError}
          addDriver={addDriver}
          editDriver={editDriver}
          removeDriver={removeDriver}
        />
      )}
      {view === "warehouses" && (
        <WarehousesDashboard
          warehouses={warehouses}
          loading={warehousesLoading}
          error={warehousesError}
          addWarehouse={addWarehouse}
          editWarehouse={editWarehouse}
          removeWarehouse={removeWarehouse}
        />
      )}
      {view === "warehouseZones" && (
        <WarehouseZonesDashboard
          warehouses={warehouses}
          zones={zones}
          loading={zonesLoading}
          error={zonesError}
          addZone={addZone}
          editZone={editZone}
          removeZone={removeZone}
        />
      )}
      {view === "products" && (
        <ProductsDashboard
          products={products}
          loading={productsLoading}
          error={productsError}
          addProduct={addProduct}
          editProduct={editProduct}
          removeProduct={removeProduct}
        />
      )}
      {view === "users" && <UsersDashboard />}
    </>
  );

  if (layout === "sidebar") {
    return (
      <div className="app-shell">
        <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-top">
            {!sidebarCollapsed && <div className="sidebar-brand">Lojistik</div>}
            <button
              className="icon-btn sidebar-collapse-btn"
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
          <nav className="sidebar-nav">
            {navGroups.map((g) => (
              <div key={g.id} className="sidebar-nav-group">
                {!sidebarCollapsed && <div className="sidebar-group-label">{g.label}</div>}
                {g.tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    className={`sidebar-link ${view === id ? "active" : ""}`}
                    onClick={() => setView(id)}
                    title={sidebarCollapsed ? label : undefined}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            {layoutToggleBtn}
            {themeToggleBtn}
            {logoutBtn}
          </div>
        </aside>
        <main className="main-content">{activeDashboard}</main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-title">
          <Truck size={20} />
          <h1>Lojistik</h1>
        </div>
        <div className="app-header-actions">
          {layoutToggleBtn}
          {themeToggleBtn}
          {logoutBtn}
        </div>
      </header>

      <nav className="tab-nav">
        {navGroups.map((g, gi) => (
          <Fragment key={g.id}>
            {g.tabs.map(({ id, label, icon: Icon }, i) => (
              <button
                key={id}
                className={`tab-btn ${view === id ? "active" : ""} ${gi > 0 && i === 0 ? "tab-group-start" : ""}`}
                onClick={() => setView(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </Fragment>
        ))}
      </nav>

      {activeDashboard}
    </div>
  );
}
