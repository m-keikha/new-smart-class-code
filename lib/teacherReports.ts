import type { Attendance, ClassInfo, Course, Grade, Student } from '@/types';

export type AbsenceType = 'excused' | 'unexcused';

export interface AbsenceRecord {
  _id: string;
  date: string;
  displayFull: string;
  displayShort: string;
  absenceType: AbsenceType;
  sortKey: number;
}

export interface StudentAbsenceRow {
  student: Student;
  excused: AbsenceRecord[];
  unexcused: AbsenceRecord[];
}

export interface AcademicMonth {
  month: number; // Jalali month number (7=Mehr .. 12=Esfand, 1=Farvardin .. 3=Khordad)
  name: string;
}

export const ACADEMIC_MONTHS: readonly AcademicMonth[] = [
  { month: 7, name: 'مهر' },
  { month: 8, name: 'آبان' },
  { month: 9, name: 'آذر' },
  { month: 10, name: 'دی' },
  { month: 11, name: 'بهمن' },
  { month: 12, name: 'اسفند' },
  { month: 1, name: 'فروردین' },
  { month: 2, name: 'اردیبهشت' },
  { month: 3, name: 'خرداد' },
];

export type DescriptiveGrade =
  | 'خیلی خوب'
  | 'خوب'
  | 'قابل قبول'
  | 'نیاز به تلاش بیشتر';

export interface HalfMonthCell {
  month: number;
  half: 1 | 2;
  average: number | null;
  descriptive: DescriptiveGrade | null;
  count: number;
}

export interface ReportCardCourseRow {
  course: Course;
  cells: HalfMonthCell[]; // Always 18 cells: 9 months * 2 halves (Mehr..Khordad)
  overallAverage: number | null;
  overallDescriptive: DescriptiveGrade | null;
  totalGrades: number;
}

export interface StudentReportCard {
  student: Student;
  rows: ReportCardCourseRow[];
  overallAverage: number | null;
  overallDescriptive: DescriptiveGrade | null;
}

export interface CoursePerformanceRow {
  student: Student;
  average: number | null;
  gradeCount: number;
  descriptive: DescriptiveGrade | null;
  status: 'low' | 'pass' | 'none';
}

export interface StudentWithClassMeta {
  student: Student;
  teacherClass: ClassInfo;
  courses: Course[];
  grades: Grade[];
  attendance: Attendance[];
}

export interface AbsenceAlertRow {
  student: Student;
  teacherName: string;
  schoolName: string;
  className: string;
  gradeLevel: string;
  city: string;
  province: string;
  totalAbsences: number;
  excusedAbsences: number;
  unexcusedAbsences: number;
}

