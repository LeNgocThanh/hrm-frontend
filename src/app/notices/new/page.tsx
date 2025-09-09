import NoticeForm from '@/components/notice/NoticeAdminForm'

// Nếu bạn có hook lấy token từ AuthContext, truyền vào NoticeForm qua prop getToken
export default function NewNoticePage() {
  // Ví dụ: const { token } = useAuth() // (client-only) => nếu cần, chuyển file này thành 'use client'
  const getToken = undefined
  return (
    <div className="mx-auto max-w-5xl p-4">
      <NoticeForm getToken={getToken} />
    </div>
  )
}