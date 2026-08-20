import { useCallback, useEffect, useState } from "react";
import { LogOut, Moon, Sun, Truck, Users, Warehouse } from "lucide-react";
import { useTheme } from "./hooks/useTheme.js";
import { useDrivers } from "./hooks/useDrivers.js";
import { fetchAuthStatus, logout } from "./lib/api.js";
import LoginGate from "./components/LoginGate.jsx";
import DriversDashboard from "./components/DriversDashboard.jsx";
import VehiclesDashboard from "./components/VehiclesDashboard.jsx";
import WarehousesDashboard from "./components/WarehousesDashboard.jsx";

// Her yeni modül burada bir TABS girdisi + activeDashboard'da bir dal alır -
// barkod-okuyucu ERP'sindeki aynı desen. Henüz gruplama (Operasyon/
// Tanımlama) yok - sekme sayısı arttıkça eklenir.
const TABS = [
  { id: "vehicles", label: "Araçlar", icon: Truck },
  { id: "drivers", label: "Sürücüler", icon: Users },
  { id: "warehouses", label: "Depolar", icon: Warehouse },
];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState("vehicles");

  // Sürücüler tek yerden çekiliyor - hem Sürücüler ekranının kendisi hem de
  // Araçlar'ın "sürücü ata" seçicisi aynı listeyi kullanıyor.
  const { drivers, loading: driversLoading, error: driversError, addDriver, editDriver, removeDriver } =
    useDrivers(authenticated);

  useEffect(() => {
    fetchAuthStatus()
      .then(setAuthenticated)
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthChecked(true));
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-title">
          <Truck size={20} />
          <h1>Lojistik</h1>
        </div>
        <div className="app-header-actions">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="icon-btn" onClick={handleLogout} title="Çıkış yap">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${view === t.id ? "active" : ""}`}
            onClick={() => setView(t.id)}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </nav>

      {view === "vehicles" && <VehiclesDashboard drivers={drivers} />}
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
      {view === "warehouses" && <WarehousesDashboard />}
    </div>
  );
}
