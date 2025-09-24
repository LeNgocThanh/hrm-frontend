import { LeaveType, LeaveStatus, LeaveUnit } from '../types/leave';

export const LT_STATUS: Record<LeaveType, string> = {
    PAID: 'Nghỉ có lương',
    UNPAID: 'Nghỉ không lương',
    SICK: 'Nghỉ ốm',
    MATERNITY: 'Nghỉ thai sản',
    COMPENSATORY: 'Nghỉ bù',
    OTHER: 'Khác',
};

export const LT_UNIT: Record<LeaveUnit, string> = {
    DAY: 'Ngày',
    HALF_DAY: 'Nửa ngày',
    HOUR: 'Giờ',
};

export const LR_STATUS: Record<LeaveStatus, string> = {
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Đã từ chối',
    cancelled: 'Đã hủy',
};

export const STATUS_OPTIONS_LT = (Object.keys(LT_STATUS) as LeaveType[]).map(v => ({ value: v, label: LT_STATUS[v] }));

export const UNIT_OPTIONS_LT = (Object.keys(LT_UNIT) as LeaveUnit[]).map(v => ({ value: v, label: LT_UNIT[v] }));

export const LEAVE_STATUS_OPTIONS = (Object.keys(LR_STATUS) as LeaveStatus[]).map(v => ({ value: v, label: LR_STATUS[v] }));

