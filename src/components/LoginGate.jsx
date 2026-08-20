import { useState } from "react";
import { Lock } from "lucide-react";
import { login } from "../lib/api.js";

// Tek giriş formu, üç rol: Kullanıcı adı boş bırakılırsa ana şifreyle
// (Yönetici, eski davranış) girilir; doluysa ya bir web kullanıcısı
// (Yönetici/Operatör, worker/users.js'te tanımlı) ya da bir sürücü kodu
// (Şoför - Android app'teki AYNI kod+PIN) olarak çözülür - bkz.
// worker/auth.js. Hangisi olduğunu burada seçmeye gerek yok, sunucu
// çözüyor.
export default function LoginGate({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(username.trim(), password);
      onSuccess({ role: result.role, id: result.id ?? null });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-gate">
      <form className="login-card" onSubmit={handleSubmit}>
        <Lock size={28} />
        <h2>Lojistik</h2>
        <input
          type="text"
          placeholder="Kullanıcı adı / Sürücü kodu (opsiyonel)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Şifre / PIN"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Kontrol ediliyor…" : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}