export interface LowScoreAlertRow {
  student: Student;
  courseName: string;
  courseAverage: number;
  gradeCount: number;
  descriptive: DescriptiveGrade;
  teacherName: string;
  schoolName: string;
  className: string;
  gradeLevel: string;
  city: string;
  province: string;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to Latin ASCII digits (0-9).
 */
export function toEnglishDigits(input: string): string {
  if (!input) return '';
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/**
 * Converts Latin ASCII digits (0-9) to Persian digits (۰-۹).
 */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * Normalizes Arabic character variants (ي / ك / ة / أ / إ) and trims whitespace
 * so Persian alphabetical sorting works accurately.
 */
export function normalizePersianText(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[أإ]/g, 'ا')
    .replace(/\u200c/g, ' ')
    .trim();
}

/**
 * Parses a Jalali (Shamsi) date string into { year, month, day } or null.
 */
export function parseJalaliDateParts(
  rawDate: string | undefined | null
): { year: number; month: number; day: number } | null {
  if (!rawDate) return null;
  const cleaned = toEnglishDigits(rawDate).trim();
  const parts = cleaned.split(/[\/\-\.\s]+/).filter(Boolean);
  if (parts.length < 3) return null;

  let year = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  if (year >= 0 && year < 100) {
    year += 1400;
  }

  return { year, month, day };
}

/**
 * Parses a Jalali (Shamsi) date string (in Persian, Arabic, or Latin digits)
 * into a comparable numeric key YYYYMMDD.
 * Returns Number.MAX_SAFE_INTEGER if unparseable so invalid dates sort to the end.
 */
export function parseJalaliDateKey(rawDate: string | undefined | null): number {
  const parts = parseJalaliDateParts(rawDate);
  if (!parts) return Number.MAX_SAFE_INTEGER;
  return parts.year * 10000 + parts.month * 100 + parts.day;
}

/**
 * Compares two Jalali date strings in ascending chronological order
 * (oldest first, newest last).
 */
export function compareJalaliDatesAsc(a: string, b: string): number {
  const keyA = parseJalaliDateKey(a);
  const keyB = parseJalaliDateKey(b);
  if (keyA !== keyB) return keyA - keyB;
  return toEnglishDigits(a).localeCompare(toEnglishDigits(b));
}

/**
 * Formats a Jalali date cleanly in Persian numerals.
 * - full: ۱۴۰۴/۰۸/۰۵
 * - short: ۰۴/۰۸/۰۵
 */
export function formatJalaliDate(
  rawDate: string,
  style: 'full' | 'short' = 'full'
): string {
  const parts = parseJalaliDateParts(rawDate);
  if (!parts) return toPersianDigits(rawDate);

  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  const yyyy = style === 'short' ? String(parts.year).slice(-2) : String(parts.year);

  return toPersianDigits(`${yyyy}/${mm}/${dd}`);
}

/**
 * Sorts students alphabetically according to Persian collation.
 * Default sorts by lastName then firstName (standard Persian school register order).
 */
export function sortStudentsAlphabetically(
  students: Student[],
  sortBy: 'lastName' | 'firstName' = 'lastName'
): Student[] {
  const collator = new Intl.Collator('fa', { sensitivity: 'base' });
  return [...students].sort((a, b) => {
    const aFirst = normalizePersianText(a.firstName);
    const bFirst = normalizePersianText(b.firstName);
    const aLast = normalizePersianText(a.lastName);
    const bLast = normalizePersianText(b.lastName);

    if (sortBy === 'firstName') {
      const firstCmp = collator.compare(aFirst, bFirst);
      if (firstCmp !== 0) return firstCmp;
      return collator.compare(aLast, bLast);
    }

    const lastCmp = collator.compare(aLast, bLast);
    if (lastCmp !== 0) return lastCmp;
    return collator.compare(aFirst, bFirst);
  });
}

/**
 * Resolves the absence type, defaulting legacy records without absenceType to 'unexcused'.
 */
export function resolveAbsenceType(
  record: Pick<Attendance, 'absenceType'>
): AbsenceType {
  return record.absenceType === 'excused' ? 'excused' : 'unexcused';
}

/**
 * Maps a numeric grade (0-20) to its Iranian descriptive scale:
 * - 0 .. 9.99: نیاز به تلاش بیشتر
 * - 10 .. 14.99: قابل قبول
 * - 15 .. 17.99: خوب
 * - 18 .. 20: خیلی خوب
 */
export function getScoreDescriptiveLabel(score: number): DescriptiveGrade {
  if (score >= 18) return 'خیلی خوب';
  if (score >= 15) return 'خوب';
  if (score >= 10) return 'قابل قبول';
  return 'نیاز به تلاش بیشتر';
}

/**
 * Maps a descriptive grade to its compact numeric code:
 * - خیلی خوب -> 1
 * - خوب -> 2
 * - قابل قبول -> 3
 * - نیاز به تلاش بیشتر -> 4
 */
export function getDescriptiveNumericCode(
  label: DescriptiveGrade
): '1' | '2' | '3' | '4' {
  switch (label) {
    case 'خیلی خوب':
      return '1';
    case 'خوب':
      return '2';
    case 'قابل قبول':
      return '3';
    case 'نیاز به تلاش بیشتر':
      return '4';
  }
}

/**
 * Formats a descriptive grade cell as either full Persian label or compact Persian digit code (۱-۴).
 */
export function formatDescriptiveCellValue(
  label: DescriptiveGrade | null,
  useCompactCodes: boolean
): string {
  if (!label) return '';
  if (!useCompactCodes) return label;
  return toPersianDigits(getDescriptiveNumericCode(label));
}

/**
 * Filters records (students, courses, homeworks) by active grade level.
 * Backward compatibility: items without a `level` (legacy DB documents) are shown in ALL grade levels.
 */
export function filterByActiveLevel<T extends { level?: string | null }>(
  items: T[],
  activeLevel: string | null | undefined
): T[] {
  if (!activeLevel || activeLevel === 'ALL') return items;
  const target = normalizePersianText(activeLevel);
  if (!target) return items;

  return items.filter((item) => {
    const itemLevel = normalizePersianText(item.level);
    if (!itemLevel) return true; // Legacy record without level -> visible in every level
    return itemLevel === target;
  });
}

/**
 * Computes deduplicated list of grade levels for a teacher from classInfo + existing students/courses.
 */
export function resolveTeacherLevels(
  classInfo: Partial<ClassInfo> | null | undefined,
  students: Student[] = [],
  courses: Course[] = []
): string[] {
  const seen = new Map<string, string>();
  const add = (val?: string | null) => {
    const raw = (val || '').trim();
    const norm = normalizePersianText(raw);
    if (norm && !seen.has(norm)) {
      seen.set(norm, raw);
    }
  };

  if (classInfo?.gradeLevel) add(classInfo.gradeLevel);
  if (Array.isArray(classInfo?.gradeLevels)) {
    for (const lvl of classInfo.gradeLevels) add(lvl);
  }
  for (const s of students) add(s.level);
  for (const c of courses) add(c.level);

  return Array.from(seen.values());
}

/**
 * Builds ordered absence rows for all students.
 * Each student's excused and unexcused absences are sorted ascending by Jalali date
 * (index 0 = oldest date -> rightmost column in RTL table; last index = newest date).
 */
export function buildStudentAbsenceRows(
  students: Student[],
  attendance: Attendance[],
  sortBy: 'lastName' | 'firstName' = 'lastName'
): StudentAbsenceRow[] {
  const sortedStudents = sortStudentsAlphabetically(students, sortBy);

  const byStudent = new Map<string, Attendance[]>();
  for (const record of attendance) {
    if (record.status && record.status !== 'absent') continue;
    const sid = String(record.studentId);
    const list = byStudent.get(sid);
    if (list) {
      list.push(record);
    } else {
      byStudent.set(sid, [record]);
    }
  }

  return sortedStudents.map((student) => {
    const records = byStudent.get(String(student._id)) || [];
    const excused: AbsenceRecord[] = [];
    const unexcused: AbsenceRecord[] = [];

    for (const rec of records) {
      const type = resolveAbsenceType(rec);
      const item: AbsenceRecord = {
        _id: String(rec._id),
        date: rec.date,
        displayFull: formatJalaliDate(rec.date, 'full'),
        displayShort: formatJalaliDate(rec.date, 'short'),
        absenceType: type,
        sortKey: parseJalaliDateKey(rec.date),
      };
      if (type === 'excused') {
        excused.push(item);
      } else {
        unexcused.push(item);
      }
    }

    excused.sort((a, b) => compareJalaliDatesAsc(a.date, b.date));
    unexcused.sort((a, b) => compareJalaliDatesAsc(a.date, b.date));

    return {
      student,
      excused,
      unexcused,
    };
  });
}

/**
 * Builds a full academic-year report card (Mehr to Khordad, each month split into 1st half [days 1-15]
 * and 2nd half [days 16-31]) for a student.
 * Half-months with no recorded grades stay null (blank cells).
 */
export function buildStudentReportCard(
  student: Student,
  courses: Course[],
  grades: Grade[]
): StudentReportCard {
  const studentGrades = grades.filter(
    (g) => String(g.studentId) === String(student._id) && typeof g.score === 'number'
  );

  const rows: ReportCardCourseRow[] = courses.map((course) => {
    const courseGrades = studentGrades.filter(
      (g) => String(g.courseId) === String(course._id)
    );

    const bucketMap = new Map<string, number[]>();
    for (const g of courseGrades) {
      const parsed = parseJalaliDateParts(g.date);
      if (!parsed) continue;
      const half: 1 | 2 = parsed.day <= 15 ? 1 : 2;
      const key = `${parsed.month}-${half}`;
      const arr = bucketMap.get(key);
      if (arr) {
        arr.push(g.score);
      } else {
        bucketMap.set(key, [g.score]);
      }
    }

    const cells: HalfMonthCell[] = [];
    for (const m of ACADEMIC_MONTHS) {
      for (const half of [1, 2] as const) {
        const scores = bucketMap.get(`${m.month}-${half}`);
        if (!scores || scores.length === 0) {
          cells.push({
            month: m.month,
            half,
            average: null,
            descriptive: null,
            count: 0,
          });
        } else {
          const avg = Number(
            (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(2)
          );
          cells.push({
            month: m.month,
            half,
            average: avg,
            descriptive: getScoreDescriptiveLabel(avg),
            count: scores.length,
          });
        }
      }
    }

    const overallAverage =
      courseGrades.length > 0
        ? Number(
            (
              courseGrades.reduce((sum, g) => sum + g.score, 0) /
              courseGrades.length
            ).toFixed(2)
          )
        : null;

    return {
      course,
      cells,
      overallAverage,
      overallDescriptive:
        overallAverage !== null ? getScoreDescriptiveLabel(overallAverage) : null,
      totalGrades: courseGrades.length,
    };
  });

  const overallAverage =
    studentGrades.length > 0
      ? Number(
          (
            studentGrades.reduce((sum, g) => sum + g.score, 0) /
            studentGrades.length
          ).toFixed(2)
        )
      : null;

  return {
    student,
    rows,
    overallAverage,
    overallDescriptive:
      overallAverage !== null ? getScoreDescriptiveLabel(overallAverage) : null,
  };
}

/**
 * Builds printable per-course student performance rows for the Management dashboard.
 * Students with average < 10 are flagged 'low' (red), >= 10 flagged 'pass' (green).
 */
export function buildCoursePerformanceRows(
  students: Student[],
  grades: Grade[],
  courseId: string
): CoursePerformanceRow[] {
  const sorted = sortStudentsAlphabetically(students, 'lastName');
  return sorted.map((student) => {
    const courseGrades = grades.filter(
      (g) =>
        String(g.studentId) === String(student._id) &&
        String(g.courseId) === String(courseId) &&
        typeof g.score === 'number'
    );
    if (courseGrades.length === 0) {
      return {
        student,
        average: null,
        gradeCount: 0,
        descriptive: null,
        status: 'none',
      };
    }

    const avg = Number(
      (
        courseGrades.reduce((sum, g) => sum + g.score, 0) / courseGrades.length
      ).toFixed(2)
    );
    return {
      student,
      average: avg,
      gradeCount: courseGrades.length,
      descriptive: getScoreDescriptiveLabel(avg),
      status: avg < 10 ? 'low' : 'pass',
    };
  });
}

/**
 * Filters students whose total absences strictly exceed maxAllowedAbsences.
 */
export function filterStudentsByAbsenceThreshold(
  items: StudentWithClassMeta[],
  maxAllowedAbsences: number
): AbsenceAlertRow[] {
  const results: AbsenceAlertRow[] = [];

  for (const { student, teacherClass, attendance } of items) {
    const studentAbsences = attendance.filter(
      (a) =>
        String(a.studentId) === String(student._id) &&
        (!a.status || a.status === 'absent')
    );

    if (studentAbsences.length > maxAllowedAbsences) {
      let excused = 0;
      let unexcused = 0;
      for (const a of studentAbsences) {
        if (resolveAbsenceType(a) === 'excused') excused += 1;
        else unexcused += 1;
      }

      results.push({
        student,
        teacherName: teacherClass.teacherName || 'ثبت نشده',
        schoolName: teacherClass.schoolName || 'ثبت نشده',
        className: teacherClass.className || '—',
        gradeLevel: student.level || teacherClass.gradeLevel || 'ثبت نشده',
        city: teacherClass.city || 'ثبت نشده',
        province: teacherClass.province || 'ثبت نشده',
        totalAbsences: studentAbsences.length,
        excusedAbsences: excused,
        unexcusedAbsences: unexcused,
      });
    }
  }

  return results.sort((a, b) => b.totalAbsences - a.totalAbsences);
}

/**
 * Filters students who have any course with an average strictly below minScoreThreshold.
 */
export function filterStudentsByLowScore(
  items: StudentWithClassMeta[],
  minScoreThreshold: number
): LowScoreAlertRow[] {
  const results: LowScoreAlertRow[] = [];

  for (const { student, teacherClass, courses, grades } of items) {
    const studentGrades = grades.filter(
      (g) =>
        String(g.studentId) === String(student._id) && typeof g.score === 'number'
    );
    if (studentGrades.length === 0) continue;

    const courseNameById = new Map<string, string>();
    for (const c of courses) {
      courseNameById.set(String(c._id), c.name);
    }

    const byCourse = new Map<string, number[]>();
    for (const g of studentGrades) {
      const cid = String(g.courseId);
      const list = byCourse.get(cid);
      if (list) list.push(g.score);
      else byCourse.set(cid, [g.score]);
    }

    for (const [cid, scores] of byCourse.entries()) {
      const avg = Number(
        (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(2)
      );
      if (avg < minScoreThreshold) {
        results.push({
          student,
          courseName: courseNameById.get(cid) || 'درس نامشخص',
          courseAverage: avg,
          gradeCount: scores.length,
          descriptive: getScoreDescriptiveLabel(avg),
          teacherName: teacherClass.teacherName || 'ثبت نشده',
          schoolName: teacherClass.schoolName || 'ثبت نشده',
          className: teacherClass.className || '—',
          gradeLevel: student.level || teacherClass.gradeLevel || 'ثبت نشده',
          city: teacherClass.city || 'ثبت نشده',
          province: teacherClass.province || 'ثبت نشده',
        });
      }
    }
  }

  return results.sort((a, b) => a.courseAverage - b.courseAverage);
}

export interface AbsenceVisualRow {
  key: string;
  studentIndex: number; // 1-based student index in class
  student: Student;
  chunkIndex: number; // 0-based row chunk for this student
  totalChunksForStudent: number;
  isFirstInPageGroup: boolean;
  rowSpanOnPage: number;
  isContinuationFromPrevPage: boolean;
  excusedSlots: (AbsenceRecord | null)[];
  unexcusedSlots: (AbsenceRecord | null)[];
}

export interface AbsenceReportPageData {
  pageNumber: number; // 1-based
  rows: AbsenceVisualRow[];
}

/**
 * Expands students whose excused or unexcused absences exceed `slotsPerType`
 * onto additional continuation rows, then paginates visual rows across pages
 * of up to `maxVisualRowsPerPage` rows without splitting a student's rows
 * unnecessarily across a page break.
 */
export function expandAndPaginateAbsenceRows(
  studentRows: StudentAbsenceRow[],
  slotsPerType: number,
  maxVisualRowsPerPage: number
): AbsenceReportPageData[] {
  const safeSlots = Math.max(1, Math.floor(slotsPerType));
  const safeMaxRows = Math.max(1, Math.floor(maxVisualRowsPerPage));

  if (studentRows.length === 0) return [];

  interface RawChunk {
    key: string;
    studentIndex: number;
    student: Student;
    chunkIndex: number;
    totalChunksForStudent: number;
    excusedSlots: (AbsenceRecord | null)[];
    unexcusedSlots: (AbsenceRecord | null)[];
  }

  const studentGroups: RawChunk[][] = studentRows.map((row, idx) => {
    const chunkCount = Math.max(
      1,
      Math.ceil(row.excused.length / safeSlots),
      Math.ceil(row.unexcused.length / safeSlots)
    );

    const chunks: RawChunk[] = [];
    for (let c = 0; c < chunkCount; c++) {
      const start = c * safeSlots;
      const excusedSlots: (AbsenceRecord | null)[] = Array.from(
        { length: safeSlots },
        (_, i) => row.excused[start + i] ?? null
      );
      const unexcusedSlots: (AbsenceRecord | null)[] = Array.from(
        { length: safeSlots },
        (_, i) => row.unexcused[start + i] ?? null
      );

      chunks.push({
        key: `${row.student._id}-chunk-${c}`,
        studentIndex: idx + 1,
        student: row.student,
        chunkIndex: c,
        totalChunksForStudent: chunkCount,
        excusedSlots,
        unexcusedSlots,
      });
    }
    return chunks;
  });

  const rawPages: RawChunk[][] = [];
  let currentPage: RawChunk[] = [];

  for (const group of studentGroups) {
    if (group.length <= safeMaxRows) {
      if (currentPage.length > 0 && currentPage.length + group.length > safeMaxRows) {
        rawPages.push(currentPage);
        currentPage = [];
      }
      currentPage.push(...group);
    } else {
      // Student has more continuation rows than fit on a single page: fill page by page
      if (currentPage.length > 0) {
        rawPages.push(currentPage);
        currentPage = [];
      }
      for (const chunk of group) {
        if (currentPage.length >= safeMaxRows) {
          rawPages.push(currentPage);
          currentPage = [];
        }
        currentPage.push(chunk);
      }
    }
  }

  if (currentPage.length > 0) {
    rawPages.push(currentPage);
  }

  return rawPages.map((pageChunks, pageIdx) => {
    const visualRows: AbsenceVisualRow[] = [];
    let i = 0;
    while (i < pageChunks.length) {
      const currentStudentId = pageChunks[i].student._id;
      let span = 1;
      while (
        i + span < pageChunks.length &&
        pageChunks[i + span].student._id === currentStudentId
      ) {
        span++;
      }

      for (let k = 0; k < span; k++) {
        const chunk = pageChunks[i + k];
        visualRows.push({
          ...chunk,
          isFirstInPageGroup: k === 0,
          rowSpanOnPage: k === 0 ? span : 0,
          isContinuationFromPrevPage: k === 0 && chunk.chunkIndex > 0,
        });
      }
      i += span;
    }

    return {
      pageNumber: pageIdx + 1,
      rows: visualRows,
    };
  });
}
