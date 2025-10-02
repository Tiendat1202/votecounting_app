import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Context
import { AuthProvider } from "./context/AuthContext.tsx";

// Navbar
import Navbar from "./components/Navbar";

// User pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Results from "./pages/Results.tsx";

// Admin pages
//import Dashboard from "./pages/admin/Dashboard";
import CreateSession from "./pages/admin/CreateSession";
import Sessions from "./pages/admin/Sessions";
//import ManageSession from "./pages/admin/ManageSession";

// Common
//import NotFound from "./pages/NotFound";
<nav
  style={{
    background: "#1e3a8a", // xanh navy
    padding: "12px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "white",
    fontWeight: "bold",
  }}
>
  <div>VoteCounting</div>
  <div style={{ display: "flex", gap: "16px" }}>
    <a href="/" style={{ color: "white", textDecoration: "none" }}>Home</a>
    <a href="/results" style={{ color: "white", textDecoration: "none" }}>Kết quả</a>
    <a href="/dashboard" style={{ color: "white", textDecoration: "none" }}>Dashboard</a>
    <a href="/create-session" style={{ color: "white", textDecoration: "none" }}>Tạo phiên</a>
    <a href="/manage" style={{ color: "white", textDecoration: "none" }}>Quản lý</a>
    <a href="/stats" style={{ color: "white", textDecoration: "none" }}>Thống kê</a>
  </div>
  <button
    style={{
      background: "#ef4444",
      border: "none",
      color: "white",
      padding: "6px 12px",
      borderRadius: "6px",
      cursor: "pointer",
    }}
  >
    Logout
  </button>
</nav>


function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <div className="p-6">
          <Routes>
            {/* User routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/results" element={<Results />} />

            {/* Admin routes */}
            {/*<Route path="/admin" element={<Dashboard />} />*/}
            <Route path="/admin/create" element={<CreateSession />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/results/:id" element={<Sessions />} />
            {/*<Route path="/admin/manage" element={<ManageSession />} />*/}

            {/* 404 */}
            {/*<Route path="*" element={<NotFound />} />*/}
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
