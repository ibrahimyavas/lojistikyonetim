import { useCallback, useEffect, useState } from "react";
import { LogOut, Moon, Sun, Truck } from "lucide-react";
import { useTheme } from "./hooks/useTheme.js";
import { fetchAuthStatus, logout } from "./lib/api.js";
import LoginGate from "./components/LoginGate.jsx";

// Skeleton only for now - barkod-okuyucu'daki auth/tema iskeletiyle birebir
// aynı desen (kanıtlanmış). Araç/sürücü/sevkiyat modülleri şema tasarımı
// netleştikçe buraya eklenecek (bkz. README.md).
export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

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

      <main className="dashboard">
        <p className="empty-state">
          Giriş çalışıyor. Sıradaki adım: araç/sürücü/sevkiyat şemasını tasarlayıp ilk modülü eklemek.
        </p>
      </main>
    </div>
  );
}
