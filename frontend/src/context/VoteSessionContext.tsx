import React, { createContext, useContext, useState } from "react";

export interface Session {
  id: string;          // đồng bộ với CreateSession.tsx (string)
  name: string;
  type: string;        // "tin-nhiem" | "so-du"
  candidates: string[];
}

interface VoteSessionContextType {
  sessions: Session[];
  addSession: (session: Omit<Session, "id"> & { id?: string }) => void;
  removeSession: (id: string) => void;
  getSessionById: (id: string) => Session | undefined;
}

const VoteSessionContext = createContext<VoteSessionContextType | undefined>(undefined);

export const VoteSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Session[]>([]);

  // ✅ Thêm phiên
  const addSession = (session: Omit<Session, "id"> & { id?: string }) => {
    const newSession: Session = {
      id: session.id || Date.now().toString(), // nếu chưa có id thì tự tạo
      ...session,
    };
    setSessions((prev) => [...prev, newSession]);
  };

  // ✅ Xóa phiên
  const removeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // ✅ Lấy phiên theo ID
  const getSessionById = (id: string) => {
    return sessions.find((s) => s.id === id);
  };

  return (
    <VoteSessionContext.Provider value={{ sessions, addSession, removeSession, getSessionById }}>
      {children}
    </VoteSessionContext.Provider>
  );
};

export const useVoteSessions = () => {
  const context = useContext(VoteSessionContext);
  if (!context) throw new Error("useVoteSessions must be used within a VoteSessionProvider");
  return context;
};
