import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACADEMIC_MONTHS,
  buildCoursePerformanceRows,
  buildStudentAbsenceRows,
  buildStudentReportCard,
  compareJalaliDatesAsc,
  expandAndPaginateAbsenceRows,
  filterByActiveLevel,
  filterStudentsByAbsenceThreshold,
  filterStudentsByLowScore,
  formatDescriptiveCellValue,
  formatJalaliDate,
  getDescriptiveNumericCode,
  getScoreDescriptiveLabel,
  parseJalaliDateKey,
  resolveAbsenceType,
  sortStudentsAlphabetically,
  toEnglishDigits,
  toPersianDigits,
} from './teacherReports';
import {
  DEFAULT_PROVINCE,
  SISTAN_BALUCHESTAN_CITIES,
  normalizeCityName,
} from './provinces';
import type { Attendance, ClassInfo, Course, Grade, Student } from '@/types';

test('converts Persian and Arabic digits cleanly', () => {
  assert.equal(toEnglishDigits('۱۴۰۴/۰۸/۰۵'), '1404/08/05');
  assert.equal(toEnglishDigits('١٤٠٤/٨/٥'), '1404/8/5');
  assert.equal(toPersianDigits('1404/08/05'), '۱۴۰۴/۰۸/۰۵');
});

test('parses and sorts Jalali dates chronologically from oldest to newest', () => {
  assert.equal(parseJalaliDateKey('۱۴۰۴/۸/۵'), 14040805);
  assert.equal(parseJalaliDateKey('1404/10/02'), 14041002);
  assert.equal(parseJalaliDateKey('04/7/1'), 14040701);

  const dates = ['۱۴۰۴/۱۰/۲', '1404/7/15', '۱۴۰۴/۷/۵', '1404/08/01', '۱۴۰۳/۱۲/۲۹'];
  const sorted = [...dates].sort(compareJalaliDatesAsc);
  assert.deepEqual(sorted, [
    '۱۴۰۳/۱۲/۲۹',
    '۱۴۰۴/۷/۵',
    '1404/7/15',
    '1404/08/01',
    '۱۴۰۴/۱۰/۲',
  ]);
});

test('formats Jalali dates into full and short Persian forms', () => {
  assert.equal(formatJalaliDate('1404/8/5', 'full'), '۱۴۰۴/۰۸/۰۵');
  assert.equal(formatJalaliDate('۱۴۰۴/۸/۵', 'short'), '۰۴/۰۸/۰۵');
});

test('sorts Persian student names alphabetically handling Arabic character variants', () => {
  const students: Student[] = [
    { _id: '1', firstName: 'مهدی', lastName: 'کیخا', nationalId: '1', fatherName: 'رضا' },
    { _id: '2', firstName: 'على', lastName: 'احمدي', nationalId: '2', fatherName: 'حسن' },
    { _id: '3', firstName: 'پارسا', lastName: 'بهرامی', nationalId: '3', fatherName: 'سعید' },
    { _id: '4', firstName: 'آرش', lastName: 'احمدی', nationalId: '4', fatherName: 'مجید' },
  ];

  const sortedByLast = sortStudentsAlphabetically(students, 'lastName');
  assert.deepEqual(
    sortedByLast.map((s) => `${s.firstName} ${s.lastName}`),
    ['آرش احمدی', 'على احمدي', 'پارسا بهرامی', 'مهدی کیخا']
  );
});

test('builds absence rows separating excused and unexcused oldest-first with unexcused default', () => {
  const students: Student[] = [
    { _id: 's1', firstName: 'رضا', lastName: 'کریمی', nationalId: '100', fatherName: 'علی' },
    { _id: 's2', firstName: 'امیر', lastName: 'احمدی', nationalId: '200', fatherName: 'حسین' },
  ];

  const attendance: Attendance[] = [
    { _id: 'a1', studentId: 's1', date: '۱۴۰۴/۹/۱۰', status: 'absent', absenceType: 'excused' },
    { _id: 'a2', studentId: 's1', date: '1404/07/02', status: 'absent', absenceType: 'excused' },
    { _id: 'a3', studentId: 's1', date: '۱۴۰۴/۱۰/۱', status: 'absent' }, // legacy -> unexcused
    { _id: 'a4', studentId: 's1', date: '1404/08/15', status: 'absent', absenceType: 'unexcused' },
  ];

  assert.equal(resolveAbsenceType({ absenceType: undefined }), 'unexcused');
  assert.equal(resolveAbsenceType({ absenceType: 'excused' }), 'excused');

  const rows = buildStudentAbsenceRows(students, attendance);
  assert.equal(rows[0].student._id, 's2');
  assert.equal(rows[0].excused.length, 0);
  assert.equal(rows[0].unexcused.length, 0);

  assert.equal(rows[1].student._id, 's1');
  assert.deepEqual(
    rows[1].excused.map((r) => r.displayFull),
    ['۱۴۰۴/۰۷/۰۲', '۱۴۰۴/۰۹/۱۰']
  );
  assert.deepEqual(
    rows[1].unexcused.map((r) => r.displayFull),
    ['۱۴۰۴/۰۸/۱۵', '۱۴۰۴/۱۰/۰۱']
  );
});

