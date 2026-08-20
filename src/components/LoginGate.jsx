import { useState } from "react";
import { Lock } from "lucide-react";
import { login } from "../lib/api.js";

export default function LoginGate({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
      onSuccess();
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
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Kontrol ediliyor…" : "Giriş Yap"}
        </button>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0", textAlign: "center" }}>
          Varsayılan şifre: <code style={{ color: "var(--accent)" }}>admin</code>
        </p>
      </form>
    </div>
  );
}
