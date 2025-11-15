import React, { createContext, useContext, useEffect, useState } from "react";
import { getMe, login as apiLogin, logoutApi } from "../api";

type User = { id: string; email: string; role: "admin" | "user" };
type AuthCtx = {
  user: User | null;
  role: User["role"] | null;
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

  // giữ phiên nếu có cookie
  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string, remember = false) => {
  const me = await apiLogin(email, password, remember);
  setUser(me);
};

  const logout = async () => {
    await logoutApi();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, role: user?.role ?? null, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
