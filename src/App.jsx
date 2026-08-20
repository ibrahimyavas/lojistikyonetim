import { Fragment, useCallback, useEffect, useState } from "react";
import {
  LogOut, Moon, Sun, Truck, Users, Warehouse, Route, ArrowRightLeft, Tag, Boxes, LayoutGrid, MapPin,
  PanelLeft, PanelTop, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useTheme } from "./hooks/useTheme.js";
import { useNavLayout } from "./hooks/useNavLayout.js";
import { useDrivers } from "./hooks/useDrivers.js";
import { useVehicles } from "./hooks/useVehicles.js";
import { useWarehouses } from "./hooks/useWarehouses.js";
import { useWarehouseZones } from "./hooks/useWarehouseZones.js";
import { fetchAuthStatus, logout } from "./lib/api.js";
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

// Her yeni modül burada bir TABS girdisi + activeDashboard'da bir dal alır -
// barkod-okuyucu ERP'sindeki aynı desen. `group`: "operasyon" (günlük
// kullanım) vs "tanimlama" (saf veri girişi) - Operasyon önce, daha kolay
// erişilebilir olsun diye.
const TABS = [
  { id: "shipments", label: "Sevkiyat", icon: Route, group: "operasyon" },
  { id: "warehouseTransfers", label: "Depo Transferleri", icon: ArrowRightLeft, group: "operasyon" },
  { id: "pallets", label: "Paletler", icon: Boxes, group: "operasyon" },
  { id: "locations", label: "Konum", icon: MapPin, group: "operasyon" },
  { id: "labels", label: "Etiket Bas", icon: Tag, group: "operasyon" },
  { id: "vehicles", label: "Araçlar", icon: Truck, group: "tanimlama" },
  { id: "drivers", label: "Sürücüler", icon: Users, group: "tanimlama" },
  { id: "warehouses", label: "Depolar", icon: Warehouse, group: "tanimlama" },
  { id: "warehouseZones", label: "Depo Bölümleri", icon: LayoutGrid, group: "tanimlama" },
];

const GROUP_LABELS = { operasyon: "Operasyon", tanimlama: "Tanımlama" };
const GROUP_ORDER = ["operasyon", "tanimlama"];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { layout, toggleLayout } = useNavLayout();
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState("shipments");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("lojistik:sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });

  // Araçlar/Sürücüler/Depolar tek yerden çekilip Sevkiyat, Depo Transferleri
  // ve Etiket Bas'a prop olarak veriliyor - hem gereksiz çift fetch'i
  // önlüyor hem de bu ekranların "araç/sürücü/depo seç" listelerini aynı
  // canlı veriyle besliyor (suppliers/customers deseni, bkz.
  // barkod-okuyucu ERP'sindeki App.jsx).
  const { drivers, loading: driversLoading, error: driversError, addDriver, editDriver, removeDriver } =
    useDrivers(authenticated);
  const { vehicles, loading: vehiclesLoading, error: vehiclesError, addVehicle, editVehicle, removeVehicle } =
    useVehicles(authenticated);
  const {
    warehouses,
    loading: warehousesLoading,
    error: warehousesError,
    addWarehouse,
    editWarehouse,
    removeWarehouse,
  } = useWarehouses(authenticated);
  const { zones, loading: zonesLoading, error: zonesError, addZone, editZone, removeZone } =
    useWarehouseZones(authenticated);

  const navGroups = GROUP_ORDER.map((g) => ({
    id: g,
    label: GROUP_LABELS[g],
    tabs: TABS.filter((t) => t.group === g),
  }));

  useEffect(() => {
    fetchAuthStatus()
      .then(setAuthenticated)
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthChecked(true));
  }, []);

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
      setAuthenticated(false);
    }
  }, []);

  if (!authChecked) {
    return <div className="app-loading">Yükleniyor…</div>;
  }

  if (!authenticated) {
    return <LoginGate onSuccess={() => setAuthenticated(true)} />;
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

  const activeDashboard = (
    <>
      {view === "shipments" && <ShipmentsDashboard vehicles={vehicles} drivers={drivers} warehouses={warehouses} />}
      {view === "warehouseTransfers" && <WarehouseTransfersDashboard warehouses={warehouses} />}
      {view === "pallets" && <PalletsDashboard warehouses={warehouses} zones={zones} />}
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
