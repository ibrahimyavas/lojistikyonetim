import { useCallback, useEffect, useState } from "react";
import { fetchUsers, createUser, updateUser, deleteUser } from "../lib/api.js";

// Sadece Yönetici bu hook'u kullanan ekranı (UsersDashboard) görüyor -
// backend zaten /api/users'ı Yönetici-only yapıyor (worker/index.js
// ROUTE_GROUPS), burada ayrıca bir kontrol yok.
export function useUsers(enabled = true) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchUsers());
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

  const addUser = useCallback(
    async (user) => {
      await createUser(user);
      await reload();
    },
    [reload]
  );

  const editUser = useCallback(
    async (id, fields) => {
      await updateUser(id, fields);
      await reload();
    },
    [reload]
  );

  const removeUser = useCallback(
    async (id) => {
      const prev = users;
      setUsers((cur) => cur.filter((u) => u.id !== id)); // optimistic
      try {
        await deleteUser(id);
      } catch (err) {
        setError(err.message);
        setUsers(prev);
      }
    },
    [users]
  );

  return { users, loading, error, addUser, editUser, removeUser };
}
