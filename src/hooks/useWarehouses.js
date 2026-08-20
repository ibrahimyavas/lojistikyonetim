import { useCallback, useEffect, useState } from "react";
import { fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from "../lib/api.js";

// `enabled` lets App.jsx defer the fetch until after login (bkz. useDrivers).
export function useWarehouses(enabled = true) {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWarehouses(await fetchWarehouses());
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

  const addWarehouse = useCallback(
    async (warehouse) => {
      await createWarehouse(warehouse);
      await reload();
    },
    [reload]
  );

  const editWarehouse = useCallback(
    async (id, fields) => {
      await updateWarehouse(id, fields);
      await reload();
    },
    [reload]
  );

  const removeWarehouse = useCallback(
    async (id) => {
      const prev = warehouses;
      setWarehouses((cur) => cur.filter((w) => w.id !== id)); // optimistic
      try {
        await deleteWarehouse(id);
      } catch (err) {
        setError(err.message);
        setWarehouses(prev);
      }
    },
    [warehouses]
  );

  return { warehouses, loading, error, addWarehouse, editWarehouse, removeWarehouse };
}
