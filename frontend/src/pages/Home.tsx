import "./Home.css";
import { Link } from "react-router-dom"; // thêm import

export default function Home() {
  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <h1>Nền tảng kiểm phiếu đa định dạng</h1>
        <p>
          Đếm phiếu chính xác, minh bạch và trực quan bằng cách tích hợp mô hình
          thị giác - ngôn ngữ.
        </p>

        {/* đổi button thành Link */}
        <Link to="/results" className="btn-primary">
          Xem kết quả bầu cử
        </Link>
      </section>

      {/* Giới thiệu */}
      <section className="intro">
        <div className="card">
          <h2>Minh bạch</h2>
          <p>Kết quả hiển thị công khai, trực quan và dễ hiểu.</p>
        </div>
        <div className="card">
          <h2>Nhanh chóng</h2>
          <p>Kết quả kiểm phiếu được tổng hợp tức thì.</p>
        </div>
        <div className="card">
          <h2>Chính xác</h2>
          <p>Đảm bảo độ tin cậy cao trong quá trình kiểm phiếu.</p>
        </div>
      </section>
    </div>
  );
}
