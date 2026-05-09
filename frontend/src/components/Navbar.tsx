import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  user: "Người dùng",
};

export default function Navbar() {
  const { role, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch {
      navigate("/");
    }
  };

  return (
    <nav className="navbar" aria-label="Thanh điều hướng">
      <div className="nav-inner">
        <div className="logo">
          <Link to="/" aria-label="Trang chủ VoteCounting">VoteCounting</Link>
        </div>

        <ul className="menu" role="menubar">
          <li role="none"><Link role="menuitem" to="/">Trang chủ</Link></li>
          <li role="none"><Link role="menuitem" to="/results">Kết quả</Link></li>

          {role && (
            <li role="none"><Link role="menuitem" to="/admin/sessions">Danh sách phiên</Link></li>
          )}

          {(role === "admin" || role === "user") && (
            <li role="none"><Link role="menuitem" to="/admin/create-session">Tạo phiên</Link></li>
          )}

          {role === "admin" && (
            <>
              <li role="none"><Link role="menuitem" to="/admin/users">Người dùng</Link></li>
              <li role="none"><Link role="menuitem" to="/admin/dashboard">Dashboard</Link></li>
            </>
          )}
        </ul>

        <div className="auth" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {role ? (
            <>
              <div style={{ textAlign: "right", fontSize: 12, color: "#cbd5e1" }}>
                <div style={{ fontWeight: 700 }}>{user?.fullName || user?.email}</div>
                <div>{user?.email}</div>
                <div style={{ fontWeight: 700 }}>{ROLE_LABEL[role]}</div>
              </div>
              <button onClick={handleLogout} className="btn-logout" aria-label="Đăng xuất">Đăng xuất</button>
            </>
          ) : (
            <>
              <Link to="/register" className="btn-login" aria-label="Đăng ký">Đăng ký</Link>
              <Link to="/login" className="btn-login" aria-label="Đăng nhập">Đăng nhập</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
