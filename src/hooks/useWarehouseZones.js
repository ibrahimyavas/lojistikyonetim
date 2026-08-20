import { useCallback, useEffect, useState } from "react";
import { fetchWarehouseZones, createWarehouseZone, updateWarehouseZone, deleteWarehouseZone } from "../lib/api.js";

// `enabled` lets App.jsx defer the fetch until after login (bkz. useDrivers).
export function useWarehouseZones(enabled = true) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setZones(await fetchWarehouseZones());
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

  const addZone = useCallback(
    async (zone) => {
      await createWarehouseZone(zone);
      await reload();
    },
    [reload]
  );

  // Doluluk (bkz. worker/warehouseZones.js) sunucuda paletlerden canlı
  // hesaplandığı için optimistic merge yerine tam reload - yerel bir tahmin
  // yanlış olurdu.
  const editZone = useCallback(
    async (id, fields) => {
      await updateWarehouseZone(id, fields);
      await reload();
    },
    [reload]
  );

  const removeZone = useCallback(
    async (id) => {
      const prev = zones;
      setZones((cur) => cur.filter((z) => z.id !== id)); // optimistic
      try {
        await deleteWarehouseZone(id);
      } catch (err) {
        setError(err.message);
        setZones(prev);
      }
    },
    [zones]
  );

  return { zones, loading, error, addZone, editZone, removeZone };
}
