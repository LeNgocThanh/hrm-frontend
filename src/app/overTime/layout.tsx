import '../globals.css';
import Link from 'next/link';

export const metadata = { title: 'Meeting Scheduler', description: 'Rooms & Meetings' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (   
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <nav className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6">
            <Link href="/overTime/approvals" className="font-semibold hover:opacity-80">Đăng ký chờ duyệt</Link>
            <Link href="/overTime/create" className="hover:opacity-80">Tạo đơn</Link>
            <Link href="/overTime/overView" className="hover:opacity-80">Tổng quan</Link>           
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>   
  );
}
