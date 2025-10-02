import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (role: "user" | "admin") => {
    login(role);
    navigate("/"); // sau khi login quay về Home
  };

  return (
    <div className="login-container">
      <h1 className="login-title">Đăng nhập hệ thống</h1>
      <div className="login-buttons">
        <button onClick={() => handleLogin("user")} className="btn btn-user">
          Login as User
        </button>
        <button onClick={() => handleLogin("admin")} className="btn btn-admin">
          Login as Admin
        </button>
      </div>
    </div>
  );
}
