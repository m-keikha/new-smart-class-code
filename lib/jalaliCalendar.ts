import type { Homework, TeacherEvent } from '@/types';
import {
  normalizePersianText,
  parseJalaliDateKey,
  toEnglishDigits,
  toPersianDigits,
} from './teacherReports';

export interface JalaliDateParts {
  jy: number;
  jm: number; // 1..12
  jd: number; // 1..31
}

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const PERSIAN_WEEKDAY_SHORT = [
  'ش',
  'ی',
  'د',
  'س',
  'چ',
  'پ',
  'ج',
] as const;

/**
 * Standard algorithmic Gregorian -> Jalali conversion (Kazimierz M. Borkowski / Jalaali-JS).
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDateParts {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    gdm[gm - 1];

  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }

  return { jy, jm, jd };
}

/**
 * Standard algorithmic Jalali -> Gregorian conversion.
 */
export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number
): { gy: number; gm: number; gd: number } {
  const jyAdj = jy + 1595;
  let days =
    -355668 +
    365 * jyAdj +
    Math.floor(jyAdj / 33) * 8 +
    Math.floor(((jyAdj % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;
  const isGregLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const salA = [0, 31, isGregLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  while (gm <= 12 && gd > salA[gm]) {
    gd -= salA[gm];
    gm++;
  }

  return { gy, gm, gd };
}

export function isJalaliLeapYear(jy: number): boolean {
  const { gy, gm, gd } = jalaliToGregorian(jy, 12, 30);
  const back = gregorianToJalali(gy, gm, gd);
  return back.jy === jy && back.jm === 12 && back.jd === 30;
}

export function getJalaliMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/**
 * Returns Saturday-first weekday index (0 = Saturday, 1 = Sunday, ..., 6 = Friday).
 */
export function getJalaliMonthFirstWeekday(jy: number, jm: number): number {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, 1);
  const jsWeekday = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay(); // 0=Sun..6=Sat
  return (jsWeekday + 1) % 7;
}

export function formatJalaliDateAscii(parts: JalaliDateParts): string {
  const y = String(parts.jy).padStart(4, '0');
  const m = String(parts.jm).padStart(2, '0');
  const d = String(parts.jd).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export function formatJalaliDatePersian(dateStr: string): string {
  const parsed = parseJalaliParts(dateStr);
  if (!parsed) return toPersianDigits(dateStr);
  return toPersianDigits(formatJalaliDateAscii(parsed));
}

export function formatJalaliLongLabel(dateStr: string): string {
  const parsed = parseJalaliParts(dateStr);
  if (!parsed) return toPersianDigits(dateStr);
  const monthName = JALALI_MONTH_NAMES[parsed.jm - 1] || '';
  return `${toPersianDigits(parsed.jd)} ${monthName} ${toPersianDigits(parsed.jy)}`;
}

export function parseJalaliParts(dateStr?: string | null): JalaliDateParts | null {
  if (!dateStr) return null;
  const clean = toEnglishDigits(String(dateStr)).trim();
  const match = clean.match(/(\d{2,4})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})/);
  if (!match) return null;
  let jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jy < 100) jy += 1400;
  if (jm < 1 || jm > 12) return null;
  const maxDays = getJalaliMonthDays(jy, jm);
  if (jd < 1 || jd > maxDays) return null;
  return { jy, jm, jd };
}

export function getTodayJalaliParts(now: Date = new Date()): JalaliDateParts {
  // Use local calendar year/month/day to match user's system date
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function getTodayJalaliString(now: Date = new Date()): string {
  return formatJalaliDateAscii(getTodayJalaliParts(now));
}

export function addDaysToJalali(
  parts: JalaliDateParts,
  deltaDays: number
): JalaliDateParts {
  const { gy, gm, gd } = jalaliToGregorian(parts.jy, parts.jm, parts.jd);
  const utc = new Date(Date.UTC(gy, gm - 1, gd + deltaDays));
  return gregorianToJalali(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate()
  );
}

export function getTomorrowJalaliString(now: Date = new Date()): string {
  const today = getTodayJalaliParts(now);
  return formatJalaliDateAscii(addDaysToJalali(today, 1));
}

export function isSameJalaliDate(
  a?: string | null,
  b?: string | null
): boolean {
  const keyA = parseJalaliDateKey(a);
  const keyB = parseJalaliDateKey(b);
  if (keyA === Number.MAX_SAFE_INTEGER || keyB === Number.MAX_SAFE_INTEGER) {
    return false;
  }
  return keyA === keyB;
}

export function buildJalaliCalendarGrid(
  jy: number,
  jm: number
): Array<number | null> {
  const firstWeekday = getJalaliMonthFirstWeekday(jy, jm);
  const totalDays = getJalaliMonthDays(jy, jm);
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push(d);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function resolveHomeworkExpiryMs(hw: Homework): number | null {
  if (hw.expiresAt) {
    const parsed = Date.parse(String(hw.expiresAt));
    if (Number.isFinite(parsed)) return parsed;
  }
  if (
    typeof hw.displayDays === 'number' &&
    Number.isFinite(hw.displayDays) &&
    hw.displayDays > 0 &&
    hw.createdAt
  ) {
    const createdMs = Date.parse(String(hw.createdAt));
    if (Number.isFinite(createdMs)) {
      return createdMs + hw.displayDays * MS_PER_DAY;
    }
  }
  return null;
}

export function getHomeworkRemainingDays(
  hw: Homework,
  nowMs: number = Date.now()
): number | null {
  const expiryMs = resolveHomeworkExpiryMs(hw);
  if (expiryMs === null) return null;
  const diff = expiryMs - nowMs;
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / MS_PER_DAY));
}

/**
 * Filters homeworks visible to a specific student:
 * - Matches target ('ALL' or studentId)
 * - Matches level if both homework and student specify a level
 * - Excludes homeworks already completed by this student
 * - Excludes homeworks past their display window (expiresAt / createdAt + displayDays)
 * - Legacy homeworks without expiresAt/displayDays remain visible until student checks them off.
 */
export function filterVisibleStudentHomeworks(
  homeworks: Homework[],
  studentId: string,
  studentLevel?: string,
  nowMs: number = Date.now()
): Homework[] {
  const sid = String(studentId || '');
  const sLevelNorm = normalizePersianText(studentLevel);

  return (homeworks || []).filter((hw) => {
    const target = String(hw.target || 'ALL');
    if (target !== 'ALL' && target !== sid) {
      return false;
    }

    if (target === 'ALL') {
      const hwLevelNorm = normalizePersianText(hw.level);
      if (hwLevelNorm && sLevelNorm && hwLevelNorm !== sLevelNorm) {
        return false;
      }
    }

    if (Array.isArray(hw.completedBy) && hw.completedBy.map(String).includes(sid)) {
      return false;
    }

    const expiryMs = resolveHomeworkExpiryMs(hw);
    if (expiryMs !== null && nowMs > expiryMs) {
      return false;
    }

    return true;
  });
}

export function getTodayEvents(
  events: TeacherEvent[],
  todayJalali: string = getTodayJalaliString()
): TeacherEvent[] {
  return (events || []).filter((ev) => isSameJalaliDate(ev.date, todayJalali));
}

export function getEventTimingStatus(
  eventDate: string,
  todayJalali: string = getTodayJalaliString()
): 'today' | 'upcoming' | 'past' {
  const evKey = parseJalaliDateKey(eventDate);
  const todayKey = parseJalaliDateKey(todayJalali);
  if (evKey === todayKey) return 'today';
  if (evKey > todayKey) return 'upcoming';
  return 'past';
}

export function sortEventsForTeacher(
  events: TeacherEvent[],
  todayJalali: string = getTodayJalaliString()
): TeacherEvent[] {
  const rank = (ev: TeacherEvent) => {
    const st = getEventTimingStatus(ev.date, todayJalali);
    if (st === 'today') return 0;
    if (st === 'upcoming') return 1;
    return 2;
  };
  return [...(events || [])].sort((a, b) => {
    const rDiff = rank(a) - rank(b);
    if (rDiff !== 0) return rDiff;
    const keyA = parseJalaliDateKey(a.date);
    const keyB = parseJalaliDateKey(b.date);
    // Upcoming: nearest first; past: most recent first
    if (rank(a) === 2) return keyB - keyA;
    return keyA - keyB;
  });
}
