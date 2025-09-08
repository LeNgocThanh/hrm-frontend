export function fmt(dt: string | Date, locale = 'vi-VN', tz = 'Asia/Bangkok') {
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(d);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export function now() { return new Date(); }
