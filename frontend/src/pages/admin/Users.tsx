import React, { useEffect, useMemo, useState } from "react";
import { deleteUserAccount, getUsers, updateUserRole, updateUserStatus, type UserRole, type UserStatus } from "../../api";
import { useAuth } from "../../context/AuthContext";
import "./Users.css";

type UserRow = {
  userId: string;
  fullName: string;
  workUnit?: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  approvedAt?: string | null;
};

const STATUS_LABEL: Record<UserStatus, string> = {
  pending: "Chờ duyệt",
  active: "Đang hoạt động",
  rejected: "Đã từ chối",
};

const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được danh sách người dùng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((u) =>
      [u.fullName, u.email, u.workUnit, u.role, STATUS_LABEL[u.status]].join(" ").toLowerCase().includes(keyword)
    );
  }, [users, search]);

  const stats = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((u) => u.status === "pending").length,
      active: users.filter((u) => u.status === "active").length,
      user: users.filter((u) => u.role === "user").length,
    }),
    [users]
  );

  const handleStatus = async (userId: string, status: UserStatus) => {
    try {
      await updateUserStatus(userId, status);
      await loadUsers();
    } catch (e: any) {
      alert(e?.message || "Không cập nhật được người dùng");
    }
  };

  const handleRole = async (userId: string, role: UserRole) => {
    try {
      await updateUserRole(userId, role);
      await loadUsers();
    } catch (e: any) {
      alert(e?.message || "Không cập nhật được vai trò");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa người dùng này?")) return;
    try {
      await deleteUserAccount(userId);
      await loadUsers();
    } catch (e: any) {
      alert(e?.message || "Không xóa được người dùng");
    }
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1>Quản lý người dùng</h1>
          <p>Admin duyệt tài khoản người dùng. Vai trò inspector/supervisor sẽ được phân công riêng trong từng phiên.</p>
        </div>
        <button className="users-refresh" onClick={loadUsers}>
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      <div className="users-stats">
        <div className="users-stat-card"><span>Tổng người dùng</span><strong>{stats.total}</strong></div>
        <div className="users-stat-card"><span>Chờ duyệt</span><strong>{stats.pending}</strong></div>
        <div className="users-stat-card"><span>Đang hoạt động</span><strong>{stats.active}</strong></div>
        <div className="users-stat-card"><span>Người dùng</span><strong>{stats.user}</strong></div>
      </div>

      <div className="users-search-wrap">
        <input
          className="users-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo họ tên, email, vai trò hoặc trạng thái"
        />
      </div>

      {error && <div className="users-error">{error}</div>}

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Họ và tên</th>
              <th>Email</th>
              <th>Đơn vị công tác</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày đăng ký</th>
              <th>Ngày duyệt</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="users-empty">
                  Không có người dùng phù hợp.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.userId}>
                  <td className="users-name">{user.fullName || "—"}</td>
                  <td>{user.email}</td>
                  <td>{user.workUnit || "—"}</td>
                  <td className="users-role">{user.role}</td>
                  <td>
                    <span className={`users-status users-status--${user.status}`}>{STATUS_LABEL[user.status]}</span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleString("vi-VN")}</td>
                  <td>{user.approvedAt ? new Date(user.approvedAt).toLocaleString("vi-VN") : "—"}</td>
                  <td>
                    <div className="users-actions">
                      {user.status === "pending" && user.role !== "admin" && (
                        <button onClick={() => handleStatus(user.userId, "active")} className="users-btn users-btn--approve">
                          Duyệt
                        </button>
                      )}
                      {user.status === "pending" && user.role !== "admin" && (
                        <button onClick={() => handleStatus(user.userId, "rejected")} className="users-btn users-btn--reject">
                          Từ chối
                        </button>
                      )}
                      {user.role !== "admin" && user.status === "active" && (
                        <button onClick={() => handleRole(user.userId, "admin")} className="users-btn users-btn--promote">
                          Cấp admin
                        </button>
                      )}
                      {user.role === "admin" && (
                        <button
                          onClick={() => handleRole(user.userId, "user")}
                          className="users-btn users-btn--demote"
                          disabled={user.userId === currentUser?.userId}
                          title={user.userId === currentUser?.userId ? "Không thể tự hạ quyền" : "Thu hồi quyền admin"}
                        >
                          Thu hồi admin
                        </button>
                      )}
                      {user.role !== "admin" && (
                        <button onClick={() => handleDelete(user.userId)} className="users-btn users-btn--delete">
                          Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
