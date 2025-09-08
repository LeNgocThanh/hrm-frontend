export default function UnauthorizedPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fffbe6'
    }}>
      <h1 style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }}>403</h1>
      <h2 style={{ color: '#d48806', marginBottom: 8 }}>Bạn không có quyền truy cập trang này</h2>
      <p style={{ color: '#888', marginBottom: 24 }}>Vui lòng liên hệ quản trị viên nếu bạn cần quyền truy cập.</p>
      <a href="/" style={{
        color: '#1890ff',
        textDecoration: 'underline',
        fontWeight: 500
      }}>Quay về trang chủ</a>
    </div>
  );
}