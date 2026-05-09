import React, { createContext, useContext, useEffect, useState } from "react";
import { getMe, login as apiLogin, logoutApi, type UserRole, type UserStatus } from "../api";

export type User = {
  userId: string;
  fullName: string;
  workUnit?: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  approvedAt?: string | null;
};

type AuthCtx = {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  role: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refreshMe: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    const me = await getMe();
    setUser(me);
    localStorage.setItem("user", JSON.stringify(me));
  };

  useEffect(() => {
    (async () => {
      try {
        const savedToken = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

        if (savedToken && savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            await refreshMe();
          } catch {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string, remember = false) => {
    const response = await apiLogin(email, password, remember);
    const userData = response.user || response;
    setUser(userData);
    localStorage.setItem("token", response.token);
    localStorage.setItem("user", JSON.stringify(userData));
    if (remember) {
      localStorage.setItem("vc_saved_login", JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem("vc_saved_login");
    }
  };

  const logout = async () => {
    try {
      await logoutApi();
    } finally {
      setUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("vc_saved_login");
    }
  };

  return (
    <Ctx.Provider value={{ user, role: user?.role || null, loading, login, logout, refreshMe }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