test('maps numeric scores to descriptive grades accurately across boundaries', () => {
  assert.equal(getScoreDescriptiveLabel(0), 'نیاز به تلاش بیشتر');
  assert.equal(getScoreDescriptiveLabel(9), 'نیاز به تلاش بیشتر');
  assert.equal(getScoreDescriptiveLabel(9.99), 'نیاز به تلاش بیشتر');
  assert.equal(getScoreDescriptiveLabel(10), 'قابل قبول');
  assert.equal(getScoreDescriptiveLabel(14.99), 'قابل قبول');
  assert.equal(getScoreDescriptiveLabel(15), 'خوب');
  assert.equal(getScoreDescriptiveLabel(17.99), 'خوب');
  assert.equal(getScoreDescriptiveLabel(18), 'خیلی خوب');
  assert.equal(getScoreDescriptiveLabel(20), 'خیلی خوب');
});

test('builds report card from Mehr to Khordad split into 1st and 2nd half with blank ungraded cells', () => {
  assert.equal(ACADEMIC_MONTHS.length, 9);
  assert.equal(ACADEMIC_MONTHS[0].name, 'مهر');
  assert.equal(ACADEMIC_MONTHS[8].name, 'خرداد');

  const student: Student = {
    _id: 'st1',
    firstName: 'آرش',
    lastName: 'احمدی',
    nationalId: '1234567890',
    fatherName: 'حسین',
  };
  const courses: Course[] = [
    { _id: 'c1', name: 'ریاضی' },
    { _id: 'c2', name: 'علوم' },
  ];
  const grades: Grade[] = [
    // Mehr 1st half (day 5 & 15) -> avg 19 -> خیلی خوب
    { _id: 'g1', studentId: 'st1', courseId: 'c1', score: 18, date: '۱۴۰۴/۷/۵' },
    { _id: 'g2', studentId: 'st1', courseId: 'c1', score: 20, date: '1404/07/15' },
    // Mehr 2nd half (day 20) -> 8 -> نیاز به تلاش بیشتر
    { _id: 'g3', studentId: 'st1', courseId: 'c1', score: 8, date: '1404/07/20' },
    // Khordad 2nd half (month 3, day 25) -> 16 -> خوب
    { _id: 'g4', studentId: 'st1', courseId: 'c1', score: 16, date: '۱۴۰۵/۳/۲۵' },
  ];

  const card = buildStudentReportCard(student, courses, grades);
  const mathRow = card.rows[0];
  assert.equal(mathRow.cells.length, 18);
  // Mehr half 1 = index 0
  assert.equal(mathRow.cells[0].average, 19);
  assert.equal(mathRow.cells[0].descriptive, 'خیلی خوب');
  // Mehr half 2 = index 1
  assert.equal(mathRow.cells[1].average, 8);
  assert.equal(mathRow.cells[1].descriptive, 'نیاز به تلاش بیشتر');
  // Aban half 1 = index 2 -> ungraded -> null
  assert.equal(mathRow.cells[2].average, null);
  assert.equal(mathRow.cells[2].descriptive, null);
  // Khordad half 2 = index 17
  assert.equal(mathRow.cells[17].average, 16);
  assert.equal(mathRow.cells[17].descriptive, 'خوب');
  // Overall math average: (18+20+8+16)/4 = 15.5 -> خوب
  assert.equal(mathRow.overallAverage, 15.5);
  assert.equal(mathRow.overallDescriptive, 'خوب');

  // Science has no grades -> all null
  assert.equal(card.rows[1].overallAverage, null);
  assert.equal(card.rows[1].overallDescriptive, null);
});

