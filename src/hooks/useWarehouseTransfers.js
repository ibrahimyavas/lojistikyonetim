import { useCallback, useEffect, useState } from "react";
import {
  fetchWarehouseTransfers,
  createWarehouseTransfer,
  updateWarehouseTransfer,
  deleteWarehouseTransfer,
} from "../lib/api.js";

export function useWarehouseTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTransfers(await fetchWarehouseTransfers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addTransfer = useCallback(
    async (transfer) => {
      await createWarehouseTransfer(transfer);
      await reload();
    },
    [reload]
  );

  const updateOne = useCallback(
    async (id, fields) => {
      const prev = transfers;
      setTransfers((cur) => cur.map((t) => (t.id === id ? { ...t, ...fields } : t))); // optimistic
      try {
        await updateWarehouseTransfer(id, fields);
      } catch (err) {
        setError(err.message);
        setTransfers(prev);
      }
    },
    [transfers]
  );

  const removeTransfer = useCallback(
    async (id) => {
      const prev = transfers;
      setTransfers((cur) => cur.filter((t) => t.id !== id)); // optimistic
      try {
        await deleteWarehouseTransfer(id);
      } catch (err) {
        setError(err.message);
        setTransfers(prev);
      }
    },
    [transfers]
  );

  return { transfers, loading, error, addTransfer, updateOne, removeTransfer };
}
