import { useCallback, useEffect, useState } from "react";
import { fetchProducts, createProduct, updateProduct, deleteProduct } from "../lib/api.js";

// `enabled` lets App.jsx defer the fetch until after login (bkz. useDrivers).
export function useProducts(enabled = true) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await fetchProducts());
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

  const addProduct = useCallback(
    async (product) => {
      await createProduct(product);
      await reload();
    },
    [reload]
  );

  const editProduct = useCallback(
    async (id, fields) => {
      await updateProduct(id, fields);
      await reload();
    },
    [reload]
  );

  const removeProduct = useCallback(
    async (id) => {
      const prev = products;
      setProducts((cur) => cur.filter((p) => p.id !== id)); // optimistic
      try {
        await deleteProduct(id);
      } catch (err) {
        setError(err.message);
        setProducts(prev);
      }
    },
    [products]
  );

  return { products, loading, error, addProduct, editProduct, removeProduct };
}
