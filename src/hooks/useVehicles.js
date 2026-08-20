import { useCallback, useEffect, useState } from "react";
import { fetchVehicles, createVehicle, updateVehicle, deleteVehicle } from "../lib/api.js";

// `enabled` lets App.jsx defer the fetch until after login (bkz. useDrivers).
export function useVehicles(enabled = true) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVehicles(await fetchVehicles());
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

  const addVehicle = useCallback(
    async (vehicle) => {
      await createVehicle(vehicle);
      await reload();
    },
    [reload]
  );

  const editVehicle = useCallback(
    async (id, fields) => {
      await updateVehicle(id, fields);
      await reload();
    },
    [reload]
  );

  const removeVehicle = useCallback(
    async (id) => {
      const prev = vehicles;
      setVehicles((cur) => cur.filter((v) => v.id !== id)); // optimistic
      try {
        await deleteVehicle(id);
      } catch (err) {
        setError(err.message);
        setVehicles(prev);
      }
    },
    [vehicles]
  );

  return { vehicles, loading, error, addVehicle, editVehicle, removeVehicle };
}
