import { useCallback, useEffect, useState } from "react";

// Print queue lives in localStorage, not D1 - printing is an inherently
// single-device/physical action (whichever machine is plugged into the
// printer), so there's no reason to round-trip it through the backend like
// the other dashboards' data.
const KEY = "lojistik:etiketKuyrugu:v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full/unavailable - not fatal
  }
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useLabelQueue() {
  const [items, setItems] = useState(() => load());

  useEffect(() => {
    save(items);
  }, [items]);

  const addItem = useCallback((item) => {
    setItems((prev) => [{ id: makeId(), adet: 1, ...item }, ...prev]);
  }, []);

  const updateCount = useCallback((id, adet) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, adet: Math.max(1, adet) } : it)));
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    if (!window.confirm("Etiket kuyruğu temizlensin mi?")) return;
    setItems([]);
  }, []);

  return { items, addItem, updateCount, removeItem, clearAll };
}
