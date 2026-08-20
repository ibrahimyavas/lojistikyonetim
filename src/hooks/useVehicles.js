import { useCallback, useEffect, useState } from "react";
import { fetchVehicles, createVehicle, updateVehicle, deleteVehicle } from "../lib/api.js";

export function useVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
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
    reload();
  }, [reload]);

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
