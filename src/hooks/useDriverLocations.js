import { useCallback, useEffect, useState } from "react";
import { fetchDriverLocations } from "../lib/api.js";

// "Gerçek zamanlı ama çok yoğun değil" (İbrahim'in tarifi) - sürekli bir
// WebSocket/Durable Object bağlantısı yerine 30 saniyede bir otomatik
// yenileme yeterli. Sadece bu ekran açıkken çalışır (component unmount
// olunca interval temizleniyor) - arka planda gereksiz istek atmıyor.
const POLL_MS = 30000;

export function useDriverLocations(enabled = true) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLocations(await fetchDriverLocations());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
    const interval = setInterval(reload, POLL_MS);
    return () => clearInterval(interval);
  }, [enabled, reload]);

  return { locations, loading, error, reload };
}
