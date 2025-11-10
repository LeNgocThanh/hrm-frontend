export const AT_STATUS: Record<string, string> = {
    PRESENT: 'Hiện tại',
    ABSENT: 'Vắng',
    LATE: 'Đi muộn',
    EARLY_LEAVE: 'Về sớm',
    HOLIDAY: 'Ngày lễ',
    LEAVE: 'Ngày nghỉ',
    FULL: 'Đi làm',
    HALF_AM: 'Nửa ngày sáng',
    HALF_PM: 'Nửa ngày chiều',
    PARTIAL: 'Làm một phần',
    OVERTIME: 'Tăng ca',
};

export const STATUS_OPTIONS_AT = (Object.keys(AT_STATUS) as string[]).map(v => ({ value: v, label: AT_STATUS[v] }));