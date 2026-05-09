import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api";
import "./Login.css";

const Register: React.FC = () => {
  const [fullName, setFullName] = useState("");
  const [workUnit, setWorkUnit] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMessage(null);

    if (!fullName.trim()) {
      setErr("Vui lòng nhập họ và tên");
      return;
    }

    if (!workUnit.trim()) {
      setErr("Vui lòng nhập đơn vị công tác");
      return;
    }

    if (password !== confirmPassword) {
      setErr("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      setBusy(true);
      const data = await registerUser(fullName, workUnit, email, password);
      setMessage(data?.message || "Đăng ký thành công. Vui lòng chờ admin duyệt.");
      setTimeout(() => nav("/login"), 1200);
    } catch (e: any) {
      setErr(e?.message || "Đăng ký thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-container">
      <h1>Đăng ký tài khoản</h1>
      <p style={{ color: "#64748b", marginBottom: 16 }}>
        Sau khi đăng ký, tài khoản sẽ ở trạng thái chờ admin duyệt. Vai trò inspector hoặc supervisor sẽ do chủ phiên phân công trong từng phiên.
      </p>

      {err && <div className="alert-error">{err}</div>}
      {message && <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "#dcfce7", color: "#166534" }}>{message}</div>}

      <form onSubmit={onSubmit} className="login-form" noValidate>
        <label>Họ và tên</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} type="text" placeholder="Ví dụ: Nguyễn Văn A" required />

        <label>Đơn vị công tác</label>
        <input value={workUnit} onChange={(e) => setWorkUnit(e.target.value)} type="text" placeholder="Ví dụ: UBND phường A" required />

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />

        <label>Mật khẩu</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} required />

        <label>Xác nhận mật khẩu</label>
        <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" minLength={6} required />

        <button type="submit" disabled={busy}>{busy ? "Đang đăng ký..." : "Đăng ký"}</button>
      </form>

      <div className="login-footer">
        <span>Đã có tài khoản? <Link to="/login">Quay lại đăng nhập</Link></span>
      </div>
    </div>
  );
};

export default Register;
