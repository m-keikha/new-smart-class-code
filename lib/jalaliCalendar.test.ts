import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToJalali,
  buildJalaliCalendarGrid,
  filterVisibleStudentHomeworks,
  formatJalaliDateAscii,
  getEventTimingStatus,
  getHomeworkRemainingDays,
  getJalaliMonthDays,
  getTodayEvents,
  gregorianToJalali,
  isJalaliLeapYear,
  isSameJalaliDate,
  jalaliToGregorian,
  parseJalaliParts,
  sortEventsForTeacher,
} from './jalaliCalendar';
import type { Homework, TeacherEvent } from '@/types';

test('gregorianToJalali and jalaliToGregorian convert known dates accurately', () => {
  // 2025-03-21 = 1404/01/01 (Nowruz 1404)
  assert.deepEqual(gregorianToJalali(2025, 3, 21), { jy: 1404, jm: 1, jd: 1 });
  assert.deepEqual(jalaliToGregorian(1404, 1, 1), { gy: 2025, gm: 3, gd: 21 });

  // Leap year 1403 has 30 Esfand = 2025-03-20
  assert.equal(isJalaliLeapYear(1403), true);
  assert.equal(getJalaliMonthDays(1403, 12), 30);
  assert.deepEqual(gregorianToJalali(2025, 3, 20), { jy: 1403, jm: 12, jd: 30 });
  assert.deepEqual(jalaliToGregorian(1403, 12, 30), { gy: 2025, gm: 3, gd: 20 });

  // Non-leap year 1404 has 29 Esfand
  assert.equal(isJalaliLeapYear(1404), false);
  assert.equal(getJalaliMonthDays(1404, 12), 29);

  // 2026-11-20 = 1405/08/29 -> tomorrow is 1405/08/30
  const nov20 = gregorianToJalali(2026, 11, 20);
  assert.deepEqual(nov20, { jy: 1405, jm: 8, jd: 29 });
  assert.equal(formatJalaliDateAscii(addDaysToJalali(nov20, 1)), '1405/08/30');
  // Day after 1405/08/30 rolls to 1405/09/01 (Aban has 30 days)
  assert.equal(formatJalaliDateAscii(addDaysToJalali(nov20, 2)), '1405/09/01');
});

test('isSameJalaliDate normalizes Persian digits and zero padding', () => {
  assert.equal(isSameJalaliDate('۱۴۰۵/۸/۳۰', '1405/08/30'), true);
  assert.equal(isSameJalaliDate('1405/08/29', '1405/08/30'), false);
  assert.deepEqual(parseJalaliParts('۱۴۰۵/۰۸/۳۰'), { jy: 1405, jm: 8, jd: 30 });
});

test('buildJalaliCalendarGrid produces complete 7-column weeks with exact month days', () => {
  const grid = buildJalaliCalendarGrid(1405, 8);
  assert.equal(grid.length % 7, 0);
  const nonNullDays = grid.filter((d): d is number => d !== null);
  assert.equal(nonNullDays.length, 30);
  assert.equal(nonNullDays[0], 1);
  assert.equal(nonNullDays[nonNullDays.length - 1], 30);
});

test('filterVisibleStudentHomeworks enforces expiry, completion per student, target, and legacy support', () => {
  const now = Date.UTC(2026, 10, 20, 12, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  const homeworks: Homework[] = [
    {
      _id: 'hw-active',
      title: 'تمرین ریاضی',
      description: 'صفحه ۲۰',
      dueDate: '1405/09/02',
      target: 'ALL',
      level: 'سوم',
      displayDays: 3,
      expiresAt: new Date(now + 2 * dayMs).toISOString(),
      completedBy: [],
      createdAt: new Date(now - dayMs).toISOString(),
    },
    {
      _id: 'hw-expired',
      title: 'تمرین منقضی',
      description: 'قدیمی',
      dueDate: '1405/08/20',
      target: 'ALL',
      level: 'سوم',
      displayDays: 2,
      expiresAt: new Date(now - 1000).toISOString(),
      completedBy: [],
      createdAt: new Date(now - 3 * dayMs).toISOString(),
    },
    {
      _id: 'hw-done-by-s1',
      title: 'تکلیف انجام شده توسط سارا',
      description: 'روخوانی',
      dueDate: '1405/09/03',
      target: 'ALL',
      level: 'سوم',
      displayDays: 5,
      expiresAt: new Date(now + 4 * dayMs).toISOString(),
      completedBy: ['s1'],
      createdAt: new Date(now - dayMs).toISOString(),
    },
    {
      _id: 'hw-only-s2',
      title: 'تکلیف اختصاصی دانش‌آموز دوم',
      description: 'املا',
      dueDate: '1405/09/03',
      target: 's2',
      displayDays: 5,
      expiresAt: new Date(now + 4 * dayMs).toISOString(),
      completedBy: [],
      createdAt: new Date(now - dayMs).toISOString(),
    },
    {
      _id: 'hw-legacy',
      title: 'تکلیف قدیمی بدون انقضا',
      description: 'متن',
      dueDate: '1405/09/10',
      target: 'ALL',
      createdAt: new Date(now - 10 * dayMs).toISOString(),
    },
  ];

  const s1Visible = filterVisibleStudentHomeworks(homeworks, 's1', 'سوم', now);
  assert.deepEqual(
    s1Visible.map((h) => h._id),
    ['hw-active', 'hw-legacy']
  );

  // s2 still sees hw-done-by-s1 and hw-only-s2, but not hw-expired
  const s2Visible = filterVisibleStudentHomeworks(homeworks, 's2', 'سوم', now);
  assert.deepEqual(
    s2Visible.map((h) => h._id),
    ['hw-active', 'hw-done-by-s1', 'hw-only-s2', 'hw-legacy']
  );

  assert.equal(getHomeworkRemainingDays(homeworks[0], now), 2);
  assert.equal(getHomeworkRemainingDays(homeworks[1], now), 0);
  assert.equal(getHomeworkRemainingDays(homeworks[4], now), null);
});

test('getTodayEvents and sortEventsForTeacher classify and order events cleanly', () => {
  const events: TeacherEvent[] = [
    { _id: 'e-past', date: '1405/08/25', description: 'جلسه گذشته' },
    { _id: 'e-future', date: '1405/09/02', description: 'آزمون ریاضی' },
    { _id: 'e-today', date: '۱۴۰۵/۸/۲۹', description: 'پرسیدن درس سوم فارسی' },
    { _id: 'e-tomorrow', date: '1405/08/30', description: 'تحویل کاردستی' },
  ];

  const todayList = getTodayEvents(events, '1405/08/29');
  assert.deepEqual(
    todayList.map((e) => e._id),
    ['e-today']
  );
  assert.equal(getEventTimingStatus('1405/08/29', '1405/08/29'), 'today');
  assert.equal(getEventTimingStatus('1405/08/30', '1405/08/29'), 'upcoming');
  assert.equal(getEventTimingStatus('1405/08/25', '1405/08/29'), 'past');

  const sorted = sortEventsForTeacher(events, '1405/08/29');
  assert.deepEqual(
    sorted.map((e) => e._id),
    ['e-today', 'e-tomorrow', 'e-future', 'e-past']
  );
});
