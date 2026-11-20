'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Printer,
  Loader2,
  Users,
  FileSpreadsheet,
  Award,
  SlidersHorizontal,
  RotateCcw,
  Minimize2,
} from 'lucide-react';
import { getTeacherData } from '@/app/actions';
import type { ClassInfo, Course, Grade, Student } from '@/types';
import {
  ACADEMIC_MONTHS,
  buildStudentReportCard,
  filterByActiveLevel,
  formatDescriptiveCellValue,
  resolveTeacherLevels,
  sortStudentsAlphabetically,
  toPersianDigits,
  type DescriptiveGrade,
} from '@/lib/teacherReports';
import { getTeacherSessionToken } from '@/lib/clientSession';

type ReportMode = 'descriptive' | 'numeric';
type HeaderStyle = 'full' | 'compact' | 'minimal';

function getDescriptiveCellClass(label: DescriptiveGrade | null): string {
  switch (label) {
    case 'خیلی خوب':
      return 'bg-emerald-50/70 text-emerald-900 font-semibold';
    case 'خوب':
      return 'bg-sky-50/70 text-sky-900 font-semibold';
    case 'قابل قبول':
      return 'bg-amber-50/70 text-amber-900 font-semibold';
    case 'نیاز به تلاش بیشتر':
      return 'bg-red-50/80 text-red-900 font-bold';
    default:
      return '';
  }
}

function ReportCardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLevel = searchParams.get('level') || '';
  const initialStudentId = searchParams.get('studentId') || '';

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);

  const [mode, setMode] = useState<ReportMode>('descriptive');
  const [selectedLevel, setSelectedLevel] = useState<string>(initialLevel || 'ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');

  // Optional A4 layout & print customization settings (all full/default unless user changes)
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [headerStyle, setHeaderStyle] = useState<HeaderStyle>('full');
  const [showLocationInfo, setShowLocationInfo] = useState(true);
  const [showHeaderMeta, setShowHeaderMeta] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [useCompactDescriptiveCodes, setUseCompactDescriptiveCodes] = useState(false);
  const [compactRows, setCompactRows] = useState(false);

  const hasCustomPrintSettings =
    headerStyle !== 'full' ||
    !showLocationInfo ||
    !showHeaderMeta ||
    !showSignatures ||
    !showLegend ||
    useCompactDescriptiveCodes ||
    compactRows;

  const applyQuickA4Preset = () => {
    setHeaderStyle('compact');
    setShowHeaderMeta(false);
    setShowSignatures(false);
    setCompactRows(true);
    if (mode === 'descriptive') {
      setUseCompactDescriptiveCodes(true);
    }
  };

  const resetPrintSettings = () => {
    setHeaderStyle('full');
    setShowLocationInfo(true);
    setShowHeaderMeta(true);
    setShowSignatures(true);
    setShowLegend(true);
    setUseCompactDescriptiveCodes(false);
    setCompactRows(false);
  };

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
        setGrades(res.grades || []);
        setClassInfo(loadedClassInfo);

        const resolvedLevels = resolveTeacherLevels(loadedClassInfo, loadedStudents, loadedCourses);
        if (initialLevel && resolvedLevels.includes(initialLevel)) {
          setSelectedLevel(initialLevel);
        } else if (resolvedLevels.length === 1) {
          setSelectedLevel(resolvedLevels[0]);
        } else {
          setSelectedLevel('ALL');
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

  const levelStudents = useMemo(
    () =>
      sortStudentsAlphabetically(
        filterByActiveLevel(students, selectedLevel),
        'lastName'
      ),
    [students, selectedLevel]
  );

  const levelCourses = useMemo(
    () => filterByActiveLevel(courses, selectedLevel),
    [courses, selectedLevel]
  );

  useEffect(() => {
    if (levelStudents.length === 0) {
      setSelectedStudentId('');
      return;
    }
    if (
      selectedStudentId !== 'ALL' &&
      !levelStudents.some((s) => s._id === selectedStudentId)
    ) {
      setSelectedStudentId(levelStudents[0]._id);
    }
  }, [levelStudents, selectedStudentId]);

  const targetStudents = useMemo(() => {
    if (selectedStudentId === 'ALL') return levelStudents;
    const found = levelStudents.find((s) => s._id === selectedStudentId);
    return found ? [found] : levelStudents.slice(0, 1);
  }, [levelStudents, selectedStudentId]);

  const reportCards = useMemo(
    () =>
      targetStudents.map((student) =>
        buildStudentReportCard(student, levelCourses, grades)
      ),
    [targetStudents, levelCourses, grades]
  );

  const printDate = useMemo(() => new Date().toLocaleDateString('fa-IR'), []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">در حال آماده‌سازی کارنامه دانش‌آموزان...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: ${compactRows || headerStyle !== 'full' ? '5mm' : '8mm'};
          }
          .report-card-break {
            break-after: page;
            page-break-after: always;
          }
          .report-card-break:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Non-printable toolbar */}
      <div className="print:hidden max-w-[1440px] mx-auto mb-4 bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
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
            <span className="font-semibold text-slate-800">کارنامه دانش‌آموزان</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Descriptive vs Numeric mode switcher */}
          <div
            role="group"
            aria-label="نوع کارنامه"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs"
          >
            <button
              type="button"
              onClick={() => setMode('descriptive')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                mode === 'descriptive'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>کارنامه توصیفی</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('numeric')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                mode === 'numeric'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>کارنامه نمره‌ای - عددی</span>
            </button>
          </div>

          {/* Grade level filter (if multiple levels exist) */}
          {availableLevels.length > 1 && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="whitespace-nowrap">پایه:</span>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium outline-none focus:border-blue-500"
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

          {/* Student selector */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="whitespace-nowrap">دانش‌آموز:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium outline-none focus:border-blue-500 max-w-[220px]"
            >
              {levelStudents.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
              {levelStudents.length > 1 && (
                <option value="ALL">همه دانش‌آموزان (چاپ دسته‌ای)</option>
              )}
            </select>
          </label>

          <button
            type="button"
            aria-expanded={showPrintOptions}
            onClick={() => setShowPrintOptions((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              showPrintOptions || hasCustomPrintSettings
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>تنظیمات چاپ A4</span>
            {hasCustomPrintSettings && (
              <span
                className="w-2 h-2 rounded-full bg-amber-600"
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ کارنامه</span>
          </button>
        </div>
      </div>

      {/* Gentle hint when there are many courses */}
      {levelCourses.length >= 10 && !showPrintOptions && !hasCustomPrintSettings && (
        <div className="print:hidden max-w-[1440px] mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <span>
            تعداد دروس این پایه ({toPersianDigits(levelCourses.length)} درس) زیاد است؛ در صورت کمبود فضای صفحه A4 هنگام چاپ می‌توانید از «تنظیمات چاپ A4» سرتیتر، امضا یا کدهای عددی (۱ تا ۴) را تنظیم کنید.
          </span>
          <button
            type="button"
            onClick={() => setShowPrintOptions(true)}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors shrink-0"
          >
            باز کردن تنظیمات A4
          </button>
        </div>
      )}

      {/* Optional A4 Print & Layout Customization Panel */}
      {showPrintOptions && (
        <section
          aria-label="تنظیمات اختیاری چاپ و فشرده‌سازی صفحه A4"
          className="print:hidden max-w-[1440px] mx-auto mb-5 bg-white border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                <span>تنظیمات اختیاری نمایش و فشرده‌سازی صفحه A4</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                در صورت زیاد بودن تعداد دروس و کمبود فضا در برگه A4، هر گزینه‌ای را به دلخواه فعال یا غیرفعال کنید.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={applyQuickA4Preset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>فشرده‌سازی سریع برای یک صفحه A4</span>
              </button>
              <button
                type="button"
                onClick={resetPrintSettings}
                disabled={!hasCustomPrintSettings}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازنشانی پیش‌فرض</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Header Style Selector */}
            <div className="lg:col-span-4 space-y-2">
              <span className="block text-xs font-bold text-slate-700">
                حالت نمایش سرتیتر کارنامه:
              </span>
              <div
                role="group"
                aria-label="حالت نمایش سرتیتر کارنامه"
                className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs"
              >
                <button
                  type="button"
                  onClick={() => setHeaderStyle('full')}
                  className={`py-1.5 px-2 rounded-lg font-bold transition-colors ${
                    headerStyle === 'full'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  کامل
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderStyle('compact')}
                  className={`py-1.5 px-2 rounded-lg font-bold transition-colors ${
                    headerStyle === 'compact'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  خلاصه
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderStyle('minimal')}
                  className={`py-1.5 px-2 rounded-lg font-bold transition-colors ${
                    headerStyle === 'minimal'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  حداقل
                </button>
              </div>
            </div>

            {/* Individual Optional Toggles */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 text-xs">
              <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLocationInfo}
                  onChange={(e) => setShowLocationInfo(e.target.checked)}
                  className="mt-0.5 accent-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  نمایش نام استان، شهرستان و مدرسه
                </span>
              </label>

              <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHeaderMeta}
                  onChange={(e) => setShowHeaderMeta(e.target.checked)}
                  className="mt-0.5 accent-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  نمایش جزئیات سرتیتر (کلاس، معلم، تاریخ)
                </span>
              </label>

              <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={(e) => setShowSignatures(e.target.checked)}
                  className="mt-0.5 accent-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  نمایش بخش امضای آموزگار و مدیر
                </span>
              </label>

              <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                  className="mt-0.5 accent-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  نمایش راهنمای مقیاس نمرات
                </span>
              </label>

              <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compactRows}
                  onChange={(e) => setCompactRows(e.target.checked)}
                  className="mt-0.5 accent-amber-600"
                />
                <span className="font-semibold text-slate-800">
                  فشرده‌سازی ارتفاع سطرهای جدول
                </span>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer ${
                  mode === 'descriptive'
                    ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={useCompactDescriptiveCodes}
                  disabled={mode !== 'descriptive'}
                  onChange={(e) => setUseCompactDescriptiveCodes(e.target.checked)}
                  className="mt-0.5 accent-emerald-600"
                />
                <span className="font-semibold text-slate-800 leading-snug">
                  نمایش کد عددی توصیفی (۱=خیلی خوب، ۲=خوب، ۳=قابل قبول، ۴=نیاز به تلاش بیشتر)
                </span>
              </label>
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {levelStudents.length === 0 ? (
        <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-14 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold mb-2">
            هنوز هیچ دانش‌آموزی برای این پایه ثبت نشده است.
          </p>
          <p className="text-xs text-slate-500 mb-5">
            ابتدا از پنل معلم دانش‌آموز و درس اضافه کنید تا کارنامه به‌صورت خودکار تنظیم شود.
          </p>
          <button
            type="button"
            onClick={() => router.push('/teacher')}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
          >
            بازگشت به پنل معلم
          </button>
        </div>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {reportCards.map((card) => {
            const displayGradeLevel =
              card.student.level ||
              (selectedLevel !== 'ALL' ? selectedLevel : '') ||
              classInfo?.gradeLevel ||
              '';

            const provinceLabel = classInfo?.province?.trim() || 'ثبت نشده';
            const cityLabel = classInfo?.city?.trim() || 'ثبت نشده';
            const schoolLabel = classInfo?.schoolName?.trim() || 'ثبت نشده';

            const rowHeightClass = compactRows ? 'h-7' : 'min-h-[42px] h-11';
            const summaryRowHeightClass = compactRows ? 'h-8' : 'h-11';
            const headerThPadding = compactRows ? 'py-1' : 'py-2';
            const subHeaderThPadding = compactRows ? 'py-0.5' : 'py-1';
            const descriptiveCellFontClass = useCompactDescriptiveCodes
              ? compactRows
                ? 'text-[11px] font-extrabold tabular-nums'
                : 'text-xs font-extrabold tabular-nums'
              : compactRows
              ? 'text-[8.5px]'
              : 'text-[9.5px]';

            return (
              <section
                key={card.student._id}
                className={`print-sheet report-card-break max-w-[1440px] mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0 ${
                  compactRows ? 'p-3.5 md:p-5' : 'p-5 md:p-7'
                }`}
              >
                {/* Iranian school official report card header (full / compact / minimal) */}
                {headerStyle === 'full' && (
                  <div className={`border-2 border-black ${compactRows ? 'mb-2.5' : 'mb-4'}`}>
                    <div
                      className={`bg-slate-50 print:bg-slate-100 border-b border-black px-4 text-center ${
                        compactRows ? 'py-2' : 'py-3'
                      }`}
                    >
                      <p className="text-[11px] font-semibold text-slate-600 print:text-black mb-0.5">
                        به نام خدا · وزارت آموزش و پرورش
                      </p>
                      <h1 className="text-lg md:text-xl font-extrabold text-black tracking-tight">
                        {mode === 'descriptive'
                          ? 'کارنامه ارزشیابی توصیفی دانش‌آموز'
                          : 'کارنامه تحصیلی نمره‌ای (عددی) دانش‌آموز'}
                      </h1>

                      {showLocationInfo && (
                        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-bold text-slate-800 print:text-black">
                          <span>استان: {provinceLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>شهرستان: {cityLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>مدرسه: {schoolLabel}</span>
                        </div>
                      )}

                      {showHeaderMeta && (
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-700 print:text-black">
                          {displayGradeLevel && (
                            <>
                              <span>پایه تحصیلی: {displayGradeLevel}</span>
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
                              <span>آموزگار / دبیر: {classInfo.teacherName}</span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span>تاریخ صدور: {printDate}</span>
                        </div>
                      )}
                    </div>

                    {/* Student identity fields (Iranian report card layout) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-black text-xs md:text-sm">
                      <div
                        className={`px-4 flex items-center justify-between gap-2 ${
                          compactRows ? 'py-1.5' : 'py-2.5'
                        }`}
                      >
                        <span className="text-slate-600 print:text-black font-medium">
                          نام و نام خانوادگی دانش‌آموز:
                        </span>
                        <span className="font-extrabold text-black">
                          {card.student.firstName} {card.student.lastName}
                        </span>
                      </div>
                      <div
                        className={`px-4 flex items-center justify-between gap-2 ${
                          compactRows ? 'py-1.5' : 'py-2.5'
                        }`}
                      >
                        <span className="text-slate-600 print:text-black font-medium">
                          نام پدر:
                        </span>
                        <span className="font-bold text-black">
                          {card.student.fatherName || '—'}
                        </span>
                      </div>
                      <div
                        className={`px-4 flex items-center justify-between gap-2 ${
                          compactRows ? 'py-1.5' : 'py-2.5'
                        }`}
                      >
                        <span className="text-slate-600 print:text-black font-medium">
                          کد ملی دانش‌آموز:
                        </span>
                        <span className="font-bold text-black tabular-nums" dir="ltr">
                          {card.student.nationalId
                            ? toPersianDigits(card.student.nationalId)
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {headerStyle === 'compact' && (
                  <div className="border-2 border-black mb-2.5">
                    <div className="bg-slate-50 print:bg-slate-100 border-b border-black px-3 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                      <h1 className="font-extrabold text-black text-sm">
                        {mode === 'descriptive'
                          ? 'کارنامه توصیفی دانش‌آموز'
                          : 'کارنامه نمره‌ای دانش‌آموز'}
                      </h1>
                      {showLocationInfo && (
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-bold text-slate-800 print:text-black">
                          <span>استان: {provinceLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>شهرستان: {cityLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>مدرسه: {schoolLabel}</span>
                        </div>
                      )}
                      {showHeaderMeta && (
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-700 print:text-black">
                          {displayGradeLevel && <span>پایه: {displayGradeLevel}</span>}
                          {classInfo?.teacherName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>معلم: {classInfo.teacherName}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>تاریخ: {printDate}</span>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                      <span>
                        دانش‌آموز:{' '}
                        <strong className="font-extrabold text-black">
                          {card.student.firstName} {card.student.lastName}
                        </strong>
                      </span>
                      <span>
                        نام پدر: <strong>{card.student.fatherName || '—'}</strong>
                      </span>
                      <span>
                        کد ملی:{' '}
                        <strong className="tabular-nums">
                          {card.student.nationalId
                            ? toPersianDigits(card.student.nationalId)
                            : '—'}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}

                {headerStyle === 'minimal' && (
                  <div className="border border-black bg-slate-50 print:bg-white px-3 py-1.5 mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <strong className="font-extrabold text-black">
                        {card.student.firstName} {card.student.lastName}
                      </strong>
                      {card.student.fatherName && (
                        <span className="text-slate-700 print:text-black">
                          (فرزند {card.student.fatherName})
                        </span>
                      )}
                      {displayGradeLevel && (
                        <span className="text-slate-700 print:text-black">
                          · پایه {displayGradeLevel}
                        </span>
                      )}
                    </div>
                    {showLocationInfo && (
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-slate-800 print:text-black">
                        <span>استان: {provinceLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>شهرستان: {cityLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>مدرسه: {schoolLabel}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Academic Months Table (Mehr -> Khordad, 2 halves each) */}
                {card.rows.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-slate-300 rounded-xl text-sm text-slate-600">
                    هیچ درسی برای این پایه ثبت نشده است.
                  </div>
                ) : (
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="print-table table-fixed w-full border-collapse border-2 border-black text-black">
                      <colgroup>
                        <col className="w-8" />
                        <col className={compactRows ? 'w-28' : 'w-32'} />
                        {ACADEMIC_MONTHS.map((m) => (
                          <React.Fragment key={`col-m-${m.month}`}>
                            <col />
                            <col />
                          </React.Fragment>
                        ))}
                        <col className={useCompactDescriptiveCodes && mode === 'descriptive' ? 'w-16' : 'w-24'} />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-100 print:bg-slate-100">
                          <th
                            rowSpan={2}
                            className={`border border-black px-1 ${headerThPadding} text-center font-bold text-[11px]`}
                          >
                            ردیف
                          </th>
                          <th
                            rowSpan={2}
                            className={`border border-black px-2 ${headerThPadding} text-center font-bold text-xs`}
                          >
                            نام درس
                          </th>
                          {ACADEMIC_MONTHS.map((m) => (
                            <th
                              key={`th-m-${m.month}`}
                              colSpan={2}
                              className={`border border-black border-r-2 border-r-black px-1 ${
                                compactRows ? 'py-1' : 'py-1.5'
                              } text-center font-extrabold text-[11px]`}
                            >
                              {m.name}
                            </th>
                          ))}
                          <th
                            rowSpan={2}
                            className={`border border-black border-r-2 border-r-black px-1.5 ${headerThPadding} text-center font-extrabold text-[11px] bg-slate-200/70 print:bg-slate-200`}
                          >
                            میانگین کل
                          </th>
                        </tr>
                        <tr className="bg-slate-50 print:bg-white text-[10px]">
                          {ACADEMIC_MONTHS.map((m) => (
                            <React.Fragment key={`th-h-${m.month}`}>
                              <th
                                className={`border border-black border-r-2 border-r-black px-0.5 ${subHeaderThPadding} text-center font-semibold`}
                              >
                                نیمه ۱
                              </th>
                              <th
                                className={`border border-black px-0.5 ${subHeaderThPadding} text-center font-semibold`}
                              >
                                نیمه ۲
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {card.rows.map((row, idx) => (
                          <tr key={row.course._id} className={rowHeightClass}>
                            <td className="border border-black px-1 text-center text-xs font-semibold tabular-nums">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td
                              className={`border border-black px-2 text-right font-bold leading-snug ${
                                compactRows ? 'text-[11px]' : 'text-xs'
                              }`}
                            >
                              {row.course.name}
                            </td>
                            {row.cells.map((cell) => {
                              const isFirstHalf = cell.half === 1;
                              const isEmpty = cell.average === null;
                              const cellTone =
                                !isEmpty && mode === 'descriptive'
                                  ? getDescriptiveCellClass(cell.descriptive)
                                  : '';

                              return (
                                <td
                                  key={`${row.course._id}-${cell.month}-${cell.half}`}
                                  className={`border border-black px-0.5 ${
                                    compactRows ? 'py-0.5' : 'py-1'
                                  } text-center align-middle leading-tight ${
                                    isFirstHalf ? 'border-r-2 border-r-black' : ''
                                  } ${
                                    mode === 'descriptive'
                                      ? descriptiveCellFontClass
                                      : 'text-[11px] font-semibold tabular-nums'
                                  } ${cellTone}`}
                                >
                                  {isEmpty
                                    ? ''
                                    : mode === 'descriptive'
                                    ? formatDescriptiveCellValue(
                                        cell.descriptive,
                                        useCompactDescriptiveCodes
                                      )
                                    : toPersianDigits(cell.average!)}
                                </td>
                              );
                            })}
                            <td
                              className={`border border-black border-r-2 border-r-black px-1.5 ${
                                compactRows ? 'py-0.5' : 'py-1'
                              } text-center align-middle leading-tight ${
                                row.overallAverage !== null && mode === 'descriptive'
                                  ? getDescriptiveCellClass(row.overallDescriptive)
                                  : 'bg-slate-50 font-extrabold'
                              } ${
                                mode === 'descriptive'
                                  ? useCompactDescriptiveCodes
                                    ? 'text-xs font-extrabold tabular-nums'
                                    : 'text-[10.5px]'
                                  : 'text-xs tabular-nums font-extrabold'
                              }`}
                            >
                              {row.overallAverage === null
                                ? ''
                                : mode === 'descriptive'
                                ? formatDescriptiveCellValue(
                                    row.overallDescriptive,
                                    useCompactDescriptiveCodes
                                  )
                                : toPersianDigits(row.overallAverage)}
                            </td>
                          </tr>
                        ))}

                        {/* Overall Student GPA Summary Row */}
                        <tr
                          className={`bg-slate-100 print:bg-slate-100 ${summaryRowHeightClass} font-extrabold`}
                        >
                          <td
                            colSpan={2 + ACADEMIC_MONTHS.length * 2}
                            className="border border-black px-3 text-left text-xs"
                          >
                            میانگین کل تمام دروس دانش‌آموز:
                          </td>
                          <td
                            className={`border border-black border-r-2 border-r-black px-1.5 text-center ${
                              mode === 'descriptive'
                                ? useCompactDescriptiveCodes
                                  ? 'text-sm tabular-nums'
                                  : 'text-[11px]'
                                : 'text-sm tabular-nums'
                            }`}
                          >
                            {card.overallAverage === null
                              ? ''
                              : mode === 'descriptive'
                              ? formatDescriptiveCellValue(
                                  card.overallDescriptive,
                                  useCompactDescriptiveCodes
                                )
                              : toPersianDigits(card.overallAverage)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Legend & signature footer (optional via print settings) */}
                {(showLegend || showSignatures) && (
                  <footer
                    className={`${
                      compactRows ? 'mt-2' : 'mt-4'
                    } flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-700 print:text-black`}
                  >
                    {showLegend ? (
                      mode === 'descriptive' ? (
                        useCompactDescriptiveCodes ? (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-bold">راهنمای کدهای توصیفی:</span>
                            <span>۱ = خیلی خوب (۱۸ تا ۲۰)</span>
                            <span aria-hidden="true">·</span>
                            <span>۲ = خوب (۱۵ تا ۱۷.۹۹)</span>
                            <span aria-hidden="true">·</span>
                            <span>۳ = قابل قبول (۱۰ تا ۱۴.۹۹)</span>
                            <span aria-hidden="true">·</span>
                            <span>۴ = نیاز به تلاش بیشتر (۰ تا ۹.۹۹)</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-bold">مقیاس توصیفی:</span>
                            <span>۱۸ تا ۲۰: خیلی خوب</span>
                            <span aria-hidden="true">·</span>
                            <span>۱۵ تا ۱۷.۹۹: خوب</span>
                            <span aria-hidden="true">·</span>
                            <span>۱۰ تا ۱۴.۹۹: قابل قبول</span>
                            <span aria-hidden="true">·</span>
                            <span>۰ تا ۹.۹۹: نیاز به تلاش بیشتر</span>
                          </div>
                        )
                      ) : (
                        <div className="text-slate-600 print:text-black">
                          نمرات هر نیم‌ماه بر اساس میانگین ارزشیابی‌های ثبت‌شده در روزهای ۱ تا ۱۵ (نیمه اول) و ۱۶ تا پایان ماه (نیمه دوم) محاسبه شده‌اند.
                        </div>
                      )
                    ) : (
                      <div />
                    )}

                    {showSignatures && (
                      <div className="flex items-center gap-8 pt-1">
                        <span>امضای آموزگار / دبیر: ........................</span>
                        <span>مهر و امضای مدیر آموزشگاه: ........................</span>
                      </div>
                    )}
                  </footer>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportCardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">در حال بارگذاری کارنامه...</p>
        </div>
      }
    >
      <ReportCardContent />
    </Suspense>
  );
}
