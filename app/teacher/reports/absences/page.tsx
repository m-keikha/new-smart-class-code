'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Printer,
  Loader2,
  Users,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { getTeacherData } from '@/app/actions';
import type { Attendance, ClassInfo, Course, Student } from '@/types';
import {
  buildStudentAbsenceRows,
  expandAndPaginateAbsenceRows,
  filterByActiveLevel,
  resolveTeacherLevels,
  toPersianDigits,
} from '@/lib/teacherReports';
import { getTeacherSessionToken } from '@/lib/clientSession';

type RowDensity = 'compact' | 'normal' | 'spacious';

function AbsencesReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLevel = searchParams.get('level') || '';

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);

  const [selectedLevel, setSelectedLevel] = useState<string>(initialLevel || 'ALL');
  const [dateStyle, setDateStyle] = useState<'full' | 'short'>('short');
  const [rowDensity, setRowDensity] = useState<RowDensity>('normal');
  const [slotsPerType, setSlotsPerType] = useState<number>(6);
  const [extraBlankRows, setExtraBlankRows] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

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
        setAttendance(res.attendance || []);
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

  const rows = useMemo(
    () => buildStudentAbsenceRows(filteredStudents, attendance, 'lastName'),
    [filteredStudents, attendance]
  );

  const maxVisualRowsPerPage = useMemo(() => {
    if (rowDensity === 'compact') return 18;
    if (rowDensity === 'spacious') return 10;
    return 14;
  }, [rowDensity]);

  const pages = useMemo(
    () => expandAndPaginateAbsenceRows(rows, slotsPerType, maxVisualRowsPerPage),
    [rows, slotsPerType, maxVisualRowsPerPage]
  );

  const totalPages = pages.length;
  const safeCurrentPage =
    totalPages === 0 ? 1 : Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const rowHeightClass =
    rowDensity === 'compact'
      ? 'h-9 text-xs'
      : rowDensity === 'spacious'
      ? 'h-12 text-xs'
      : 'h-11 text-xs';

  const dateCellWidthClass =
    dateStyle === 'full'
      ? 'min-w-[92px] w-[92px] print:min-w-0 print:w-auto'
      : 'min-w-[78px] w-[78px] print:min-w-0 print:w-auto';

  const dateTextSizeClass =
    dateStyle === 'full'
      ? 'text-[11px] print:text-[9px]'
      : 'text-xs print:text-[10px]';

  const printDate = useMemo(() => new Date().toLocaleDateString('fa-IR'), []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">در حال آماده‌سازی نمون‌برگ غیبت دانش‌آموزان...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 7mm;
          }
          .absence-print-page {
            break-after: page;
            page-break-after: always;
          }
          .absence-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Non-printable action & layout toolbar */}
      <div className="print:hidden max-w-[1400px] mx-auto mb-5 bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => router.push('/teacher')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به پنل معلم</span>
          </button>
          <div className="hidden xl:block h-5 w-px bg-slate-200" />
          <div className="hidden xl:flex text-xs text-slate-500 items-center gap-1.5 whitespace-nowrap">
            <span>گزارش‌گیری فعالیت‌ها</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-slate-800">غیبت دانش‌آموزان</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {availableLevels.length > 1 && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="whitespace-nowrap">پایه:</span>
              <select
                value={selectedLevel}
                onChange={(e) => {
                  setSelectedLevel(e.target.value);
                  setCurrentPage(1);
                }}
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

          {/* Date format toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setDateStyle('short')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                dateStyle === 'short'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تاریخ کوتاه
            </button>
            <button
              type="button"
              onClick={() => setDateStyle('full')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                dateStyle === 'full'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تاریخ کامل
            </button>
          </div>

          {/* Row height */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="whitespace-nowrap">سطر:</span>
            <select
              value={rowDensity}
              onChange={(e) => {
                setRowDensity(e.target.value as RowDensity);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium outline-none focus:border-blue-500"
            >
              <option value="compact">فشرده</option>
              <option value="normal">معمولی</option>
              <option value="spacious">بزرگ</option>
            </select>
          </label>

          {/* Column count per section */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="whitespace-nowrap">خانه در هر بخش:</span>
            <select
              value={slotsPerType}
              onChange={(e) => {
                setSlotsPerType(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium outline-none focus:border-blue-500"
            >
              <option value={5}>{toPersianDigits(5)}</option>
              <option value={6}>{toPersianDigits(6)}</option>
              <option value={7}>{toPersianDigits(7)}</option>
              <option value={8}>{toPersianDigits(8)}</option>
            </select>
          </label>

          {/* Extra blank rows */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="whitespace-nowrap">ردیف خالی:</span>
            <select
              value={extraBlankRows}
              onChange={(e) => setExtraBlankRows(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium outline-none focus:border-blue-500"
            >
              <option value={0}>۰</option>
              <option value={3}>{toPersianDigits(3)}</option>
              <option value={5}>{toPersianDigits(5)}</option>
              <option value={10}>{toPersianDigits(10)}</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>{totalPages > 1 ? `چاپ همه صفحات (${toPersianDigits(totalPages)})` : 'چاپ نمون‌برگ'}</span>
          </button>
        </div>
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="max-w-[1400px] mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
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
        </div>
      ) : (
        <div className="max-w-[1400px] mx-auto">
          {/* Printable pages: on screen only active page is visible; on print ALL pages render cleanly */}
          {pages.map((pageData) => {
            const isActiveOnScreen = pageData.pageNumber === safeCurrentPage;
            const isLastPage = pageData.pageNumber === totalPages;

            return (
              <div
                key={`page-${pageData.pageNumber}`}
                className={`absence-print-page print-sheet bg-white border border-slate-200 rounded-2xl shadow-sm p-5 md:p-7 print:border-0 print:shadow-none print:rounded-none print:p-0 ${
                  isActiveOnScreen ? 'block' : 'hidden print:block'
                }`}
              >
                <header className="mb-4 text-center">
                  <h1 className="text-xl md:text-2xl font-extrabold text-black tracking-tight">
                    جدول ۵ - ثبت غیبت دانش‌آموزان
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
                    <span>تعداد دانش‌آموزان: {toPersianDigits(rows.length)} نفر</span>
                    <span aria-hidden="true">·</span>
                    <span>تاریخ چاپ: {printDate}</span>
                    {totalPages > 1 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold">
                          صفحه {toPersianDigits(pageData.pageNumber)} از{' '}
                          {toPersianDigits(totalPages)}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="print:hidden mt-1.5 text-[11px] text-slate-500">
                    تاریخ غیبت‌ها در هر بخش از سمت راست (قدیمی‌ترین) به سمت چپ (جدیدترین) مرتب شده‌اند؛ در صورت افزایش تعداد غیبت‌ها، سطر جدید برای همان دانش‌آموز اضافه می‌شود.
                  </p>
                </header>

                <div className="overflow-x-auto print:overflow-visible">
                  <table className="print-table w-full border-collapse border-2 border-black text-black print:table-fixed">
                    <thead>
                      <tr className="bg-slate-50 print:bg-white">
                        <th className="border border-black px-2 py-2.5 text-center font-bold text-xs w-11 whitespace-nowrap">
                          ردیف
                        </th>
                        <th className="border border-black px-3 py-2.5 text-center font-bold text-xs min-w-[165px] w-[175px] print:min-w-0 print:w-[15%] whitespace-nowrap">
                          نام و نام خانوادگی
                        </th>
                        <th
                          colSpan={slotsPerType}
                          className="border border-black border-r-2 border-r-black px-2 py-2.5 text-center font-bold text-xs"
                        >
                          ثبت تاریخ غیبت‌های موجه دانش‌آموز
                        </th>
                        <th
                          colSpan={slotsPerType}
                          className="border border-black border-r-2 border-r-black px-2 py-2.5 text-center font-bold text-xs"
                        >
                          ثبت تاریخ غیبت‌های غیرموجه دانش‌آموز
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageData.rows.map((vRow) => (
                        <tr key={vRow.key} className={rowHeightClass}>
                          {vRow.isFirstInPageGroup && (
                            <>
                              <td
                                rowSpan={vRow.rowSpanOnPage}
                                className="border border-black px-1.5 text-center font-semibold tabular-nums align-middle"
                              >
                                {toPersianDigits(vRow.studentIndex)}
                              </td>
                              <td
                                rowSpan={vRow.rowSpanOnPage}
                                className="border border-black px-2.5 py-1 text-right font-semibold align-middle"
                              >
                                <div className="leading-snug">
                                  {vRow.student.firstName} {vRow.student.lastName}
                                  {vRow.isContinuationFromPrevPage && (
                                    <span className="text-[10px] font-normal text-slate-500 print:text-black mr-1">
                                      (ادامه)
                                    </span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}

                          {vRow.excusedSlots.map((record, colIdx) => (
                            <td
                              key={`ex-${vRow.key}-${colIdx}`}
                              dir="ltr"
                              className={`border border-black px-1.5 py-1 text-center tabular-nums whitespace-nowrap overflow-hidden ${dateCellWidthClass} ${dateTextSizeClass} ${
                                colIdx === 0 ? 'border-r-2 border-r-black' : ''
                              }`}
                              title={
                                record ? `غیبت موجه: ${record.displayFull}` : undefined
                              }
                            >
                              {record
                                ? dateStyle === 'full'
                                  ? record.displayFull
                                  : record.displayShort
                                : ''}
                            </td>
                          ))}

                          {vRow.unexcusedSlots.map((record, colIdx) => (
                            <td
                              key={`un-${vRow.key}-${colIdx}`}
                              dir="ltr"
                              className={`border border-black px-1.5 py-1 text-center tabular-nums whitespace-nowrap overflow-hidden ${dateCellWidthClass} ${dateTextSizeClass} ${
                                colIdx === 0 ? 'border-r-2 border-r-black' : ''
                              }`}
                              title={
                                record ? `غیبت غیرموجه: ${record.displayFull}` : undefined
                              }
                            >
                              {record
                                ? dateStyle === 'full'
                                  ? record.displayFull
                                  : record.displayShort
                                : ''}
                            </td>
                          ))}
                        </tr>
                      ))}

                      {isLastPage &&
                        Array.from({ length: extraBlankRows }).map((_, blankIdx) => (
                          <tr key={`blank-${blankIdx}`} className={rowHeightClass}>
                            <td className="border border-black px-1.5 text-center text-slate-400 print:text-black tabular-nums">
                              {toPersianDigits(rows.length + blankIdx + 1)}
                            </td>
                            <td className="border border-black px-2.5" />
                            {Array.from({ length: slotsPerType }).map((__, colIdx) => (
                              <td
                                key={`bex-${colIdx}`}
                                className={`border border-black px-1.5 ${dateCellWidthClass} ${
                                  colIdx === 0 ? 'border-r-2 border-r-black' : ''
                                }`}
                              />
                            ))}
                            {Array.from({ length: slotsPerType }).map((__, colIdx) => (
                              <td
                                key={`bun-${colIdx}`}
                                className={`border border-black px-1.5 ${dateCellWidthClass} ${
                                  colIdx === 0 ? 'border-r-2 border-r-black' : ''
                                }`}
                              />
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Bottom pagination bar — ONLY rendered when students/absences span more than 1 page */}
          {totalPages > 1 && (
            <nav
              aria-label="صفحه‌بندی گزارش غیبت‌ها"
              className="print:hidden mt-4 bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm"
            >
              <span className="text-xs font-semibold text-slate-600">
                نمایش صفحه {toPersianDigits(safeCurrentPage)} از{' '}
                {toPersianDigits(totalPages)}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>صفحه قبل</span>
                </button>

                {pages.map((p) => (
                  <button
                    key={`btn-page-${p.pageNumber}`}
                    type="button"
                    onClick={() => setCurrentPage(p.pageNumber)}
                    aria-current={p.pageNumber === safeCurrentPage ? 'page' : undefined}
                    className={`min-w-[34px] h-[34px] px-2.5 rounded-lg text-xs font-bold tabular-nums transition-colors ${
                      p.pageNumber === safeCurrentPage
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {toPersianDigits(p.pageNumber)}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span>صفحه بعد</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}

export default function AbsencesReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">در حال بارگذاری گزارش غیبت‌ها...</p>
        </div>
      }
    >
      <AbsencesReportContent />
    </Suspense>
  );
}
