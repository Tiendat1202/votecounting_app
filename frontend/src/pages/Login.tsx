import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const Login: React.FC = () => {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("123456");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  if (!loading && user) {
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/"} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      setBusy(true);
      await login(email, password);
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
      <form onSubmit={onSubmit} className="login-form">
        <label>Email</label>
        <input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" />
        <label>Mật khẩu</label>
        <input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" />
        <button type="submit" disabled={busy}>{busy ? "Đang đăng nhập..." : "Đăng nhập"}</button>
      </form>
    </div>
  );
};

export default Login;
