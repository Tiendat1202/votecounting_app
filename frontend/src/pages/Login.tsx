import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const Login: React.FC = () => {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  // Load saved credentials on mount
  useEffect(() => {
    const saved = localStorage.getItem("vc_saved_login");
    if (saved) {
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRemember(true);
      } catch {
        // Invalid saved data, use defaults
      }
    }
  }, []);

  // Nếu đã đăng nhập rồi thì chuyển hướng luôn
  if (!loading && user) {
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/"} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password, remember);
      
      // Save credentials if "Remember Me" checked
      if (remember) {
        localStorage.setItem("vc_saved_login", JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem("vc_saved_login");
      }
      
      nav("/admin/dashboard", { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-container">
      <h1>Đăng nhập</h1>

      {err && <div className="alert-error">{err}</div>}

      <form onSubmit={onSubmit} className="login-form" noValidate>
        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          required
        />

        <label>Mật khẩu</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="••••••"
          required
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Nhớ đăng nhập
        </label>

        <button type="submit" disabled={busy}>
          {busy ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <div className="login-footer">
        <span>Quên mật khẩu? (Liên hệ quản trị viên)</span>
      </div>
    </div>
  );
};

export default Login;