test('filters students by active grade level while showing legacy students without level everywhere', () => {
  const students: Student[] = [
    { _id: '1', firstName: 'علی', lastName: 'الف', nationalId: '1', fatherName: 'پ', level: 'هفتم' },
    { _id: '2', firstName: 'رضا', lastName: 'ب', nationalId: '2', fatherName: 'پ', level: 'هشتم' },
    { _id: '3', firstName: 'سعید', lastName: 'ج', nationalId: '3', fatherName: 'پ' }, // legacy without level
  ];

  const grade7 = filterByActiveLevel(students, 'هفتم');
  assert.deepEqual(
    grade7.map((s) => s._id),
    ['1', '3']
  );

  const grade8 = filterByActiveLevel(students, 'هشتم');
  assert.deepEqual(
    grade8.map((s) => s._id),
    ['2', '3']
  );
});

test('contains all 25 Sistan and Baluchestan cities sorted alphabetically in Persian', () => {
  assert.equal(DEFAULT_PROVINCE, 'سیستان و بلوچستان');
  assert.equal(SISTAN_BALUCHESTAN_CITIES.length, 25);
  assert.ok(SISTAN_BALUCHESTAN_CITIES.includes('میرجاوه'));
  assert.ok(SISTAN_BALUCHESTAN_CITIES.includes('زاهدان (مرکز استان)'));
  assert.equal(normalizeCityName('زاهدان (مرکز استان)'), 'زاهدان');

  const collator = new Intl.Collator('fa', { sensitivity: 'base' });
  for (let i = 1; i < SISTAN_BALUCHESTAN_CITIES.length; i++) {
    assert.ok(
      collator.compare(SISTAN_BALUCHESTAN_CITIES[i - 1], SISTAN_BALUCHESTAN_CITIES[i]) <= 0,
      `Expected ${SISTAN_BALUCHESTAN_CITIES[i - 1]} before ${SISTAN_BALUCHESTAN_CITIES[i]}`
    );
  }
});

test('management analytics filter absences (> threshold), low scores (< threshold), and course status (<10 red, >=10 green)', () => {
  const teacherClass: ClassInfo = {
    _id: 'cl1',
    className: 'هفتم الف',
    teacherName: 'استاد رضایی',
    schoolName: 'مدرسه شهید بهشتی',
    gradeLevel: 'هفتم',
    gradeLevels: ['هفتم'],
    province: 'سیستان و بلوچستان',
    city: 'میرجاوه',
    role: 'teacher',
  };
  const s1: Student = { _id: 's1', firstName: 'آرش', lastName: 'احمدی', nationalId: '1', fatherName: 'حسین', level: 'هفتم' };
  const s2: Student = { _id: 's2', firstName: 'مهدی', lastName: 'کیخا', nationalId: '2', fatherName: 'رضا', level: 'هفتم' };
  const courses: Course[] = [{ _id: 'c1', name: 'ریاضی' }];
  const grades: Grade[] = [
    { _id: 'g1', studentId: 's1', courseId: 'c1', score: 8, date: '1404/08/01' },
    { _id: 'g2', studentId: 's1', courseId: 'c1', score: 9, date: '1404/08/10' },
    { _id: 'g3', studentId: 's2', courseId: 'c1', score: 17, date: '1404/08/05' },
  ];
  const attendance: Attendance[] = [
    { _id: 'a1', studentId: 's1', date: '1404/08/01', status: 'absent', absenceType: 'unexcused' },
    { _id: 'a2', studentId: 's1', date: '1404/08/02', status: 'absent', absenceType: 'unexcused' },
    { _id: 'a3', studentId: 's1', date: '1404/08/03', status: 'absent', absenceType: 'excused' },
    { _id: 'a4', studentId: 's2', date: '1404/08/01', status: 'absent', absenceType: 'unexcused' },
  ];

  const courseRows = buildCoursePerformanceRows([s1, s2], grades, 'c1');
  assert.equal(courseRows[0].student._id, 's1');
  assert.equal(courseRows[0].average, 8.5);
  assert.equal(courseRows[0].gradeCount, 2);
  assert.equal(courseRows[0].status, 'low');

  assert.equal(courseRows[1].student._id, 's2');
  assert.equal(courseRows[1].average, 17);
  assert.equal(courseRows[1].gradeCount, 1);
  assert.equal(courseRows[1].status, 'pass');

  const meta = [
    { student: s1, teacherClass, courses, grades, attendance },
    { student: s2, teacherClass, courses, grades, attendance },
  ];

  const absenceAlerts = filterStudentsByAbsenceThreshold(meta, 2);
  assert.equal(absenceAlerts.length, 1);
  assert.equal(absenceAlerts[0].student._id, 's1');
  assert.equal(absenceAlerts[0].totalAbsences, 3);
  assert.equal(absenceAlerts[0].schoolName, 'مدرسه شهید بهشتی');

  const lowScoreAlerts = filterStudentsByLowScore(meta, 10);
  assert.equal(lowScoreAlerts.length, 1);
  assert.equal(lowScoreAlerts[0].student._id, 's1');
  assert.equal(lowScoreAlerts[0].courseName, 'ریاضی');
  assert.equal(lowScoreAlerts[0].courseAverage, 8.5);
});

