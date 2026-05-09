import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import RequireAuth from "./components/RequireAuth";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Results from "./pages/Results";
import Dashboard from "./pages/admin/Dashboard";
import Sessions from "./pages/admin/Sessions";
import CreateSession from "./pages/admin/CreateSession";
import SessionDetail from "./pages/admin/SessionDetail";
import UploadVotes from "./pages/admin/UploadVotes";
import Users from "./pages/admin/Users";
import { VoteCountingSession } from "./pages/VoteCountingSession";

const NotFound = () => <div style={{ padding: 24 }}>Trang không tồn tại.</div>;

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/results" element={<Results />} />
            <Route path="/admin/results/:id" element={<Results />} />

            <Route element={<RequireAuth roles={["admin"]} />}>
              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/users" element={<Users />} />
            </Route>

            <Route element={<RequireAuth roles={["admin", "user"]} />}>
              <Route path="/admin/sessions" element={<Sessions />} />
              <Route path="/admin/sessions/:id" element={<SessionDetail />} />
            </Route>

            <Route element={<RequireAuth roles={["admin", "user"]} />}>
              <Route path="/admin/create-session" element={<CreateSession />} />
              <Route path="/admin/upload" element={<UploadVotes />} />
              <Route path="/admin/upload/:id" element={<UploadVotes />} />
              <Route path="/vote-counting" element={<VoteCountingSession />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
