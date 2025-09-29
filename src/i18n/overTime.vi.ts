export const CompensationType_STATUS: Record<string, string> = {
    PAY: 'Tính công',
    TIME_OFF: 'Nghỉ bù',    
};

export const OverTimeKind_STATUS: Record<string, string> = {
    WEEKDAY: 'Ngày thường',
    WEEKEND: 'Cuối tuần',
    HOLIDAY: 'Ngày lễ',
};

export const Status_STATUS: Record<string, string> = {
    pending: 'Đang chờ',
    approved: 'Đã duyệt',
    rejected: 'Đã từ chối',
    cancelled: 'Đã huỷ',
};

export const VI_CompensationType = (Object.keys(CompensationType_STATUS) as string[]).map(v => ({ value: v, label: CompensationType_STATUS[v] }));
export const VI_OverTimeKind = (Object.keys(OverTimeKind_STATUS) as string[]).map(v => ({ value: v, label: OverTimeKind_STATUS[v] }));
export const VI_Status = (Object.keys(Status_STATUS) as string[]).map(v => ({ value: v, label: Status_STATUS[v] }));