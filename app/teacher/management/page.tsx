'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CalendarX2,
  ChevronLeft,
  GraduationCap,
  Loader2,
  MapPin,
  Printer,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Users,
  BookOpen,
} from 'lucide-react';
import { getManagementData } from '@/app/actions';
import type { Attendance, ClassInfo, Course, Grade, Student } from '@/types';
import {
  buildCoursePerformanceRows,
  compareJalaliDatesAsc,
  filterStudentsByAbsenceThreshold,
  filterStudentsByLowScore,
  getScoreDescriptiveLabel,
  normalizePersianText,
  resolveAbsenceType,
  sortStudentsAlphabetically,
  toPersianDigits,
  type StudentWithClassMeta,
} from '@/lib/teacherReports';
import { normalizeCityName } from '@/lib/provinces';
import { getTeacherSessionToken } from '@/lib/clientSession';

type ManagementTab = 'teachers' | 'absences' | 'low-scores';
type TeacherDetailTab = 'students' | 'course-report';

interface ViewerInfo {
  _id: string;
  role: 'adminstor' | 'ceo';
  teacherName: string;
  schoolName: string;
  province: string;
  city: string;
  cityScopeMissing: boolean;
}

export default function ManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');

  const [viewer, setViewer] = useState<ViewerInfo | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  // Active navigation & filters
  const [activeTab, setActiveTab] = useState<ManagementTab>('teachers');
  const [selectedProvince, setSelectedProvince] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [teacherSearch, setTeacherSearch] = useState<string>('');

  // Teacher drill-down state
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [teacherDetailTab, setTeacherDetailTab] = useState<TeacherDetailTab>('students');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // Threshold filters
  const [absenceThresholdInput, setAbsenceThresholdInput] = useState<string>('3');
  const [scoreThresholdInput, setScoreThresholdInput] = useState<string>('10');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getManagementData(getTeacherSessionToken());
        if (!res || !res.success) {
          setAccessError(res?.error || 'شما مجوز دسترسی به پنل مدیریت را ندارید.');
          return;
        }
        setViewer(res.viewer);
        setClasses(res.classes || []);
        setStudents(res.students || []);
        setCourses(res.courses || []);
        setGrades(res.grades || []);
        setAttendance(res.attendance || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Available provinces & cities (for CEO filter dropdowns)
  const availableProvinces = useMemo(() => {
    const set = new Set<string>();
    for (const c of classes) {
      if (c.province?.trim()) set.add(c.province.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [classes]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    for (const c of classes) {
      if (
        selectedProvince !== 'ALL' &&
        (c.province || '').trim() !== selectedProvince
      ) {
        continue;
      }
      if (c.city?.trim()) set.add(c.city.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [classes, selectedProvince]);

  // Scoped classes after optional CEO filters
  const visibleClasses = useMemo(() => {
    return classes.filter((c) => {
      if (viewer?.role === 'ceo') {
        if (selectedProvince !== 'ALL' && (c.province || '').trim() !== selectedProvince) {
          return false;
        }
        if (
          selectedCity !== 'ALL' &&
          normalizeCityName(c.city) !== normalizeCityName(selectedCity)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [classes, viewer, selectedProvince, selectedCity]);

  const visibleClassMap = useMemo(() => {
    const map = new Map<string, ClassInfo>();
    for (const c of visibleClasses) {
      map.set(String(c._id), c);
    }
    return map;
  }, [visibleClasses]);

  // Indexed lookups by classId for O(1) drill-down
  const studentsByClass = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const s of students) {
      const cid = String(s.classId || '');
      if (!visibleClassMap.has(cid)) continue;
      const arr = map.get(cid);
      if (arr) arr.push(s);
      else map.set(cid, [s]);
    }
    return map;
  }, [students, visibleClassMap]);

  const coursesByClass = useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const c of courses) {
      const cid = String(c.classId || '');
      if (!visibleClassMap.has(cid)) continue;
      const arr = map.get(cid);
      if (arr) arr.push(c);
      else map.set(cid, [c]);
    }
    return map;
  }, [courses, visibleClassMap]);

  const gradesByClass = useMemo(() => {
    const map = new Map<string, Grade[]>();
    for (const g of grades) {
      const cid = String(g.classId || '');
      if (!visibleClassMap.has(cid)) continue;
      const arr = map.get(cid);
      if (arr) arr.push(g);
      else map.set(cid, [g]);
    }
    return map;
  }, [grades, visibleClassMap]);

  const attendanceByClass = useMemo(() => {
    const map = new Map<string, Attendance[]>();
    for (const a of attendance) {
      const cid = String(a.classId || '');
      if (!visibleClassMap.has(cid)) continue;
      const arr = map.get(cid);
      if (arr) arr.push(a);
      else map.set(cid, [a]);
    }
    return map;
  }, [attendance, visibleClassMap]);

  // Flat list of all visible students + class metadata for cross-class analytics
  const allStudentMeta: StudentWithClassMeta[] = useMemo(() => {
    const list: StudentWithClassMeta[] = [];
    for (const cls of visibleClasses) {
      const cid = String(cls._id);
      const clsStudents = studentsByClass.get(cid) || [];
      const clsCourses = coursesByClass.get(cid) || [];
      const clsGrades = gradesByClass.get(cid) || [];
      const clsAttendance = attendanceByClass.get(cid) || [];
      for (const student of clsStudents) {
        list.push({
          student,
          teacherClass: cls,
          courses: clsCourses,
          grades: clsGrades,
          attendance: clsAttendance,
        });
      }
    }
    return list;
  }, [visibleClasses, studentsByClass, coursesByClass, gradesByClass, attendanceByClass]);

  // Search-filtered teachers list
  const filteredTeachers = useMemo(() => {
    const q = normalizePersianText(teacherSearch).toLowerCase();
    const list = visibleClasses.filter((cls) => {
      if (!q) return true;
      const hay = normalizePersianText(
        `${cls.teacherName} ${cls.schoolName} ${cls.className} ${cls.gradeLevel} ${cls.city}`
      ).toLowerCase();
      return hay.includes(q);
    });
    return list.sort((a, b) =>
      (a.teacherName || '').localeCompare(b.teacherName || '', 'fa')
    );
  }, [visibleClasses, teacherSearch]);

  // Summary KPIs
  const totalVisibleStudents = allStudentMeta.length;
  const uniqueSchoolsCount = useMemo(() => {
    const set = new Set<string>();
    for (const c of visibleClasses) {
      const norm = normalizePersianText(c.schoolName);
      if (norm) set.add(norm);
    }
    return set.size;
  }, [visibleClasses]);

  // Selected teacher drill-down data
  const selectedTeacher = selectedTeacherId
    ? visibleClassMap.get(selectedTeacherId) || null
    : null;

  const teacherStudents = useMemo(() => {
    if (!selectedTeacherId) return [];
    return sortStudentsAlphabetically(
      studentsByClass.get(selectedTeacherId) || [],
      'lastName'
    );
  }, [selectedTeacherId, studentsByClass]);

  const teacherCourses = useMemo(() => {
    if (!selectedTeacherId) return [];
    return coursesByClass.get(selectedTeacherId) || [];
  }, [selectedTeacherId, coursesByClass]);

  const teacherGrades = useMemo(() => {
    if (!selectedTeacherId) return [];
    return gradesByClass.get(selectedTeacherId) || [];
  }, [selectedTeacherId, gradesByClass]);

  const teacherAttendance = useMemo(() => {
    if (!selectedTeacherId) return [];
    return attendanceByClass.get(selectedTeacherId) || [];
  }, [selectedTeacherId, attendanceByClass]);

  // Auto-select first course when switching to a teacher
  useEffect(() => {
    if (!selectedTeacherId) {
      setSelectedCourseId('');
      setSelectedStudentId(null);
      return;
    }
    const list = coursesByClass.get(selectedTeacherId) || [];
    setSelectedCourseId(list[0]?._id || '');
    setSelectedStudentId(null);
    setTeacherDetailTab('students');
  }, [selectedTeacherId, coursesByClass]);

  const selectedStudent = useMemo(
    () => teacherStudents.find((s) => s._id === selectedStudentId) || null,
    [teacherStudents, selectedStudentId]
  );

  // Selected student breakdown (course averages + absences)
  const selectedStudentBreakdown = useMemo(() => {
    if (!selectedStudent) return null;
    const sGrades = teacherGrades.filter(
      (g) => String(g.studentId) === String(selectedStudent._id) && typeof g.score === 'number'
    );
    const sAttendance = teacherAttendance
      .filter(
        (a) =>
          String(a.studentId) === String(selectedStudent._id) &&
          (!a.status || a.status === 'absent')
      )
      .sort((a, b) => compareJalaliDatesAsc(a.date, b.date));

    let excused = 0;
    let unexcused = 0;
    for (const a of sAttendance) {
      if (resolveAbsenceType(a) === 'excused') excused += 1;
      else unexcused += 1;
    }

    const courseRows = teacherCourses.map((course) => {
      const cGrades = sGrades.filter(
        (g) => String(g.courseId) === String(course._id)
      );
      const avg =
        cGrades.length > 0
          ? Number(
              (cGrades.reduce((sum, g) => sum + g.score, 0) / cGrades.length).toFixed(2)
            )
          : null;
      return {
        course,
        count: cGrades.length,
        average: avg,
        descriptive: avg !== null ? getScoreDescriptiveLabel(avg) : null,
      };
    });

    const overallAverage =
      sGrades.length > 0
        ? Number(
            (sGrades.reduce((sum, g) => sum + g.score, 0) / sGrades.length).toFixed(2)
          )
        : null;

    return {
      courseRows,
      overallAverage,
      absences: sAttendance,
      totalAbsences: sAttendance.length,
      excusedAbsences: excused,
      unexcusedAbsences: unexcused,
    };
  }, [selectedStudent, teacherCourses, teacherGrades, teacherAttendance]);

  // Selected course printable rows
  const coursePerformanceRows = useMemo(() => {
    if (!selectedTeacherId || !selectedCourseId) return [];
    return buildCoursePerformanceRows(teacherStudents, teacherGrades, selectedCourseId);
  }, [selectedTeacherId, selectedCourseId, teacherStudents, teacherGrades]);

  const selectedCourseObj = useMemo(
    () => teacherCourses.find((c) => c._id === selectedCourseId) || null,
    [teacherCourses, selectedCourseId]
  );

  // Threshold analytics results
  const parsedAbsenceThreshold = Number.isFinite(Number(absenceThresholdInput))
    ? Math.max(0, Number(absenceThresholdInput))
    : 0;
  const absenceAlertRows = useMemo(
    () => filterStudentsByAbsenceThreshold(allStudentMeta, parsedAbsenceThreshold),
    [allStudentMeta, parsedAbsenceThreshold]
  );

  const parsedScoreThreshold = Number.isFinite(Number(scoreThresholdInput))
    ? Math.max(0, Math.min(20, Number(scoreThresholdInput)))
    : 10;
  const lowScoreAlertRows = useMemo(
    () => filterStudentsByLowScore(allStudentMeta, parsedScoreThreshold),
    [allStudentMeta, parsedScoreThreshold]
  );

  const printDate = useMemo(() => new Date().toLocaleDateString('fa-IR'), []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">در حال بارگذاری پنل مدیریت...</p>
      </div>
    );
  }

  if (accessError || !viewer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" dir="rtl">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 mb-2">عدم دسترسی</h1>
          <p className="text-sm text-slate-600 mb-6">
            {accessError || 'شما مجوز مشاهده این بخش را ندارید.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/teacher')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-bold transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به پنل معلم</span>
          </button>
        </div>
      </div>
    );
  }

  const isCeo = viewer.role === 'ceo';

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 pb-12 print:bg-white print:pb-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Top Navigation & Context Bar (hidden on print) */}
      <header className="print:hidden bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push('/teacher')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
              <span>پنل معلم</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-5 h-5 shrink-0 ${isCeo ? 'text-indigo-600' : 'text-emerald-600'}`} />
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                  {isCeo
                    ? 'پنل مدیریت کل سامانه (CEO)'
                    : `پنل مدیریت شهرستان ${viewer.city || 'کل'}`}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {viewer.teacherName || 'مدیر سامانه'}
                {viewer.province ? ` · استان ${viewer.province}` : ''}
                {viewer.city ? ` · شهرستان ${viewer.city}` : ''}
              </p>
            </div>
          </div>

          {/* CEO Province / City Scope Filters */}
          {isCeo && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                <select
                  aria-label="فیلتر استان"
                  value={selectedProvince}
                  onChange={(e) => {
                    setSelectedProvince(e.target.value);
                    setSelectedCity('ALL');
                    setSelectedTeacherId(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium outline-none focus:border-indigo-500"
                >
                  <option value="ALL">همه استان‌ها</option>
                  {availableProvinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <select
                aria-label="فیلتر شهرستان"
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setSelectedTeacherId(null);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-medium outline-none focus:border-indigo-500"
              >
                <option value="ALL">همه شهرستان‌ها</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 border-t border-slate-100 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('teachers')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'teachers'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>معلمان و کلاس‌ها ({toPersianDigits(visibleClasses.length)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('absences')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'absences'
                ? 'border-orange-600 text-orange-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarX2 className="w-4 h-4" />
            <span>فیلتر حد مجاز غیبت ({toPersianDigits(absenceAlertRows.length)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('low-scores')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'low-scores'
                ? 'border-red-600 text-red-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>فیلتر نمرات پایین ({toPersianDigits(lowScoreAlertRows.length)})</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6 print:max-w-none print:px-0 print:pt-0">
        {viewer.cityScopeMissing && (
          <div className="print:hidden bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
            برای حساب کاربری شما شهرستان ثبت نشده است؛ بنابراین اطلاعات همه کلاس‌های سامانه نمایش داده می‌شود.
          </div>
        )}

        {/* KPI Summary Strip (hidden on print) */}
        <section className="print:hidden grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-medium text-slate-500">تعداد معلمان / کلاس‌ها</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
              {toPersianDigits(visibleClasses.length)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-medium text-slate-500">مجموع دانش‌آموزان</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
              {toPersianDigits(totalVisibleStudents)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-medium text-slate-500">تعداد مدارس ثبت‌شده</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
              {toPersianDigits(uniqueSchoolsCount)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-medium text-slate-500">محدوده نظارت</p>
            <p className="text-base font-extrabold text-slate-900 mt-2 truncate">
              {isCeo
                ? selectedCity !== 'ALL'
                  ? selectedCity
                  : selectedProvince !== 'ALL'
                  ? `استان ${selectedProvince}`
                  : 'سراسر سامانه'
                : viewer.city || 'کل سامانه'}
            </p>
          </div>
        </section>

        {/* ================= TAB 1: TEACHERS & DRILL-DOWN ================= */}
        {activeTab === 'teachers' && (
          <>
            {!selectedTeacher ? (
              <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      لیست معلمان و کلاس‌ها
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      برای مشاهده لیست دانش‌آموزان، میانگین دروس، غیبت‌ها و گزارش قابل پرینت هر درس روی نام معلم کلیک کنید.
                    </p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={teacherSearch}
                      onChange={(e) => setTeacherSearch(e.target.value)}
                      placeholder="جستجو نام معلم، مدرسه یا کلاس..."
                      className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {filteredTeachers.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    هیچ معلمی در این محدوده یافت نشد.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                          <th className="py-3 px-4 text-center w-14">ردیف</th>
                          <th className="py-3 px-4 text-right">نام و نام خانوادگی معلم</th>
                          <th className="py-3 px-4 text-right">نام مدرسه</th>
                          <th className="py-3 px-4 text-right">پایه / کلاس</th>
                          <th className="py-3 px-4 text-right">شهرستان</th>
                          <th className="py-3 px-4 text-center">دانش‌آموزان</th>
                          <th className="py-3 px-4 text-center w-28">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTeachers.map((cls, idx) => {
                          const count = (studentsByClass.get(String(cls._id)) || []).length;
                          const levelsLabel =
                            cls.gradeLevels && cls.gradeLevels.length > 0
                              ? cls.gradeLevels.join('، ')
                              : cls.gradeLevel || cls.className || '—';
                          return (
                            <tr
                              key={cls._id}
                              onClick={() => setSelectedTeacherId(String(cls._id))}
                              className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                            >
                              <td className="py-3.5 px-4 text-center text-slate-500 tabular-nums font-medium">
                                {toPersianDigits(idx + 1)}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-slate-900">
                                {cls.teacherName || 'بدون نام'}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">
                                {cls.schoolName || 'ثبت نشده'}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">
                                <span>{levelsLabel}</span>
                                {cls.className && cls.className !== levelsLabel && (
                                  <span className="text-xs text-slate-400 mr-1.5">
                                    ({cls.className})
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                {cls.city || 'ثبت نشده'}
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold tabular-nums text-slate-800">
                                {toPersianDigits(count)} نفر
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">
                                  <span>مشاهده</span>
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : (
              /* TEACHER DRILL-DOWN VIEW */
              <div className="space-y-5">
                {/* Teacher header bar (hidden on print) */}
                <div className="print:hidden bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTeacherId(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold whitespace-nowrap"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>بازگشت به لیست معلمان</span>
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                        {selectedTeacher.teacherName || 'معلم'}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span>مدرسه: {selectedTeacher.schoolName || 'ثبت نشده'}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          پایه: {selectedTeacher.gradeLevel || selectedTeacher.className || 'ثبت نشده'}
                        </span>
                        {selectedTeacher.city && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>شهرستان: {selectedTeacher.city}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Sub-view switcher */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setTeacherDetailTab('students')}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition-colors whitespace-nowrap ${
                        teacherDetailTab === 'students'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>لیست دانش‌آموزان ({toPersianDigits(teacherStudents.length)})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeacherDetailTab('course-report')}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition-colors whitespace-nowrap ${
                        teacherDetailTab === 'course-report'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>لیست قابل پرینت درس</span>
                    </button>
                  </div>
                </div>

                {/* Sub-tab A: Student List + Click to see course averages & absences */}
                {teacherDetailTab === 'students' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          دانش‌آموزان این کلاس
                        </h3>
                        <span className="text-xs text-slate-500">
                          برای مشاهده ریز میانگین دروس و غیبت‌ها روی دانش‌آموز کلیک کنید
                        </span>
                      </div>
                      {teacherStudents.length === 0 ? (
                        <div className="py-14 text-center text-sm text-slate-500">
                          دانش‌آموزی برای این معلم ثبت نشده است.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                                <th className="py-2.5 px-3 text-center w-12">ردیف</th>
                                <th className="py-2.5 px-3 text-right">نام و نام خانوادگی</th>
                                <th className="py-2.5 px-3 text-right">نام پدر</th>
                                <th className="py-2.5 px-3 text-center">غیبت</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {teacherStudents.map((st, idx) => {
                                const isActive = st._id === selectedStudentId;
                                const stAbsCount = teacherAttendance.filter(
                                  (a) =>
                                    String(a.studentId) === String(st._id) &&
                                    (!a.status || a.status === 'absent')
                                ).length;
                                return (
                                  <tr
                                    key={st._id}
                                    onClick={() => setSelectedStudentId(st._id)}
                                    className={`cursor-pointer transition-colors ${
                                      isActive
                                        ? 'bg-blue-50 font-bold'
                                        : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <td className="py-3 px-3 text-center text-slate-500 tabular-nums">
                                      {toPersianDigits(idx + 1)}
                                    </td>
                                    <td className="py-3 px-3 text-slate-900 font-semibold">
                                      {st.firstName} {st.lastName}
                                    </td>
                                    <td className="py-3 px-3 text-slate-600">
                                      {st.fatherName || '—'}
                                    </td>
                                    <td className="py-3 px-3 text-center tabular-nums font-bold text-slate-700">
                                      {toPersianDigits(stAbsCount)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Selected Student Course Averages & Absences */}
                    <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5">
                      {!selectedStudent || !selectedStudentBreakdown ? (
                        <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center text-slate-500">
                          <GraduationCap className="w-10 h-10 text-slate-300 mb-3" />
                          <p className="text-sm font-semibold text-slate-700">
                            یک دانش‌آموز را از لیست انتخاب کنید
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            میانگین نمرات هر درس و تعداد غیبت‌های دانش‌آموز اینجا نمایش داده می‌شود.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div className="pb-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-extrabold text-slate-900">
                                {selectedStudent.firstName} {selectedStudent.lastName}
                              </h3>
                              <p className="text-xs text-slate-500 mt-1">
                                نام پدر: {selectedStudent.fatherName || '—'}
                                {selectedStudent.nationalId
                                  ? ` · کد ملی: ${toPersianDigits(selectedStudent.nationalId)}`
                                  : ''}
                                {selectedStudent.level ? ` · پایه ${selectedStudent.level}` : ''}
                              </p>
                            </div>
                            <div className="text-left">
                              <span className="text-[11px] text-slate-500 block">معدل کل</span>
                              <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                                {selectedStudentBreakdown.overallAverage !== null
                                  ? toPersianDigits(selectedStudentBreakdown.overallAverage)
                                  : '—'}
                              </span>
                            </div>
                          </div>

                          {/* Absences summary */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                              <p className="text-[11px] text-slate-500">تعداد کل غیبت‌ها</p>
                              <p className="text-lg font-extrabold text-slate-900 mt-0.5 tabular-nums">
                                {toPersianDigits(selectedStudentBreakdown.totalAbsences)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-center">
                              <p className="text-[11px] text-emerald-700">غیبت موجه</p>
                              <p className="text-lg font-extrabold text-emerald-900 mt-0.5 tabular-nums">
                                {toPersianDigits(selectedStudentBreakdown.excusedAbsences)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-center">
                              <p className="text-[11px] text-red-700">غیبت غیرموجه</p>
                              <p className="text-lg font-extrabold text-red-900 mt-0.5 tabular-nums">
                                {toPersianDigits(selectedStudentBreakdown.unexcusedAbsences)}
                              </p>
                            </div>
                          </div>

                          {/* Course averages table */}
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-700 mb-2.5">
                              میانگین نمرات هر درس
                            </h4>
                            {selectedStudentBreakdown.courseRows.length === 0 ? (
                              <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                                درسی برای این کلاس ثبت نشده است.
                              </p>
                            ) : (
                              <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-xs sm:text-sm">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                      <th className="py-2.5 px-3 text-right">نام درس</th>
                                      <th className="py-2.5 px-3 text-center">تعداد نمره</th>
                                      <th className="py-2.5 px-3 text-center">میانگین</th>
                                      <th className="py-2.5 px-3 text-center">وضعیت</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {selectedStudentBreakdown.courseRows.map((row) => (
                                      <tr
                                        key={row.course._id}
                                        className={
                                          row.average !== null && row.average < 10
                                            ? 'bg-red-50/80 text-red-950'
                                            : ''
                                        }
                                      >
                                        <td className="py-2.5 px-3 font-semibold">
                                          {row.course.name}
                                        </td>
                                        <td className="py-2.5 px-3 text-center tabular-nums text-slate-600">
                                          {toPersianDigits(row.count)}
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-extrabold tabular-nums">
                                          {row.average !== null
                                            ? toPersianDigits(row.average)
                                            : '—'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-xs font-semibold">
                                          {row.descriptive || 'ثبت نشده'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab B: Printable Per-Course Student Table (Red < 10 / Green >= 10) */}
                {teacherDetailTab === 'course-report' && (
                  <div className="space-y-4">
                    <div className="print:hidden bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <span>انتخاب درس:</span>
                          <select
                            value={selectedCourseId}
                            onChange={(e) => setSelectedCourseId(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold outline-none focus:border-blue-500 min-w-[180px]"
                          >
                            {teacherCourses.length === 0 ? (
                              <option value="">درسی ثبت نشده است</option>
                            ) : (
                              teacherCourses.map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.name}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-red-200 border border-red-400 inline-block" />
                            <span>نیاز به تلاش بیشتر (کمتر از ۱۰)</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400 inline-block" />
                            <span>قابل قبول و بالاتر (۱۰ تا ۲۰)</span>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!selectedCourseId}
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <Printer className="w-4 h-4" />
                        <span>چاپ لیست درس</span>
                      </button>
                    </div>

                    {/* Printable course sheet */}
                    <section className="print-sheet bg-white border border-slate-200 rounded-2xl p-6 md:p-8 print:rounded-none">
                      <header className="text-center pb-4 mb-5 border-b border-slate-200 print:border-black">
                        <h3 className="text-lg md:text-xl font-extrabold text-black">
                          گزارش وضعیت تحصیلی دانش‌آموزان در درس «{selectedCourseObj?.name || '—'}»
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-700 print:text-black">
                          <span>معلم: {selectedTeacher.teacherName || 'ثبت نشده'}</span>
                          <span aria-hidden="true">·</span>
                          <span>مدرسه: {selectedTeacher.schoolName || 'ثبت نشده'}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            پایه / کلاس: {selectedTeacher.gradeLevel || selectedTeacher.className || 'ثبت نشده'}
                          </span>
                          {selectedTeacher.city && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>شهرستان: {selectedTeacher.city}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>تاریخ چاپ: {printDate}</span>
                        </div>
                      </header>

                      {!selectedCourseId || coursePerformanceRows.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-500">
                          دانش‌آموز یا درسی برای نمایش وجود ندارد.
                        </div>
                      ) : (
                        <div className="overflow-x-auto print:overflow-visible">
                          <table className="print-table w-full border-collapse border-2 border-black text-sm">
                            <thead>
                              <tr className="bg-slate-100 print:bg-slate-100 text-black font-bold">
                                <th className="border border-black py-2.5 px-3 text-center w-14">
                                  ردیف
                                </th>
                                <th className="border border-black py-2.5 px-4 text-right">
                                  نام و نام خانوادگی
                                </th>
                                <th className="border border-black py-2.5 px-4 text-right">
                                  نام پدر
                                </th>
                                <th className="border border-black py-2.5 px-3 text-right">
                                  نام مدرسه
                                </th>
                                <th className="border border-black py-2.5 px-3 text-center w-36">
                                  تعداد نمرات ثبت‌شده
                                </th>
                                <th className="border border-black py-2.5 px-3 text-center w-32">
                                  میانگین نمره
                                </th>
                                <th className="border border-black py-2.5 px-3 text-center w-40">
                                  ارزیابی توصیفی
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {coursePerformanceRows.map((row, idx) => {
                                const rowBgClass =
                                  row.status === 'low'
                                    ? 'bg-red-100 text-red-950 print:bg-red-100'
                                    : row.status === 'pass'
                                    ? 'bg-emerald-100 text-emerald-950 print:bg-emerald-100'
                                    : 'bg-white text-slate-700';

                                return (
                                  <tr key={row.student._id} className={`h-11 ${rowBgClass}`}>
                                    <td className="border border-black px-3 text-center font-semibold tabular-nums">
                                      {toPersianDigits(idx + 1)}
                                    </td>
                                    <td className="border border-black px-4 text-right font-bold">
                                      {row.student.firstName} {row.student.lastName}
                                    </td>
                                    <td className="border border-black px-4 text-right">
                                      {row.student.fatherName || '—'}
                                    </td>
                                    <td className="border border-black px-3 text-right font-semibold">
                                      {selectedTeacher.schoolName || 'ثبت نشده'}
                                    </td>
                                    <td className="border border-black px-3 text-center tabular-nums font-semibold">
                                      {toPersianDigits(row.gradeCount)}
                                    </td>
                                    <td className="border border-black px-3 text-center tabular-nums font-extrabold">
                                      {row.average !== null
                                        ? toPersianDigits(row.average)
                                        : 'ثبت نشده'}
                                    </td>
                                    <td className="border border-black px-3 text-center text-xs font-bold">
                                      {row.descriptive || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ================= TAB 2: ABSENCE THRESHOLD FILTER ================= */}
        {activeTab === 'absences' && (
          <div className="space-y-4">
            <div className="print:hidden bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800">
                  <span>نمایش دانش‌آموزان با تعداد غیبت بیشتر از:</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={absenceThresholdInput}
                    onChange={(e) => setAbsenceThresholdInput(e.target.value)}
                    className="w-24 px-3 py-2 rounded-xl border border-slate-300 text-center font-extrabold text-slate-900 tabular-nums outline-none focus:border-orange-500"
                  />
                  <span>روز</span>
                </label>
                <span className="text-xs text-slate-500">
                  ({toPersianDigits(absenceAlertRows.length)} دانش‌آموز یافت شد)
                </span>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ گزارش غیبت‌ها</span>
              </button>
            </div>

            <section className="print-sheet bg-white border border-slate-200 rounded-2xl p-6 md:p-8 print:rounded-none">
              <header className="text-center pb-4 mb-5 border-b border-slate-200 print:border-black">
                <h2 className="text-lg md:text-xl font-extrabold text-black">
                  لیست دانش‌آموزان دارای غیبت بیش از {toPersianDigits(parsedAbsenceThreshold)} روز
                </h2>
                <p className="text-xs text-slate-600 print:text-black mt-1.5">
                  محدوده: {isCeo ? (selectedCity !== 'ALL' ? selectedCity : 'کل سامانه') : viewer.city || 'کل سامانه'} · تاریخ گزارش: {printDate}
                </p>
              </header>

              {absenceAlertRows.length === 0 ? (
                <div className="py-14 text-center text-sm text-slate-500">
                  هیچ دانش‌آموزی با تعداد غیبت بیشتر از {toPersianDigits(parsedAbsenceThreshold)} روز یافت نشد.
                </div>
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="print-table w-full border-collapse border-2 border-black text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-100 print:bg-slate-100 text-black font-bold">
                        <th className="border border-black py-2.5 px-2.5 text-center w-12">ردیف</th>
                        <th className="border border-black py-2.5 px-3 text-right">نام و نام خانوادگی</th>
                        <th className="border border-black py-2.5 px-3 text-right">نام پدر</th>
                        <th className="border border-black py-2.5 px-3 text-right">نام مدرسه</th>
                        <th className="border border-black py-2.5 px-3 text-center">پایه</th>
                        <th className="border border-black py-2.5 px-3 text-right">نام معلم</th>
                        {isCeo && (
                          <th className="border border-black py-2.5 px-3 text-right">شهرستان</th>
                        )}
                        <th className="border border-black py-2.5 px-2.5 text-center">کل غیبت</th>
                        <th className="border border-black py-2.5 px-2.5 text-center">موجه / غیرموجه</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absenceAlertRows.map((row, idx) => (
                        <tr key={`${row.student._id}-${idx}`} className="h-11 bg-white">
                          <td className="border border-black px-2.5 text-center tabular-nums font-semibold">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="border border-black px-3 font-bold text-slate-900">
                            {row.student.firstName} {row.student.lastName}
                          </td>
                          <td className="border border-black px-3 text-slate-700">
                            {row.student.fatherName || '—'}
                          </td>
                          <td className="border border-black px-3 font-semibold text-slate-900">
                            {row.schoolName}
                          </td>
                          <td className="border border-black px-3 text-center">
                            {row.gradeLevel}
                          </td>
                          <td className="border border-black px-3 text-slate-800">
                            {row.teacherName}
                          </td>
                          {isCeo && (
                            <td className="border border-black px-3 text-slate-700">
                              {row.city}
                            </td>
                          )}
                          <td className="border border-black px-2.5 text-center font-extrabold text-red-700 bg-red-50 print:bg-red-50 tabular-nums">
                            {toPersianDigits(row.totalAbsences)}
                          </td>
                          <td className="border border-black px-2.5 text-center text-xs tabular-nums">
                            {toPersianDigits(row.excusedAbsences)} موجه · {toPersianDigits(row.unexcusedAbsences)} غیرموجه
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= TAB 3: LOW SCORE THRESHOLD FILTER ================= */}
        {activeTab === 'low-scores' && (
          <div className="space-y-4">
            <div className="print:hidden bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800">
                  <span>نمایش دانش‌آموزان دارای میانگین درس کمتر از:</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={scoreThresholdInput}
                    onChange={(e) => setScoreThresholdInput(e.target.value)}
                    className="w-24 px-3 py-2 rounded-xl border border-slate-300 text-center font-extrabold text-slate-900 tabular-nums outline-none focus:border-red-500"
                  />
                  <span>از ۲۰</span>
                </label>
                <span className="text-xs text-slate-500">
                  ({toPersianDigits(lowScoreAlertRows.length)} مورد یافت شد)
                </span>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ گزارش نمرات پایین</span>
              </button>
            </div>

            <section className="print-sheet bg-white border border-slate-200 rounded-2xl p-6 md:p-8 print:rounded-none">
              <header className="text-center pb-4 mb-5 border-b border-slate-200 print:border-black">
                <h2 className="text-lg md:text-xl font-extrabold text-black">
                  لیست دانش‌آموزان دارای میانگین کمتر از {toPersianDigits(parsedScoreThreshold)} در دروس
                </h2>
                <p className="text-xs text-slate-600 print:text-black mt-1.5">
                  محدوده: {isCeo ? (selectedCity !== 'ALL' ? selectedCity : 'کل سامانه') : viewer.city || 'کل سامانه'} · تاریخ گزارش: {printDate}
                </p>
              </header>

              {lowScoreAlertRows.length === 0 ? (
                <div className="py-14 text-center text-sm text-slate-500">
                  هیچ دانش‌آموزی با میانگین کمتر از {toPersianDigits(parsedScoreThreshold)} یافت نشد.
                </div>
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="print-table w-full border-collapse border-2 border-black text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-100 print:bg-slate-100 text-black font-bold">
                        <th className="border border-black py-2.5 px-2.5 text-center w-12">ردیف</th>
                        <th className="border border-black py-2.5 px-3 text-right">نام و نام خانوادگی</th>
                        <th className="border border-black py-2.5 px-3 text-right">نام پدر</th>
                        <th className="border border-black py-2.5 px-3 text-right">نام درس</th>
                        <th className="border border-black py-2.5 px-2.5 text-center">میانگین</th>
                        <th className="border border-black py-2.5 px-3 text-right">نام مدرسه</th>
                        <th className="border border-black py-2.5 px-2.5 text-center">پایه</th>
                        <th className="border border-black py-2.5 px-3 text-right">نام معلم</th>
                        {isCeo && (
                          <th className="border border-black py-2.5 px-3 text-right">شهرستان</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {lowScoreAlertRows.map((row, idx) => (
                        <tr key={`${row.student._id}-${row.courseName}-${idx}`} className="h-11 bg-red-50/50 print:bg-red-50">
                          <td className="border border-black px-2.5 text-center tabular-nums font-semibold">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="border border-black px-3 font-bold text-slate-900">
                            {row.student.firstName} {row.student.lastName}
                          </td>
                          <td className="border border-black px-3 text-slate-700">
                            {row.student.fatherName || '—'}
                          </td>
                          <td className="border border-black px-3 font-semibold text-slate-900">
                            {row.courseName}
                          </td>
                          <td className="border border-black px-2.5 text-center font-extrabold text-red-700 bg-red-100 print:bg-red-100 tabular-nums">
                            {toPersianDigits(row.courseAverage)}
                          </td>
                          <td className="border border-black px-3 font-semibold text-slate-900">
                            {row.schoolName}
                          </td>
                          <td className="border border-black px-2.5 text-center">
                            {row.gradeLevel}
                          </td>
                          <td className="border border-black px-3 text-slate-800">
                            {row.teacherName}
                          </td>
                          {isCeo && (
                            <td className="border border-black px-3 text-slate-700">
                              {row.city}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
