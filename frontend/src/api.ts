// src/api.ts
const API_BASE = "http://localhost:5050/api";

/** AUTH */
export const login = async (email: string, password: string, remember = false) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, remember }), // 👈 thêm remember
  });
  if (!res.ok) throw new Error((await res.json()).message || "Đăng nhập thất bại");
  return await res.json();
};

export const getMe = async () => {
  const res = await fetch(`${API_BASE}/auth/me`, {
    credentials: "include",                 // 👈 COOKIE
  });
  if (!res.ok) throw new Error((await res.json()).message || "Chưa đăng nhập");
  return await res.json();
};

export const logoutApi = async () => {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",                 // 👈 COOKIE
  });
  if (!res.ok) throw new Error("Đăng xuất lỗi");
  return await res.json();
};


/* ===========================
   🔹 PHIÊN KIỂM PHIẾU
   =========================== */
export const getSessions = async () => {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error("Lỗi khi tải danh sách phiên");
  return await res.json();
};

export const createSession = async (session: any) => {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  if (!res.ok) throw new Error("Lỗi khi tạo phiên");
  return await res.json();
};

/* ===========================
   🔹 THỐNG KÊ DASHBOARD
   =========================== */
export const getStats = async () => {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error("Lỗi khi tải thống kê");
  return await res.json();
};

/* ===========================
   🔹 UPLOAD ẢNH THẬT
   =========================== */
export const uploadVoteFiles = async (sessionId: string, files: File[]) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await fetch(`${API_BASE}/uploads/${sessionId}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Lỗi khi upload ảnh");
  return await res.json();
};

/* ===========================
   🔹 LẤY DANH SÁCH ẢNH ĐÃ UPLOAD
   =========================== */
export const getUploadedFiles = async (sessionId: string) => {
  const res = await fetch(`${API_BASE}/uploads/${sessionId}`);
  if (!res.ok) throw new Error("Lỗi khi tải danh sách ảnh");
  return await res.json();
};

/* ===========================
   🔹 KIỂM TRA SỨC KHỎE SERVER
   =========================== */
export const getHealth = async () => {
  const res = await fetch(`${API_BASE}/health`);
  return await res.json();
};

/* ===========================
   🔹 XOÁ ẢNH TRÊN SERVER
   =========================== */
export const deleteUploadedFile = async (sessionId: string, filename: string) => {
  const res = await fetch(`http://localhost:5050/api/uploads/${sessionId}/${filename}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Không thể xóa ảnh");
  return await res.json();
};

export const deleteAllUploadedFiles = async (sessionId: string) => {
  const res = await fetch(`http://localhost:5050/api/uploads/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Không thể xóa toàn bộ ảnh");
  return await res.json();
};
