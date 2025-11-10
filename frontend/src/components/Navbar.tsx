import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { role, logout } = useAuth();
  const navigate = useNavigate(); // 👈 thêm dòng này

  const handleLogout = async () => {
    try {
      await logout();              // xoá cookie, clear state
      navigate("/");               // 👈 chuyển về trang chủ
    } catch (e) {
      console.error("Lỗi khi logout:", e);
      navigate("/");               // fallback vẫn về trang chủ
    }
  };

  return (
    <nav className="navbar" aria-label="Thanh điều hướng">
      <div className="nav-inner">
        {/* Logo */}
        <div className="logo">
          <Link to="/" aria-label="Trang chủ VoteCounting">
            VoteCounting
          </Link>
        </div>

        {/* Menu */}
        <ul className="menu" role="menubar">
          <li role="none">
            <Link role="menuitem" to="/">
              Trang chủ
            </Link>
          </li>
          <li role="none">
            <Link role="menuitem" to="/results">
              Kết quả
            </Link>
          </li>

          {role === "admin" && (
            <>
              <li role="none">
                <Link role="menuitem" to="/admin/create-session">
                  Tạo phiên
                </Link>
              </li>
              <li role="none">
                <Link role="menuitem" to="/admin/sessions">
                  Quản lý phiên
                </Link>
              </li>
              <li role="none">
                <Link role="menuitem" to="/admin/upload">
                  Tải phiếu
                </Link>
              </li>
              <li role="none">
                <Link role="menuitem" to="/admin/dashboard">
                  Dashboard
                </Link>
              </li>
            </>
          )}
        </ul>

        {/* Login / Logout */}
        <div className="auth">
          {role ? (
            <button
              onClick={handleLogout}      // 👈 đổi sang gọi hàm handleLogout
              className="btn-logout"
              aria-label="Đăng xuất"
            >
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
