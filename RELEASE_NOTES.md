# VoteCounting App - Bản cập nhật phân quyền + tiện ích quản trị

## Tính năng đã có từ bản trước
- Phân quyền `admin / inspector / supervisor`
- Admin duyệt, từ chối, xóa người dùng
- Chỉ chủ phiên mới được upload phiếu và sửa kết quả
- Inspector khác có thể gửi yêu cầu quyền tới chủ phiên

## Cập nhật mới trong bản này
- Thêm **họ và tên** khi đăng ký tài khoản
- Hiển thị **họ và tên** ở navbar, màn hình admin quản lý người dùng, danh sách phiên và yêu cầu tham gia phiên
- Thêm **bộ lọc danh sách phiên** theo:
  - từ khóa tìm kiếm
  - trạng thái phiên
  - loại phiếu
  - phạm vi truy cập của người dùng
- Thêm **trang chi tiết phiên** để:
  - xem lại toàn bộ thông tin phiên
  - xem danh sách ứng viên
  - xem quy tắc số lượng cần bầu / % tối thiểu trúng cử
  - chuyển nhanh sang trang kết quả hoặc upload
  - **đóng phiên sớm** nếu là chủ phiên hoặc admin
- Sau khi tạo phiên xong sẽ chuyển thẳng tới **trang chi tiết phiên**
- Database mẫu đã được cập nhật thêm cột cho họ tên và thông tin đóng phiên sớm

## Tài khoản admin mặc định
- Email: `admin@vote.local`
- Password: `Admin@123456`
- Họ tên hiển thị: `Quản trị hệ thống`

## Cách chạy
```bash
./setup.sh
./start_all.sh
```

## Ghi chú
- Nếu máy local chưa có dependency native cho SQLite, script `setup.sh` sẽ cài lại `sqlite3`.
- Bản zip phát hành đã được rút gọn để dễ tải về. Sau khi giải nén, hãy chạy `./setup.sh` để cài dependency mới.