test('expandAndPaginateAbsenceRows wraps excess absences onto continuation rows and paginates only when needed', () => {
  const makeStudent = (i: number): Student => ({
    _id: `s${i}`,
    firstName: `دانش‌آموز`,
    lastName: `${String(i).padStart(2, '0')}`,
    nationalId: String(1000 + i),
    fatherName: 'پدر',
  });

  // 1) Student with 9 unexcused absences and 6 slotsPerType -> 2 continuation rows
  const heavyStudent = makeStudent(1);
  const attendance: Attendance[] = Array.from({ length: 9 }, (_, d) => ({
    _id: `a${d}`,
    studentId: heavyStudent._id,
    date: `1405/08/${String(d + 1).padStart(2, '0')}`,
    status: 'absent',
    absenceType: 'unexcused',
  }));

  const singleRows = buildStudentAbsenceRows([heavyStudent], attendance);
  const singlePages = expandAndPaginateAbsenceRows(singleRows, 6, 14);
  assert.equal(singlePages.length, 1);
  assert.equal(singlePages[0].rows.length, 2);
  assert.equal(singlePages[0].rows[0].isFirstInPageGroup, true);
  assert.equal(singlePages[0].rows[0].rowSpanOnPage, 2);
  assert.equal(singlePages[0].rows[0].unexcusedSlots.filter(Boolean).length, 6);
  assert.equal(singlePages[0].rows[0].unexcusedSlots[0]?.displayShort, '۰۵/۰۸/۰۱');
  assert.equal(singlePages[0].rows[1].isFirstInPageGroup, false);
  assert.equal(singlePages[0].rows[1].unexcusedSlots.filter(Boolean).length, 3);
  assert.equal(singlePages[0].rows[1].unexcusedSlots[0]?.displayShort, '۰۵/۰۸/۰۷');
  assert.equal(singlePages[0].rows[1].unexcusedSlots[2]?.displayShort, '۰۵/۰۸/۰۹');

  // 2) 15 students where #1 has 2 visual rows (16 visual rows total) with max 14 rows/page -> 2 pages
  const fifteenStudents = Array.from({ length: 15 }, (_, idx) => makeStudent(idx + 1));
  const manyRows = buildStudentAbsenceRows(fifteenStudents, attendance);
  const multiPages = expandAndPaginateAbsenceRows(manyRows, 6, 14);
  assert.equal(multiPages.length, 2);
  assert.equal(multiPages[0].pageNumber, 1);
  assert.equal(multiPages[0].rows.length, 14);
  assert.equal(multiPages[1].pageNumber, 2);
  assert.equal(multiPages[1].rows.length, 2);
  assert.equal(multiPages[1].rows[0].studentIndex, 14);
  assert.equal(multiPages[1].rows[1].studentIndex, 15);
});

test('maps descriptive grades to compact numeric codes (1=خیلی خوب .. 4=نیاز به تلاش بیشتر)', () => {
  assert.equal(getDescriptiveNumericCode('خیلی خوب'), '1');
  assert.equal(getDescriptiveNumericCode('خوب'), '2');
  assert.equal(getDescriptiveNumericCode('قابل قبول'), '3');
  assert.equal(getDescriptiveNumericCode('نیاز به تلاش بیشتر'), '4');

  assert.equal(formatDescriptiveCellValue('خیلی خوب', true), '۱');
  assert.equal(formatDescriptiveCellValue('خوب', true), '۲');
  assert.equal(formatDescriptiveCellValue('قابل قبول', true), '۳');
  assert.equal(formatDescriptiveCellValue('نیاز به تلاش بیشتر', true), '۴');
  assert.equal(formatDescriptiveCellValue('نیاز به تلاش بیشتر', false), 'نیاز به تلاش بیشتر');
  assert.equal(formatDescriptiveCellValue(null, true), '');
  assert.equal(formatDescriptiveCellValue(null, false), '');
});

