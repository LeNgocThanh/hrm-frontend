
'use client';

export default function ErrorPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fff1f0'
    }}>
      <h1 style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }}>Có lỗi xảy ra</h1>
      <h2 style={{ color: '#cf1322', marginBottom: 8 }}>Xin lỗi, đã có lỗi không mong muốn!</h2>
      <p style={{ color: '#888', marginBottom: 24 }}>Vui lòng thử lại hoặc liên hệ bộ phận kỹ thuật.</p>
      <a href="/" style={{
        color: '#1890ff',
        textDecoration: 'underline',
        fontWeight: 500
      }}>Quay về trang chủ</a>
    </div>
  );
}