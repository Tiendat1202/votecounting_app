# UI refresh v3

Các thay đổi chính:
- Trang Kết quả: ẩn khu vực duyệt tay khi chưa đăng nhập, thêm empty state "Hiện chưa có kết quả", bổ sung biểu đồ và leaderboard ứng viên.
- Trang Tạo phiên: làm lại bố cục, nhấn mạnh tiêu đề, đồng bộ kích thước và khoảng cách các ô nhập.
- Trang Upload phiếu: thu gọn khối chọn phiên, hiển thị metadata gọn hơn, làm lại hộp nhắc quyền truy cập.
- Trang Quản lý người dùng: đồng bộ font và card/table style với toàn hệ thống.
- Dashboard: bỏ hẳn phần số phiếu đã upload, thay bằng biểu đồ cơ cấu loại phiếu và danh sách phiên gần đây.
- Danh sách phiên: làm lại card thống kê và bộ lọc để đồng bộ giao diện.
- Global layout: gỡ các style mặc định của Vite gây lệch bố cục, đồng bộ navbar và spacing.

Cách chạy:
1. Giải nén file zip
2. Chạy `./setup.sh`
3. Chạy `./start_all.sh`
