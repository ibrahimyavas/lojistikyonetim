import { useCallback, useEffect, useState } from "react";
import { fetchPallets, createPallet, updatePallet, deletePallet, fetchPalletMovements } from "../lib/api.js";

// Sunucu paletleri zaten FIFO sırasıyla (en eski üretim tarihi önce) döner
// (bkz. worker/pallets.js listPallets) - burada tekrar sıralamıyoruz.
export function usePallets() {
  const [pallets, setPallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPallets(await fetchPallets());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addPallet = useCallback(
    async (pallet) => {
      await createPallet(pallet);
      await reload();
    },
    [reload]
  );

  // Mal çıkış/bölüm transferi worker tarafında otomatik hareket kaydı
  // oluşturuyor (bkz. worker/pallets.js updatePallet) - tam reload bu
  // yüzden de doğru, zone doluluğu da aynı anda güncel kalıyor.
  const editPallet = useCallback(
    async (id, fields) => {
      await updatePallet(id, fields);
      await reload();
    },
    [reload]
  );

  const removePallet = useCallback(
    async (id) => {
      const prev = pallets;
      setPallets((cur) => cur.filter((p) => p.id !== id)); // optimistic
      try {
        await deletePallet(id);
      } catch (err) {
        setError(err.message);
        setPallets(prev);
      }
    },
    [pallets]
  );

  return { pallets, loading, error, addPallet, editPallet, removePallet, fetchMovements: fetchPalletMovements };
}
