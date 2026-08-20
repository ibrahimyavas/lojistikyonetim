import { useCallback, useEffect, useState } from "react";
import { fetchShipments, createShipment, updateShipment, deleteShipment } from "../lib/api.js";

export function useShipments() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setShipments(await fetchShipments());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addShipment = useCallback(
    async (shipment) => {
      await createShipment(shipment);
      await reload();
    },
    [reload]
  );

  // Full reload rather than optimistic merge - the server may derive
  // gerceklesenTarih (auto-filling "today" on teslim_edildi), so the
  // client's guess of the new row would be wrong until it re-fetches anyway.
  const updateOne = useCallback(
    async (id, fields) => {
      await updateShipment(id, fields);
      await reload();
    },
    [reload]
  );

  const removeShipment = useCallback(
    async (id) => {
      const prev = shipments;
      setShipments((cur) => cur.filter((s) => s.id !== id)); // optimistic
      try {
        await deleteShipment(id);
      } catch (err) {
        setError(err.message);
        setShipments(prev);
      }
    },
    [shipments]
  );

  return { shipments, loading, error, addShipment, updateOne, removeShipment };
}
