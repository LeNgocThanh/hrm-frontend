import type { NoticeStatus, NoticeVisibility } from '@/lib/api/notices';

export const VI_STATUS: Record<NoticeStatus, string> = {
  draft: 'Nháp',
  published: 'Công bố',
  archived: 'Lưu trữ',
};

export const VI_VISIBILITY: Record<NoticeVisibility, string> = {
  public: 'Công khai',
  internal: 'Nội bộ',
};

// Tiện để render <option> / checkbox
export const STATUS_OPTIONS_VI = (Object.keys(VI_STATUS) as NoticeStatus[]).map(v => ({ value: v, label: VI_STATUS[v] }));
export const VIS_OPTIONS_VI = (Object.keys(VI_VISIBILITY) as NoticeVisibility[]).map(v => ({ value: v, label: VI_VISIBILITY[v] }));

export const VI_MISC = {
  pinned: 'Ghim',
  category: 'Danh mục',
  status: 'Trạng thái',
  visibility: 'Hiển thị',
  publishAt: 'Thời điểm công bố',
  expireAt: 'Hết hạn',
  edit: 'Sửa',
  delete: 'Xoá',
  createNew: 'Tạo mới',
  filter: 'Lọc',
  previousPage: 'Trang trước',
  nextPage: 'Trang sau',
  saved: 'Đã lưu',
  createdAt: 'Tạo lúc',
  updatedAt: 'Cập nhật lúc',
};
