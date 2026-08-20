import { useCallback, useEffect, useState } from "react";
import { fetchDrivers, createDriver, updateDriver, deleteDriver } from "../lib/api.js";

// `enabled` lets App.jsx defer the fetch until after login (bkz.
// useProducts - barkod-okuyucu'daki aynı desen), bir çıkış yapılmamış
// ziyaretçi hiç 401'e mahkum bir istek yapmasın diye.
export function useDrivers(enabled = true) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDrivers(await fetchDrivers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reload]);

  const addDriver = useCallback(
    async (driver) => {
      await createDriver(driver);
      await reload();
    },
    [reload]
  );

  const editDriver = useCallback(
    async (id, fields) => {
      await updateDriver(id, fields);
      await reload();
    },
    [reload]
  );

  const removeDriver = useCallback(
    async (id) => {
      const prev = drivers;
      setDrivers((cur) => cur.filter((d) => d.id !== id)); // optimistic
      try {
        await deleteDriver(id);
      } catch (err) {
        setError(err.message);
        setDrivers(prev);
      }
    },
    [drivers]
  );

  return { drivers, loading, error, addDriver, editDriver, removeDriver };
}
