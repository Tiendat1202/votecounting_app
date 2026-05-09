import React, { useEffect, useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const HOME_BY_ROLE = {
  admin: "/admin/dashboard",
  user: "/admin/sessions",
} as const;

const Login: React.FC = () => {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("admin@vote.local");
  const [password, setPassword] = useState("Admin@123456");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("vc_saved_login");
    if (saved) {
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRemember(true);
      } catch {
        // ignore invalid saved data
      }
    }
  }, []);

  if (!loading && user) {
    return <Navigate to={HOME_BY_ROLE[user.role] || "/"} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password, remember);
      const savedUser = JSON.parse(localStorage.getItem("user") || "null");
      nav(HOME_BY_ROLE[savedUser?.role as keyof typeof HOME_BY_ROLE] || "/", { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-container">
      <h1>Đăng nhập</h1>
      <p style={{ color: "#64748b", marginBottom: 16 }}>
        Admin dùng tài khoản seed sẵn. Người dùng cần được admin duyệt trước khi đăng nhập.
      </p>

      {err && <div className="alert-error">{err}</div>}

      <form onSubmit={onSubmit} className="login-form" noValidate>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required />

        <label>Mật khẩu</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Nhớ đăng nhập
        </label>

        <button type="submit" disabled={busy}>
          {busy ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <div className="login-footer" style={{ display: "grid", gap: 8 }}>
        <span>Chưa có tài khoản? <Link to="/register">Đăng ký tài khoản</Link></span>
        <span>Tài khoản admin mặc định: <strong>admin@vote.local / Admin@123456</strong></span>
      </div>
    </div>
  );
};

export default Login;
