export const AT_STATUS: Record<string, string> = {
    PRESENT: 'Hiện tại',
    ABSENT: 'Vắng',
    LATE: 'Đi muộn',
    EARLY_LEAVE: 'Về sớm',
    HOLIDAY: 'Ngày lễ',
    LEAVE: 'Ngày nghỉ',
    FULL: 'Làm Full',
    HALF_AM: 'Nửa ngày sáng',
    HALF_PM: 'Nửa ngày chiều',
    PARTIAL: 'Đi làm',
    OT: 'Tăng ca',
    OFF: 'Ngày nghỉ không lương',   
};

export const STATUS_OPTIONS_AT = (Object.keys(AT_STATUS) as string[]).map(v => ({ value: v, label: AT_STATUS[v] }));