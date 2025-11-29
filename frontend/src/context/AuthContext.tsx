import React, { createContext, useContext, useEffect, useState } from "react";
import { getMe, login as apiLogin, logoutApi } from "../api";

type User = {
  userId: string;
  email: string;
  role: "admin" | "user" | "ADMIN" | "USER";
};

type AuthCtx = {
  user: User | null;
  role: "admin" | "user" | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  role: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user từ localStorage + verify token với backend
  useEffect(() => {
    (async () => {
      try {
        // Check localStorage first
        const savedToken = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

        if (savedToken && savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            
            // Verify token với server
            await getMe();
          } catch (err) {
            // Token invalid, clear
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Auth init error:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string, remember = false) => {
    try {
      const response = await apiLogin(email, password, remember);
      
      // Backend response format: { token, user: { userId, email, role } }
      const userData = response.user || response;
      
      setUser(userData);

      // Save to localStorage
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(userData));

      // Save credentials nếu remember = true
      if (remember) {
        localStorage.setItem("vc_saved_login", JSON.stringify({ email, password }));
      }
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("vc_saved_login");
    }
  };

  // Đảm bảo role luôn là chữ thường
  const role = user?.role ? (user.role.toLowerCase() as "admin" | "user") : null;

  return (
    <Ctx.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);