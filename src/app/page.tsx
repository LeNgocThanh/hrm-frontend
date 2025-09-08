import Link from 'next/link';

const features = [  
  {
    title: 'Xem và tìm kiếm nhân sự',
    description: 'Xem cơ cấu tổ chức công ty và tìm kiếm người dùng',
    href: '/basic-view/organization-structure',
    icon: '👥',
    color: 'bg-purple-500'
  },
  {
    title: 'Quản lý tài sản',
    description: 'Thông tin tài sản',
    href: '/basic-view/asset',
    icon: '💼',
    color: 'bg-blue-500'
  },
  {
    title: 'Phòng họp, lịch họp',
    description: 'Phòng họp, lịch họp',
    href: '/roomMeetings/dashboard',
    icon: '📅',
    color: 'bg-blue-500'
  }
];

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Hệ thống quản trị doanh nghiệp
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Giải pháp toàn diện cho việc quản lý nhân sự và tổ chức doanh nghiệp
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
        {features.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <div className={`inline-flex items-center justify-center w-12 h-12 ${feature.color} text-white rounded-lg mb-4`}>
              <span className="text-2xl">{feature.icon}</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600">
              {feature.title}
            </h3>
            <p className="text-gray-600">
              {feature.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

