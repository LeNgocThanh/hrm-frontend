// utils/date-helpers.ts

export interface DayOfWeek {
    key: string; // '1' (Thứ 2) đến '6' (Thứ 7), '0' (Chủ Nhật)
    name: string; // 'Thứ 2', 'Thứ 3', ...
}

/**
 * Mảng hằng số chứa thông tin các ngày trong tuần, ánh xạ với index của JavaScript Date (0=CN, 1=T2,...).
 */
export const DAYS_OF_WEEK: DayOfWeek[] = [
    { key: '0', name: 'Chủ Nhật' }, // Date.getDay() = 0
    { key: '1', name: 'Thứ 2' },    // Date.getDay() = 1
    { key: '2', name: 'Thứ 3' },    // Date.getDay() = 2
    { key: '3', name: 'Thứ 4' },    // Date.getDay() = 3
    { key: '4', name: 'Thứ 5' },    // Date.getDay() = 4
    { key: '5', name: 'Thứ 6' },    // Date.getDay() = 5
    { key: '6', name: 'Thứ 7' },    // Date.getDay() = 6
];

export const SESSION_CODES: string[] = ['AM', 'PM', 'OV'];


// ------------------------------------------------------------------
// HÀM CHUYỂN ĐỔI TỪ ĐỐI TƯỢNG DATE HOẶC CHUỖI DATE
// ------------------------------------------------------------------

/**
 * Lấy tên thứ tiếng Việt (Thứ 2, Chủ Nhật,...) từ một đối tượng Date hoặc chuỗi ngày tháng.
 * @param dateInput Đối tượng Date hoặc chuỗi ngày tháng hợp lệ (ISO, YYYY-MM-DD, v.v.)
 * @returns Tên thứ tiếng Việt (string)
 */
export function getDayNameFromDate(dateInput: Date | string): string {
    let dateObj: Date;

    // 1. Chuyển đổi đầu vào thành đối tượng Date
    if (typeof dateInput === 'string') {
        // Xử lý chuỗi ngày tháng để tránh lỗi múi giờ nếu chỉ cung cấp ngày (VD: "2025-10-22")
        // Thêm "T00:00:00" để đảm bảo nó được đọc như UTC, sau đó convert sang giờ địa phương
        const safeDateString = dateInput.includes('T') ? dateInput : `${dateInput}T00:00:00`;
        dateObj = new Date(safeDateString);
    } else {
        dateObj = dateInput;
    }

    // 2. Lấy chỉ mục ngày trong tuần (0=CN, 1=T2, ..., 6=T7)
    // Cần kiểm tra ngày hợp lệ
    if (isNaN(dateObj.getTime())) {
        return 'Ngày không hợp lệ';
    }

    const dayIndex = dateObj.getDay(); // Trả về 0 cho Chủ Nhật, 1 cho Thứ 2, ...
    
    // 3. Tìm tên thứ tương ứng trong mảng DAYS_OF_WEEK
    // Lưu ý: key của DAYS_OF_WEEK bây giờ đã được ánh xạ với dayIndex: '0' cho CN, '1' cho T2.
    const day = DAYS_OF_WEEK.find(d => d.key === dayIndex.toString());

    return day ? day.name : 'Không xác định';
}