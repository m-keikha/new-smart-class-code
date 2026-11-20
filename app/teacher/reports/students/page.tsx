'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Printer, Loader2, Users } from 'lucide-react';
import { getTeacherData } from '@/app/actions';
import type { ClassInfo, Course, Student } from '@/types';
import {
  filterByActiveLevel,
  resolveTeacherLevels,
  sortStudentsAlphabetically,
  toPersianDigits,
} from '@/lib/teacherReports';
import { getTeacherSessionToken } from '@/lib/clientSession';

function formatGuardianLabel(student: Student): string {
  const name = (student.guardianName || '').trim();
  const relation = (student.guardianRelation || '').trim();
  if (name && relation) return `${name} (${relation})`;
  if (name) return name;
  if (relation) return relation;
  return '—';
}

function StudentsListReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLevel = searchParams.get('level') || '';

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);

  const [selectedLevel, setSelectedLevel] = useState<string>(initialLevel || 'ALL');
  const [sortBy, setSortBy] = useState<'lastName' | 'firstName'>('lastName');

  // Optional printable columns
  const [showNationalId, setShowNationalId] = useState<boolean>(false);
  const [showPhone, setShowPhone] = useState<boolean>(false);
  const [showSpecialDisease, setShowSpecialDisease] = useState<boolean>(false);
  const [showLeftHanded, setShowLeftHanded] = useState<boolean>(false);
  const [showGuardianNameRelation, setShowGuardianNameRelation] = useState<boolean>(false);
  const [showGuardianPhone, setShowGuardianPhone] = useState<boolean>(false);
  const [showMessengerType, setShowMessengerType] = useState<boolean>(false);
  const [showRemoteAccess, setShowRemoteAccess] = useState<boolean>(false);
  const [showNotesCol, setShowNotesCol] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getTeacherData(getTeacherSessionToken());
        if (!res || 'error' in res) {
          router.push('/');
          return;
        }
        const loadedStudents: Student[] = res.students || [];
        const loadedCourses: Course[] = res.courses || [];
        const loadedClassInfo: ClassInfo | null = (res as any).classInfo || null;
        setStudents(loadedStudents);
        setCourses(loadedCourses);
        setClassInfo(loadedClassInfo);

        const resolvedLevels = resolveTeacherLevels(
          loadedClassInfo,
          loadedStudents,
          loadedCourses
        );
        if (initialLevel && resolvedLevels.includes(initialLevel)) {
          setSelectedLevel(initialLevel);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, initialLevel]);

  const availableLevels = useMemo(
    () => resolveTeacherLevels(classInfo, students, courses),
    [classInfo, students, courses]
  );

  const filteredStudents = useMemo(
    () => filterByActiveLevel(students, selectedLevel),
    [students, selectedLevel]
  );

  const sortedStudents = useMemo(
    () => sortStudentsAlphabetically(filteredStudents, sortBy),
    [filteredStudents, sortBy]
  );

  const optionalColsCount = [
    showNationalId,
    showPhone,
    showSpecialDisease,
    showLeftHanded,
    showGuardianNameRelation,
    showGuardianPhone,
    showMessengerType,
    showRemoteAccess,
    showNotesCol,
  ].filter(Boolean).length;

  const useLandscape = optionalColsCount >= 4;

  const allProfileDetailsSelected =
    showSpecialDisease &&
    showLeftHanded &&
    showGuardianNameRelation &&
    showGuardianPhone &&
    showMessengerType &&
    showRemoteAccess;

  const toggleAllProfileDetails = () => {
    const next = !allProfileDetailsSelected;
    setShowSpecialDisease(next);
    setShowLeftHanded(next);
    setShowGuardianNameRelation(next);
    setShowGuardianPhone(next);
    setShowMessengerType(next);
    setShowRemoteAccess(next);
  };

  const printDate = useMemo(() => new Date().toLocaleDateString('fa-IR'), []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">در حال آماده‌سازی لیست مشخصات دانش‌آموزان...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: ${useLandscape ? 'A4 landscape' : 'A4 portrait'};
            margin: 10mm;
          }
        }
      `}</style>

      {/* Non-printable toolbar */}
      <div
        className={`print:hidden ${
          useLandscape ? 'max-w-[1380px]' : 'max-w-5xl'
        } mx-auto mb-5 bg-white border border-slate-200 rounded-2xl p-4 space-y-3`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => router.push('/teacher')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به پنل معلم</span>
            </button>
            <div className="hidden lg:block h-5 w-px bg-slate-200" />
            <div className="hidden lg:flex text-xs text-slate-500 items-center gap-1.5 whitespace-nowrap">
              <span>گزارش‌گیری فعالیت‌ها</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-800">لیست مشخصات دانش‌آموزان</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {availableLevels.length > 1 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="whitespace-nowrap">پایه:</span>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium outline-none focus:border-blue-500"
                >
                  <option value="ALL">همه پایه‌ها</option>
                  {availableLevels.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      پایه {lvl}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setSortBy('lastName')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                  sortBy === 'lastName'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الفبای نام خانوادگی
              </button>
              <button
                type="button"
                onClick={() => setSortBy('firstName')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                  sortBy === 'firstName'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الفبای نام
              </button>
            </div>

            <button
              type="button"
              onClick={toggleAllProfileDetails}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap ${
                allProfileDetailsSelected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {allProfileDetailsSelected ? 'حذف ستون‌های تکمیلی' : 'انتخاب همه مشخصات تکمیلی'}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ لیست</span>
            </button>
          </div>
        </div>

        {/* Optional Columns Selector */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="font-bold text-slate-500 whitespace-nowrap">ستون‌های اختیاری جدول:</span>

          <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showNationalId}
              onChange={(e) => setShowNationalId(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>کد ملی</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showPhone}
              onChange={(e) => setShowPhone(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>شماره تماس والدین</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showSpecialDisease}
              onChange={(e) => setShowSpecialDisease(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>بیماری خاص</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showLeftHanded}
              onChange={(e) => setShowLeftHanded(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>دست چپ بودن</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showGuardianNameRelation}
              onChange={(e) => setShowGuardianNameRelation(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>نام و نسبت مسئول پیگیری</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showGuardianPhone}
              onChange={(e) => setShowGuardianPhone(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>شماره همراه مسئول</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showMessengerType}
              onChange={(e) => setShowMessengerType(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>نوع پیام‌رسان</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showRemoteAccess}
              onChange={(e) => setShowRemoteAccess(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>دسترسی به اینترنت / درسنامه / تلویزیون</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showNotesCol}
              onChange={(e) => setShowNotesCol(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>ملاحظات</span>
          </label>
        </div>
      </div>

      {/* Printable A4 Sheet */}
      <div
        className={`print-sheet ${
          useLandscape ? 'max-w-[1380px]' : 'max-w-5xl'
        } mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8 print:border-0 print:shadow-none print:rounded-none print:p-0`}
      >
        <header className="mb-5 text-center pb-4 border-b border-slate-200 print:border-black">
          <h1 className="text-xl md:text-2xl font-extrabold text-black tracking-tight">
            لیست مشخصات دانش‌آموزان
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-700 print:text-black">
            {classInfo?.schoolName && (
              <>
                <span>مدرسه: {classInfo.schoolName}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {selectedLevel !== 'ALL' && (
              <>
                <span>پایه: {selectedLevel}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {classInfo?.className && (
              <>
                <span>کلاس: {classInfo.className}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {classInfo?.teacherName && (
              <>
                <span>دبیر: {classInfo.teacherName}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>تعداد کل: {toPersianDigits(sortedStudents.length)} نفر</span>
            <span aria-hidden="true">·</span>
            <span>تاریخ چاپ: {printDate}</span>
          </div>
        </header>

        {sortedStudents.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-300 rounded-xl">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium mb-4">
              هنوز هیچ دانش‌آموزی در این پایه ثبت نشده است.
            </p>
            <button
              type="button"
              onClick={() => router.push('/teacher')}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              بازگشت و افزودن دانش‌آموز
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="print-table w-full border-collapse border-2 border-black text-black">
              <thead>
                <tr className="bg-slate-50 print:bg-white text-xs md:text-[13px] print:text-[11px]">
                  <th className="border border-black px-2 py-2.5 text-center font-bold w-11 whitespace-nowrap">
                    ردیف
                  </th>
                  <th className="border border-black px-3 py-2.5 text-right font-bold whitespace-nowrap">
                    نام و نام خانوادگی
                  </th>
                  <th className="border border-black px-3 py-2.5 text-right font-bold whitespace-nowrap">
                    نام پدر
                  </th>
                  {showNationalId && (
                    <th className="border border-black px-2.5 py-2.5 text-center font-bold whitespace-nowrap">
                      کد ملی
                    </th>
                  )}
                  {showPhone && (
                    <th className="border border-black px-2.5 py-2.5 text-center font-bold whitespace-nowrap">
                      شماره تماس
                    </th>
                  )}
                  {showSpecialDisease && (
                    <th className="border border-black px-2.5 py-2.5 text-center font-bold whitespace-nowrap">
                      بیماری خاص
                    </th>
                  )}
                  {showLeftHanded && (
                    <th className="border border-black px-2 py-2.5 text-center font-bold whitespace-nowrap">
                      دست چپ
                    </th>
                  )}
                  {showGuardianNameRelation && (
                    <th className="border border-black px-2.5 py-2.5 text-right font-bold whitespace-nowrap">
                      مسئول پیگیری (نسبت)
                    </th>
                  )}
                  {showGuardianPhone && (
                    <th className="border border-black px-2.5 py-2.5 text-center font-bold whitespace-nowrap">
                      شماره همراه مسئول
                    </th>
                  )}
                  {showMessengerType && (
                    <th className="border border-black px-2.5 py-2.5 text-center font-bold whitespace-nowrap">
                      نوع پیام‌رسان
                    </th>
                  )}
                  {showRemoteAccess && (
                    <th className="border border-black px-2.5 py-2.5 text-right font-bold whitespace-nowrap">
                      دسترسی آموزش غیرحضوری
                    </th>
                  )}
                  {showNotesCol && (
                    <th className="border border-black px-3 py-2.5 text-center font-bold min-w-[110px] whitespace-nowrap">
                      ملاحظات
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student, idx) => {
                  const guardianPhoneDisplay =
                    (student.guardianPhone || '').trim() ||
                    (student.phoneNumber || '').trim();
                  const remoteMethods = Array.isArray(student.remoteAccessMethods)
                    ? student.remoteAccessMethods.filter(Boolean)
                    : [];

                  return (
                    <tr
                      key={student._id}
                      className="h-11 text-xs md:text-[13px] print:text-[11px]"
                    >
                      <td className="border border-black px-2 text-center font-semibold tabular-nums">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="border border-black px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="border border-black px-3 py-1.5 text-right whitespace-nowrap">
                        {student.fatherName || '—'}
                      </td>
                      {showNationalId && (
                        <td
                          className="border border-black px-2.5 text-center tabular-nums whitespace-nowrap"
                          dir="ltr"
                        >
                          {student.nationalId ? toPersianDigits(student.nationalId) : '—'}
                        </td>
                      )}
                      {showPhone && (
                        <td
                          className="border border-black px-2.5 text-center tabular-nums whitespace-nowrap"
                          dir="ltr"
                        >
                          {student.phoneNumber ? toPersianDigits(student.phoneNumber) : '—'}
                        </td>
                      )}
                      {showSpecialDisease && (
                        <td className="border border-black px-2.5 py-1.5 text-center">
                          {(student.specialDisease || '').trim() || 'ندارد'}
                        </td>
                      )}
                      {showLeftHanded && (
                        <td className="border border-black px-2 py-1.5 text-center whitespace-nowrap">
                          {student.isLeftHanded ? 'بله' : 'خیر'}
                        </td>
                      )}
                      {showGuardianNameRelation && (
                        <td className="border border-black px-2.5 py-1.5 text-right">
                          {formatGuardianLabel(student)}
                        </td>
                      )}
                      {showGuardianPhone && (
                        <td
                          className="border border-black px-2.5 text-center tabular-nums whitespace-nowrap"
                          dir="ltr"
                        >
                          {guardianPhoneDisplay
                            ? toPersianDigits(guardianPhoneDisplay)
                            : '—'}
                        </td>
                      )}
                      {showMessengerType && (
                        <td className="border border-black px-2.5 py-1.5 text-center whitespace-nowrap">
                          {(student.messengerType || '').trim() || '—'}
                        </td>
                      )}
                      {showRemoteAccess && (
                        <td className="border border-black px-2.5 py-1.5 text-right">
                          {remoteMethods.length > 0 ? remoteMethods.join('، ') : '—'}
                        </td>
                      )}
                      {showNotesCol && <td className="border border-black px-3" />}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentsListReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">در حال بارگذاری لیست دانش‌آموزان...</p>
        </div>
      }
    >
      <StudentsListReportContent />
    </Suspense>
  );
}
