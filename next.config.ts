import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Cảnh báo: Điều này cho phép build sản phẩm thành công ngay cả khi
    // dự án của bạn có lỗi ESLint.
    // Tắt kiểm tra ESLint chỉ khi bạn biết mình đang làm gì.
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: [
    "http://192.168.88.19",
    "http://192.168.88.19:4000",
    "http://192.168.88.19:3000", 
    "http://localhost:4000",
    "http://localhost:3000",  
  ],
  /* config options here */
};

export default nextConfig;
