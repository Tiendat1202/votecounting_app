import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";

// Context
import { AuthProvider } from "./context/AuthContext";

// Navbar
import Navbar from "./components/Navbar";

// Public pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Results from "./pages/Results";

// Admin pages
import Dashboard from "./pages/admin/Dashboard";
import Sessions from "./pages/admin/Sessions";
import CreateSession from "./pages/admin/CreateSession";
import UploadVotes from "./pages/admin/UploadVotes";

// --------- Inline guard: RequireAuth (bảo vệ trang admin) ----------
import { useAuth } from "./context/AuthContext";
function RequireAuth({ role }: { role?: "admin" | "user" }) {
  const { user, loading } = useAuth();
  if (loading) return null; // hoặc spinner
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}

// --------- 404 đơn giản ----------
const NotFound = () => <div style={{ padding: 24 }}>Trang không tồn tại.</div>;

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />

        <div className="p-6">
          <Routes>
            {/* PUBLIC */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/results" element={<Results />} />

            {/* ADMIN (bảo vệ bằng RequireAuth) */}
            <Route element={<RequireAuth role="admin" />}>
              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/sessions" element={<Sessions />} />
              <Route path="/admin/create-session" element={<CreateSession />} />
              <Route path="/admin/upload" element={<UploadVotes />} />
              <Route path="/admin/upload/:id" element={<UploadVotes />} />
              <Route path="/admin/results/:id" element={<Results />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
