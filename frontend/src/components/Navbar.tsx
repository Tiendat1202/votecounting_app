import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { role, logout } = useAuth();

  return (
  <nav className="navbar" aria-label="Thanh điều hướng">
    <div className="nav-inner">
      {/* Logo */}
      <div className="logo">
        <Link to="/" aria-label="Trang chủ VoteCounting">VoteCounting</Link>
      </div>

      {/* Menu */}
      <ul className="menu" role="menubar">
        <li role="none">
          <Link role="menuitem" to="/">Trang chủ</Link>
        </li>
        <li role="none">
          <Link role="menuitem" to="/results">Kết quả</Link>
        </li>

        {role === "admin" && (
          <>
            <li role="none">
              <Link role="menuitem" to="/admin/create">Tạo phiên</Link>
            </li>
            <li role="none">
              <Link role="menuitem" to="/admin/upload">Tải phiếu</Link>
            </li>
          </>
        )}
      </ul>

      {/* Login/Logout */}
      <div className="auth">
        {role ? (
          <button onClick={logout} className="btn-logout" aria-label="Đăng xuất">
            Logout
          </button>
        ) : (
          <Link to="/login" className="btn-login" aria-label="Đăng nhập">
            Login
          </Link>
        )}
      </div>
    </div>
  </nav>
);
}