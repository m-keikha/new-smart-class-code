'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  BookOpen,
  GraduationCap,
  BrainCircuit,
  LogOut,
  Calendar,
  FileText,
  BarChart,
  Phone,
  Save,
  Trash2,
  UserX,
  BookMinus,
  ClipboardList,
  ChevronDown,
  ChevronLeft,
  CalendarX2,
  Users,
  FileSpreadsheet,
  ShieldCheck,
  School,
  Layers,
  MapPin,
  Search,
  X,
  BellRing,
  CalendarClock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  getTeacherData,
  addStudent,
  addCourse,
  addGrade,
  addAttendance,
  removeAttendance,
  updateAttendanceType,
  updateStudent,
  generateAIReportAction,
  saveAIReport,
  addHomework,
  addTeacherEvent,
  removeTeacherEvent,
  logoutAction,
  loginCheck,
  removeStudent,
  removeCourse,
  Level,
  getStudentResponse,
  addTeacherGradeLevel,
} from '../actions';
import {
  Student,
  Course,
  Grade,
  Attendance,
  Homework,
  ClassInfo,
  TeacherEvent,
} from '@/types';
import {
  compareJalaliDatesAsc,
  filterByActiveLevel,
  resolveAbsenceType,
  resolveTeacherLevels,
  sortStudentsAlphabetically,
  toPersianDigits,
} from '@/lib/teacherReports';
import {
  formatJalaliLongLabel,
  getTodayEvents,
  getTodayJalaliString,
} from '@/lib/jalaliCalendar';
import { GRADE_LEVEL_OPTIONS } from '@/lib/provinces';
import { clearTeacherClientSession, getTeacherSessionToken } from '@/lib/clientSession';
import Modal from '@/components/Modal';
import Toast from '@/components/notification';
import StudentResponseGrid from '@/components/StudentResponses';
import StudentProfileFields, {
  EMPTY_STUDENT_PROFILE,
  type StudentProfileFormValues,
} from '@/components/StudentProfileFields';
import JalaliDatePicker from '@/components/JalaliDatePicker';
import TeacherEventsPanel from '@/components/TeacherEventsPanel';

interface IQuestionResponse {
  listeningId: string;
  userResponse: string;
  correctAnswer: string;
  textQuestion: string;
  isCorrect: boolean;
  updatedAt?: Date;
}

interface IStudentResponseDoc {
  _id: string;
  classId: string;
  studentId: string;
  questions: IQuestionResponse[];
  createdAt: Date;
  __v: number;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'students' | 'courses' | 'leaderboard' | 'events'>('students');
  const [data, setData] = useState<{
    classInfo: ClassInfo | null;
    students: Student[];
    courses: Course[];
    grades: Grade[];
    attendance: Attendance[];
    homeworks: Homework[];
    events: TeacherEvent[];
  } | null>(null);
  const [dismissedTodayEvents, setDismissedTodayEvents] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Multi-grade-level state
  const [activeLevel, setActiveLevel] = useState<string>('ALL');
  const [showAddLevelBox, setShowAddLevelBox] = useState(false);
  const [newGradeLevelName, setNewGradeLevelName] = useState('');
  const [addingLevel, setAddingLevel] = useState(false);

  const [studentSearch, setStudentSearch] = useState('');
  const [newStudent, setNewStudent] = useState({
    firstName: '',
    lastName: '',
    nationalId: '',
    fatherName: '',
  });
  const [newCourseName, setNewCourseName] = useState('');
  const [newGrade, setNewGrade] = useState({
    courseId: '',
    score: '',
    description: '',
    date: getTodayJalaliString(),
  });
  const [newHomework, setNewHomework] = useState({
    title: '',
    description: '',
    dueDate: '',
    target: 'ALL',
    displayDays: '7',
  });

  const [studentReadingData, setstudentReadingData] = useState<IStudentResponseDoc[]>();
  const [studentNote, setStudentNote] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [newStudentProfile, setNewStudentProfile] = useState<StudentProfileFormValues>({
    ...EMPTY_STUDENT_PROFILE,
  });
  const [editStudentProfile, setEditStudentProfile] = useState<StudentProfileFormValues>({
    ...EMPTY_STUDENT_PROFILE,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [manualAbsenceDate, setManualAbsenceDate] = useState('');
  const [absenceType, setAbsenceType] = useState<'unexcused' | 'excused'>('unexcused');
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [teacherName, setTeacherName] = useState('');

  // Inline panels
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showAddHomework, setShowAddHomework] = useState(false);
  const [showLevels, setShowLevels] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [showMessage, setShowMessage] = useState<boolean>(false);
  const [password, setPassword] = useState('');
  const [isShowStResponses, setIsShowStResponses] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setMessage(msg);
    setShowMessage(true);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = getTeacherSessionToken();
      const isLogin = await loginCheck(token);
      if (!isLogin || !isLogin.success) {
        clearTeacherClientSession();
        router.push('/');
        return;
      }
      loadData();
    };
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStudentId = selectedStudent?._id ?? null;

  useEffect(() => {
    if (selectedStudent) {
      setStudentPhone(selectedStudent.phoneNumber || '');
      setEditStudentProfile({
        specialDisease: selectedStudent.specialDisease || '',
        isLeftHanded: Boolean(selectedStudent.isLeftHanded),
        guardianName: selectedStudent.guardianName || '',
        guardianRelation: selectedStudent.guardianRelation || '',
        guardianPhone: selectedStudent.guardianPhone || '',
        messengerType: selectedStudent.messengerType || '',
        remoteAccessMethods: Array.isArray(selectedStudent.remoteAccessMethods)
          ? [...selectedStudent.remoteAccessMethods]
          : [],
      });
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedStudentId) {
      setStudentNote('');
      setManualAbsenceDate('');
      setAbsenceType('unexcused');
    }
  }, [selectedStudentId]);

  const loadData = async () => {
    const storedName = localStorage.getItem('name') || '';
    const res = await getTeacherData(getTeacherSessionToken());
    if (!res || 'error' in res) {
      clearTeacherClientSession();
      router.push('/');
      return;
    }

    const loaded = res as {
      classInfo: ClassInfo | null;
      students: Student[];
      courses: Course[];
      grades: Grade[];
      attendance: Attendance[];
      homeworks: Homework[];
      events?: TeacherEvent[];
    };

    setData({
      ...loaded,
      events: Array.isArray(loaded.events) ? loaded.events : [],
    });
    const resolvedTeacherName = loaded.classInfo?.teacherName || storedName || 'همکار گرامی';
    setTeacherName(resolvedTeacherName);

    const levelsList = resolveTeacherLevels(
      loaded.classInfo,
      loaded.students || [],
      loaded.courses || []
    );

    const savedLevel = localStorage.getItem('teacher_active_level');
    if (savedLevel && (savedLevel === 'ALL' || levelsList.includes(savedLevel))) {
      setActiveLevel(savedLevel);
    } else if (levelsList.length > 0) {
      setActiveLevel(levelsList[0]);
    } else {
      setActiveLevel('ALL');
    }

    if (selectedStudent) {
      const updatedStudent = (loaded.students || []).find(
        (s: Student) => s._id === selectedStudent._id
      );
      if (updatedStudent) setSelectedStudent(updatedStudent);
    }
  };

  const availableLevels = useMemo(
    () =>
      resolveTeacherLevels(
        data?.classInfo,
        data?.students || [],
        data?.courses || []
      ),
    [data?.classInfo, data?.students, data?.courses]
  );

  // Filtered collections by active grade level (legacy docs without `level` appear everywhere)
  const visibleStudents = useMemo(() => {
    if (!data) return [];
    const byLevel = filterByActiveLevel(data.students, activeLevel);
    const sorted = sortStudentsAlphabetically(byLevel, 'lastName');
    const q = studentSearch.trim();
    if (!q) return sorted;
    return sorted.filter((s) =>
      `${s.firstName} ${s.lastName} ${s.fatherName || ''} ${s.nationalId || ''}`.includes(q)
    );
  }, [data, activeLevel, studentSearch]);

  const visibleCourses = useMemo(() => {
    if (!data) return [];
    return filterByActiveLevel(data.courses, activeLevel);
  }, [data, activeLevel]);

  const handleSelectLevel = (lvl: string) => {
    setActiveLevel(lvl);
    localStorage.setItem('teacher_active_level', lvl);
    setSelectedStudent(null);
  };

  const handleAddGradeLevel = async () => {
    const clean = newGradeLevelName.trim();
    if (!clean) return;
    setAddingLevel(true);
    try {
      const res = await addTeacherGradeLevel(clean, getTeacherSessionToken());
      if (res.success) {
        setNewGradeLevelName('');
        setShowAddLevelBox(false);
        setActiveLevel(clean);
        localStorage.setItem('teacher_active_level', clean);
        showToast(`پایه «${clean}» با موفقیت اضافه شد`);
        await loadData();
      } else {
        showToast(res.error || 'خطا در ثبت پایه جدید');
      }
    } finally {
      setAddingLevel(false);
    }
  };

  const handleLogout = async () => {
    clearTeacherClientSession();
    await logoutAction();
    router.push('/');
  };

  const getTodayDate = () => new Date().toLocaleDateString('fa-IR');

  const isAbsent = (studentId: string, date: string) => {
    return data?.attendance.some((a) => a.studentId === studentId && a.date === date);
  };

  const getStudentAverage = (studentId: string) => {
    if (!data) return 0;
    const sGrades = data.grades.filter((g) => g.studentId === studentId);
    if (sGrades.length === 0) return 0;
    const sum = sGrades.reduce((a, b) => a + b.score, 0);
    return parseFloat((sum / sGrades.length).toFixed(2));
  };

  const getCourseAverage = (studentId: string, courseId: string) => {
    if (!data) return '-';
    const sGrades = data.grades.filter(
      (g) => g.studentId === studentId && g.courseId === courseId
    );
    if (sGrades.length === 0) return '-';
    const sum = sGrades.reduce((a, b) => a + b.score, 0);
    return (sum / sGrades.length).toFixed(2);
  };

  const handleAddStudent = async () => {
    if (!newStudent.firstName.trim()) return;
    const levelToSave =
      activeLevel !== 'ALL' ? activeLevel : data?.classInfo?.gradeLevel || '';
    const correctionNewStudent = {
      ...newStudent,
      password: newStudent.nationalId,
      level: levelToSave,
      specialDisease: newStudentProfile.specialDisease.trim(),
      isLeftHanded: Boolean(newStudentProfile.isLeftHanded),
      guardianName: newStudentProfile.guardianName.trim(),
      guardianRelation: newStudentProfile.guardianRelation.trim(),
      guardianPhone: newStudentProfile.guardianPhone.trim(),
      messengerType: newStudentProfile.messengerType.trim(),
      remoteAccessMethods: newStudentProfile.remoteAccessMethods,
      ...(newStudentProfile.guardianPhone.trim()
        ? { phoneNumber: newStudentProfile.guardianPhone.trim() }
        : {}),
    };

    await addStudent(correctionNewStudent, getTeacherSessionToken());
    setNewStudent({ firstName: '', lastName: '', nationalId: '', fatherName: '' });
    setNewStudentProfile({ ...EMPTY_STUDENT_PROFILE });
    setShowAddStudent(false);
    showToast('دانش‌آموز جدید با موفقیت اضافه شد');
    loadData();
  };

  const handleAddCourse = async () => {
    if (!newCourseName.trim()) return;
    const levelToSave =
      activeLevel !== 'ALL' ? activeLevel : data?.classInfo?.gradeLevel || '';
    await addCourse(newCourseName.trim(), levelToSave, getTeacherSessionToken());
    setNewCourseName('');
    setShowAddCourse(false);
    showToast('درس جدید با موفقیت ثبت شد');
    loadData();
  };

  const handleAddGrade = async () => {
    if (!selectedStudent || !newGrade.courseId) return;
    const getScore = await addGrade(
      {
        studentId: selectedStudent._id,
        courseId: newGrade.courseId,
        score: Number(newGrade.score),
        description: newGrade.description,
        date: newGrade.date || getTodayDate(),
      },
      getTeacherSessionToken()
    );
    if (getScore === true) {
      showToast('نمره با موفقیت ثبت شد');
    } else {
      showToast('نمره ثبت نشد! مجدداً تلاش کنید');
    }
    setNewGrade((prev) => ({ ...prev, score: '', description: '' }));
    loadData();
  };

  const handleAddHomework = async () => {
    if (!newHomework.title.trim()) return;
    const levelToSave =
      activeLevel !== 'ALL' ? activeLevel : data?.classInfo?.gradeLevel || '';
    const parsedDays = Number(newHomework.displayDays);
    const displayDays =
      Number.isFinite(parsedDays) && parsedDays > 0
        ? Math.min(365, Math.round(parsedDays))
        : 7;
    await addHomework(
      {
        title: newHomework.title.trim(),
        description: newHomework.description.trim(),
        dueDate: newHomework.dueDate.trim(),
        target: newHomework.target,
        displayDays,
        level: levelToSave,
      },
      getTeacherSessionToken()
    );
    setNewHomework({
      title: '',
      description: '',
      dueDate: '',
      target: 'ALL',
      displayDays: '7',
    });
    setShowAddHomework(false);
    showToast(`تکلیف برای نمایش به مدت ${toPersianDigits(displayDays)} روز ارسال شد`);
    loadData();
  };

  const handleAddTeacherEvent = async (payload: {
    date: string;
    title: string;
    description: string;
  }) => {
    const levelToSave =
      activeLevel !== 'ALL' ? activeLevel : data?.classInfo?.gradeLevel || '';
    const res = await addTeacherEvent(
      {
        ...payload,
        level: levelToSave,
      },
      getTeacherSessionToken()
    );
    if (res?.success) {
      setDismissedTodayEvents(false);
      showToast('رویداد با موفقیت ثبت شد');
      await loadData();
      return true;
    }
    showToast(res?.error || 'خطا در ثبت رویداد');
    return false;
  };

  const handleDeleteTeacherEvent = async (eventId: string) => {
    const res = await removeTeacherEvent(eventId, getTeacherSessionToken());
    if (res?.success) {
      showToast('رویداد با موفقیت حذف شد');
      await loadData();
    } else {
      showToast(res?.error || 'خطا در حذف رویداد');
    }
  };

  const handleToggleAbsence = async (
    studentId: string,
    date: string,
    selectedType: 'excused' | 'unexcused' = absenceType
  ) => {
    const trimmedDate = date.trim();
    if (!trimmedDate) return;
    if (isAbsent(studentId, trimmedDate)) {
      await removeAttendance(studentId, trimmedDate);
      showToast('غیبت با موفقیت حذف شد');
    } else {
      await addAttendance(studentId, trimmedDate, selectedType, getTeacherSessionToken());
      showToast(selectedType === 'excused' ? 'غیبت موجه ثبت شد' : 'غیبت غیرموجه ثبت شد');
    }
    loadData();
  };

  const handleSwitchAbsenceType = async (
    attendanceId: string,
    currentType: 'excused' | 'unexcused'
  ) => {
    const nextType = currentType === 'excused' ? 'unexcused' : 'excused';
    await updateAttendanceType(attendanceId, nextType, getTeacherSessionToken());
    showToast(
      nextType === 'excused'
        ? 'نوع غیبت به موجه تغییر یافت'
        : 'نوع غیبت به غیرموجه تغییر یافت'
    );
    loadData();
  };

  const handleSaveStudentInfo = async () => {
    if (!selectedStudent) return;
    const updates: any = {};
    if (studentPhone !== undefined) updates.phoneNumber = studentPhone.trim();
    if (studentNote) {
      const currentNotes = selectedStudent.dailyNotes || [];
      updates.dailyNotes = [...currentNotes, { date: getTodayDate(), content: studentNote }];
    }
    await updateStudent(selectedStudent._id, updates);
    setStudentNote('');
    showToast('اطلاعات تماس و یادداشت با موفقیت ذخیره شد');
    loadData();
  };

  const handleSaveStudentProfile = async () => {
    if (!selectedStudent || savingProfile) return;
    setSavingProfile(true);
    try {
      const updates: any = {
        specialDisease: editStudentProfile.specialDisease.trim(),
        isLeftHanded: Boolean(editStudentProfile.isLeftHanded),
        guardianName: editStudentProfile.guardianName.trim(),
        guardianRelation: editStudentProfile.guardianRelation.trim(),
        guardianPhone: editStudentProfile.guardianPhone.trim(),
        messengerType: editStudentProfile.messengerType.trim(),
        remoteAccessMethods: editStudentProfile.remoteAccessMethods,
      };
      if (!selectedStudent.phoneNumber && editStudentProfile.guardianPhone.trim()) {
        updates.phoneNumber = editStudentProfile.guardianPhone.trim();
      }
      await updateStudent(selectedStudent._id, updates);
      showToast('مشخصات تکمیلی دانش‌آموز با موفقیت ذخیره شد');
      await loadData();
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAI = async () => {
    if (!selectedStudent || !data) return;
    setIsGeneratingAI(true);
    const sGrades = data.grades.filter((g) => g.studentId === selectedStudent._id);
    const reportText = await generateAIReportAction(selectedStudent, sGrades, visibleCourses);
    await saveAIReport(selectedStudent._id, reportText);
    setIsGeneratingAI(false);
    loadData();
  };

  const confirmModalManage = async () => {
    if (!selectedStudent) return;
    const removedStudent = await removeStudent(selectedStudent._id);
    setShowModal(false);
    if (removedStudent) {
      showToast(`${removedStudent.firstName} ${removedStudent.lastName} با موفقیت حذف شد`);
      setSelectedStudent(null);
      loadData();
    }
  };

  const removeLesson = async (courseId: string) => {
    await removeCourse(courseId);
    showToast('درس حذف شد');
    loadData();
  };

  const studentPassManage = async () => {
    if (!selectedStudent) return;
    if (password.length < 8) {
      showToast('رمز عبور بایستی حداقل ۸ کاراکتر باشد');
      return;
    }
    const updatedPass = await updateStudent(selectedStudent._id, { password });
    if (updatedPass?.success === true) {
      showToast('رمز عبور با موفقیت تغییر کرد');
      setPassword('');
    }
  };

  const farsiDirectHander = (level: Level) => {
    router.push(`/teacher/listening-page?level=${level}`);
  };

  const responsesPageHandler = async () => {
    const res = await getStudentResponse(getTeacherSessionToken());
    if (res.success) setstudentReadingData(res.result);
    setIsShowStResponses(true);
  };

  const navigateWithLevel = (path: string) => {
    const query =
      activeLevel && activeLevel !== 'ALL'
        ? `?level=${encodeURIComponent(activeLevel)}`
        : '';
    router.push(`${path}${query}`);
  };

  const readingLevels: Level[] = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
        در حال دریافت اطلاعات...
      </div>
    );
  }

  const classInfo = data.classInfo;
  const canAccessManagement =
    classInfo?.role === 'adminstor' || classInfo?.role === 'ceo';

  const todayDate = getTodayDate();
  const todayJalaliAscii = getTodayJalaliString();
  const todayEvents = getTodayEvents(data.events || [], todayJalaliAscii);
  const todayAbsencesCount = visibleStudents.filter((s) =>
    isAbsent(s._id, todayDate)
  ).length;
  const classAvg = (() => {
    const avgs = visibleStudents
      .map((s) => getStudentAverage(s._id))
      .filter((a) => a > 0);
    if (avgs.length === 0) return '—';
    return toPersianDigits(
      (avgs.reduce((sum, a) => sum + a, 0) / avgs.length).toFixed(2)
    );
  })();

  const displayGradeHeader =
    activeLevel !== 'ALL'
      ? `پایه ${activeLevel}`
      : classInfo?.gradeLevel
      ? `پایه ${classInfo.gradeLevel}`
      : classInfo?.className || '';

  return (
    <div dir="rtl" className="flex h-screen relative bg-slate-50 font-sans text-slate-900">
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onConfirm={confirmModalManage}
          title="حذف دانش‌آموز"
        >
          آیا نسبت به حذف دانش‌آموز و کلیه داده‌های آن مطمئن هستید؟
        </Modal>
      )}
      {showMessage && (
        <Toast
          message={message}
          duration={3000}
          onClose={() => {
            setShowMessage(false);
            setMessage('');
          }}
          isVisible={showMessage}
        />
      )}

      {/* Sidebar / Mobile Bottom Navigation */}
      <aside className="fixed md:static bottom-0 left-0 right-0 w-full md:w-72 bg-white/95 md:bg-white backdrop-blur-lg border-t md:border-t-0 md:border-l border-slate-200 flex flex-row md:flex-col z-50 md:h-screen shrink-0">
        {/* Brand */}
        <div className="hidden md:flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="bg-blue-600 text-white p-2.5 rounded-xl shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight truncate">
              مدرسه هوشمند
            </h1>
            <p className="text-[11px] text-slate-500 truncate">پنل مدیریت کلاس و ارزشیابی</p>
          </div>
        </div>

        {/* Teacher Identity Card (safe for legacy records without schoolName/gradeLevel) */}
        <div className="hidden md:block px-5 pt-4 pb-2">
          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-1.5">
            <p className="text-[11px] font-medium text-slate-500">خوش آمدید،</p>
            <p
              className="text-sm font-extrabold text-slate-900 truncate"
              title={teacherName}
            >
              {teacherName}
            </p>
            {(classInfo?.schoolName || displayGradeHeader) && (
              <div className="pt-1.5 border-t border-slate-200/70 space-y-1 text-xs text-slate-600">
                {classInfo?.schoolName && (
                  <p className="flex items-center gap-1.5 truncate" title={classInfo.schoolName}>
                    <School className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{classInfo.schoolName}</span>
                  </p>
                )}
                {displayGradeHeader && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{displayGradeHeader}</span>
                  </p>
                )}
                {classInfo?.city && (
                  <p className="flex items-center gap-1.5 truncate text-[11px] text-slate-500">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{classInfo.city}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <nav className="flex flex-row md:flex-col justify-around md:justify-start w-full p-2 md:p-4 md:gap-1.5 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('students');
              setSelectedStudent(null);
            }}
            className={`flex flex-col md:flex-row items-center justify-center md:justify-start p-2 md:px-3.5 md:py-3 rounded-xl transition-colors flex-1 md:flex-none ${
              activeTab === 'students'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <GraduationCap className="w-5 h-5 mb-1 md:mb-0 md:ml-3 shrink-0" />
            <span className="text-[10px] md:text-sm">دانش‌آموزان</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('courses');
              setSelectedStudent(null);
            }}
            className={`flex flex-col md:flex-row items-center justify-center md:justify-start p-2 md:px-3.5 md:py-3 rounded-xl transition-colors flex-1 md:flex-none ${
              activeTab === 'courses'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <BookOpen className="w-5 h-5 mb-1 md:mb-0 md:ml-3 shrink-0" />
            <span className="text-[10px] md:text-sm">درس‌ها</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('leaderboard');
              setSelectedStudent(null);
            }}
            className={`flex flex-col md:flex-row items-center justify-center md:justify-start p-2 md:px-3.5 md:py-3 rounded-xl transition-colors flex-1 md:flex-none ${
              activeTab === 'leaderboard'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <BarChart className="w-5 h-5 mb-1 md:mb-0 md:ml-3 shrink-0" />
            <span className="text-[10px] md:text-sm">رتبه‌بندی</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('events');
              setSelectedStudent(null);
            }}
            className={`flex flex-col md:flex-row items-center justify-center md:justify-between p-2 md:px-3.5 md:py-3 rounded-xl transition-colors flex-1 md:flex-none ${
              activeTab === 'events'
                ? 'bg-amber-50 text-amber-800 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <span className="flex flex-col md:flex-row items-center">
              <CalendarClock className="w-5 h-5 mb-1 md:mb-0 md:ml-3 shrink-0 text-amber-600" />
              <span className="text-[10px] md:text-sm">رویدادها</span>
            </span>
            {todayEvents.length > 0 && (
              <span className="hidden md:inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-amber-600 text-white text-[11px] font-extrabold tabular-nums">
                {toPersianDigits(todayEvents.length)}
              </span>
            )}
          </button>

          {/* گزارش‌گیری فعالیت‌ها */}
          <div className="relative flex-1 md:flex-none">
            <button
              type="button"
              aria-expanded={showReportsMenu}
              onClick={() => setShowReportsMenu((prev) => !prev)}
              className={`w-full flex flex-col md:flex-row items-center justify-center md:justify-between p-2 md:px-3.5 md:py-3 rounded-xl transition-colors ${
                showReportsMenu
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <span className="flex flex-col md:flex-row items-center">
                <ClipboardList className="w-5 h-5 mb-1 md:mb-0 md:ml-3 shrink-0" />
                <span className="text-[10px] md:text-sm whitespace-nowrap">
                  گزارش‌گیری فعالیت‌ها
                </span>
              </span>
              {showReportsMenu ? (
                <ChevronDown className="hidden md:block w-4 h-4 shrink-0" />
              ) : (
                <ChevronLeft className="hidden md:block w-4 h-4 shrink-0" />
              )}
            </button>

            {showReportsMenu && (
              <div className="hidden md:flex flex-col gap-1 mt-1.5 pr-3 border-r-2 border-slate-200">
                <button
                  type="button"
                  onClick={() => navigateWithLevel('/teacher/reports/absences')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-right"
                >
                  <CalendarX2 className="w-4 h-4 shrink-0 text-orange-500" />
                  <span>گزارش‌گیری غیبت‌های دانش‌آموزان</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateWithLevel('/teacher/reports/students')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-right"
                >
                  <Users className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>گزارش‌گیری لیست مشخصات دانش‌آموزان</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateWithLevel('/teacher/reports/report-card')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-right"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>کارنامه دانش‌آموزان</span>
                </button>
              </div>
            )}
          </div>

          {/* Conditional Management Button for adminstor & ceo */}
          {canAccessManagement && (
            <button
              type="button"
              onClick={() => router.push('/teacher/management')}
              className="flex flex-col md:flex-row items-center justify-center md:justify-start p-2 md:px-3.5 md:py-3 rounded-xl text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 transition-colors font-bold flex-1 md:flex-none md:mt-1"
            >
              <ShieldCheck className="w-5 h-5 mb-1 md:mb-0 md:ml-3 shrink-0 text-indigo-600" />
              <span className="text-[10px] md:text-sm">مدیریت</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="md:hidden flex flex-col items-center justify-center p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors flex-1"
          >
            <LogOut className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">خروج</span>
          </button>
        </nav>

        {/* Mobile Reports Sheet */}
        {showReportsMenu && (
          <div className="md:hidden fixed bottom-16 right-3 left-3 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-1.5 z-50">
            <p className="text-xs font-bold text-slate-500 px-2 pb-1 border-b border-slate-100">
              گزارش‌گیری فعالیت‌ها
            </p>
            <button
              type="button"
              onClick={() => {
                setShowReportsMenu(false);
                navigateWithLevel('/teacher/reports/absences');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-blue-50 text-right"
            >
              <CalendarX2 className="w-4 h-4 shrink-0 text-orange-500" />
              <span>گزارش‌گیری غیبت‌های دانش‌آموزان</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReportsMenu(false);
                navigateWithLevel('/teacher/reports/students');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-blue-50 text-right"
            >
              <Users className="w-4 h-4 shrink-0 text-blue-600" />
              <span>گزارش‌گیری لیست مشخصات دانش‌آموزان</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReportsMenu(false);
                navigateWithLevel('/teacher/reports/report-card');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-emerald-50 text-right"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>کارنامه دانش‌آموزان</span>
            </button>
          </div>
        )}

        <div className="hidden md:block mt-auto p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-red-600 bg-red-50/60 hover:bg-red-100 rounded-xl transition-colors text-sm font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج از پنل</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Today's Event Reminder Banner on Main Page */}
          {!selectedStudent && todayEvents.length > 0 && !dismissedTodayEvents && (
            <section
              role="region"
              aria-label="یادآور رویدادهای امروز"
              className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="bg-amber-600 text-white p-2 rounded-xl shrink-0">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-amber-950">
                      یادآور رویدادهای امروز ({formatJalaliLongLabel(todayJalaliAscii)})
                    </h2>
                    <p className="text-xs text-amber-800">
                      شما {toPersianDigits(todayEvents.length)} رویداد تنظیم‌شده برای امروز دارید.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {activeTab !== 'events' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('events')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                    >
                      مدیریت رویدادها
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDismissedTodayEvents(true)}
                    aria-label="بستن پیام رویداد امروز"
                    className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-200/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {todayEvents.map((ev) => (
                  <div
                    key={ev._id}
                    className="bg-white border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      {ev.title && (
                        <p className="text-sm font-extrabold text-slate-900 mb-0.5">
                          {ev.title}
                        </p>
                      )}
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                        {ev.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTeacherEvent(ev._id)}
                      aria-label={`حذف رویداد امروز ${ev.title || ev.description}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold shrink-0 self-end sm:self-center transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Teacher Profile & Multi-Grade-Level Header Banner */}
          {!selectedStudent && (
            <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      {teacherName}
                    </h2>
                    {classInfo?.role === 'ceo' && (
                      <span className="text-xs font-bold text-indigo-700">· مدیر کل (CEO)</span>
                    )}
                    {classInfo?.role === 'adminstor' && (
                      <span className="text-xs font-bold text-emerald-700">· مدیر شهرستان</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-600">
                    <span>
                      مدرسه: <strong className="text-slate-900">{classInfo?.schoolName || 'ثبت نشده'}</strong>
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>
                      پایه فعال:{' '}
                      <strong className="text-slate-900">
                        {activeLevel !== 'ALL'
                          ? `پایه ${activeLevel}`
                          : classInfo?.gradeLevel
                          ? `پایه ${classInfo.gradeLevel}`
                          : 'همه پایه‌ها'}
                      </strong>
                    </span>
                    {classInfo?.city && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span>شهرستان: {classInfo.city}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Compact KPI summary */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center min-w-[92px]">
                    <p className="text-[11px] text-slate-500">دانش‌آموزان</p>
                    <p className="text-lg font-extrabold text-slate-900 tabular-nums">
                      {toPersianDigits(visibleStudents.length)}
                    </p>
                  </div>
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center min-w-[92px]">
                    <p className="text-[11px] text-slate-500">غایب امروز</p>
                    <p className="text-lg font-extrabold text-orange-600 tabular-nums">
                      {toPersianDigits(todayAbsencesCount)}
                    </p>
                  </div>
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center min-w-[92px]">
                    <p className="text-[11px] text-slate-500">میانگین کلاس</p>
                    <p className="text-lg font-extrabold text-blue-700 tabular-nums">
                      {classAvg}
                    </p>
                  </div>
                </div>
              </div>

              {/* Multi-Grade-Level Switcher Bar */}
              <div className="pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ml-1">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>پایه‌های تحصیلی:</span>
                  </span>

                  {availableLevels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleSelectLevel('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        activeLevel === 'ALL'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      همه پایه‌ها
                    </button>
                  )}

                  {availableLevels.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleSelectLevel(lvl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        activeLevel === lvl
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      پایه {lvl}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setShowAddLevelBox((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-blue-400 text-blue-700 hover:bg-blue-50 text-xs font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن پایه جدید</span>
                  </button>
                </div>

                {showAddLevelBox && (
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <select
                      aria-label="انتخاب پایه جدید"
                      value={newGradeLevelName}
                      onChange={(e) => setNewGradeLevelName(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    >
                      <option value="">انتخاب پایه...</option>
                      {GRADE_LEVEL_OPTIONS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          پایه {lvl}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="یا نام پایه دلخواه..."
                      value={newGradeLevelName}
                      onChange={(e) => setNewGradeLevelName(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500 w-36"
                    />
                    <button
                      type="button"
                      disabled={addingLevel || !newGradeLevelName.trim()}
                      onClick={handleAddGradeLevel}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {addingLevel ? 'در حال ثبت...' : 'ثبت پایه'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddLevelBox(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-700"
                      aria-label="بستن"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================= SELECTED STUDENT DETAIL VIEW ================= */}
          {selectedStudent ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
              <div className="flex flex-wrap justify-between items-start gap-4 mb-6 border-b border-slate-100 pb-5">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-600">
                    <span>نام پدر: {selectedStudent.fatherName || '—'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      کد ملی: {selectedStudent.nationalId ? toPersianDigits(selectedStudent.nationalId) : '—'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-blue-700 tabular-nums">
                      میانگین کل: {toPersianDigits(getStudentAverage(selectedStudent._id))}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/teacher/reports/report-card?studentId=${selectedStudent._id}${
                          activeLevel !== 'ALL'
                            ? `&level=${encodeURIComponent(activeLevel)}`
                            : ''
                        }`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>کارنامه دانش‌آموز</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                    <span>حذف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors"
                  >
                    بازگشت
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Grades & Account Column */}
                <div className="space-y-6">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center text-sm">
                      <Plus className="w-4 h-4 ml-2 text-blue-600" />
                      ثبت نمره جدید
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <select
                        className="p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                        value={newGrade.courseId}
                        onChange={(e) =>
                          setNewGrade({ ...newGrade, courseId: e.target.value })
                        }
                      >
                        <option value="">انتخاب درس...</option>
                        {visibleCourses.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="نمره (۰ تا ۲۰)"
                        className="p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                        value={newGrade.score}
                        onChange={(e) =>
                          setNewGrade({ ...newGrade, score: e.target.value })
                        }
                      />
                    </div>
                    <div className="mb-3">
                      <label
                        htmlFor="grade-date-input"
                        className="block text-xs font-bold text-slate-600 mb-1"
                      >
                        تاریخ ثبت نمره (شمسی)
                      </label>
                      <JalaliDatePicker
                        id="grade-date-input"
                        value={newGrade.date}
                        onChange={(dateVal) =>
                          setNewGrade({ ...newGrade, date: dateVal })
                        }
                        placeholder="تاریخ ثبت نمره (مثال: 1405/08/29)"
                        ariaLabel="تاریخ ثبت نمره"
                        buttonAriaLabel="انتخاب تاریخ نمره از تقویم"
                        accentColor="blue"
                      />
                      <p className="text-[11px] text-slate-400 mr-1 mt-1">
                        تاریخ پیش‌فرض امروز است؛ روی آیکون تقویم کلیک کنید تا تاریخ دلخواه را انتخاب کنید.
                      </p>
                    </div>
                    <textarea
                      placeholder="توضیحات (اختیاری)"
                      className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm mb-3 h-20 resize-none"
                      value={newGrade.description}
                      onChange={(e) =>
                        setNewGrade({ ...newGrade, description: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={handleAddGrade}
                      className="w-full bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm font-bold"
                    >
                      ثبت نمره
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 font-bold text-sm text-slate-700 border-b border-slate-200">
                      وضعیت درسی (میانگین هر درس)
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {visibleCourses.map((c) => (
                          <tr
                            key={c._id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-700 font-medium">{c.name}</td>
                            <td className="px-4 py-3 text-left font-bold text-slate-900 tabular-nums">
                              {getCourseAverage(selectedStudent._id, c._id)}
                            </td>
                          </tr>
                        ))}
                        {visibleCourses.length === 0 && (
                          <tr>
                            <td className="p-4 text-center text-xs text-slate-400">
                              هنوز درسی ثبت نشده است.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/teacher/student-score?id=${selectedStudent._id}`)
                    }
                    className="w-full bg-slate-900 hover:bg-black transition-colors py-3.5 px-4 rounded-2xl font-bold text-sm text-white"
                  >
                    مشاهده ریز نمرات درسی
                  </button>

                  <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-2.5">
                    <label className="block text-xs font-bold text-slate-700">
                      تغییر رمز عبور {selectedStudent.firstName} {selectedStudent.lastName}
                    </label>
                    <div className="flex gap-2">
                      <input
                        onChange={(e) => setPassword(e.target.value)}
                        value={password}
                        type="text"
                        placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
                        className="flex-1 p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={studentPassManage}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap"
                      >
                        ذخیره رمز
                      </button>
                    </div>
                  </div>
                </div>

                {/* Attendance, Contact & AI Column */}
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center text-sm">
                      <Calendar className="w-4 h-4 ml-2 text-orange-500" />
                      مدیریت حضور و غیاب
                    </h3>

                    <div className="flex items-center justify-between bg-orange-50/70 p-3.5 rounded-xl mb-4 border border-orange-100">
                      <span className="text-orange-950 text-sm font-semibold">
                        وضعیت امروز ({todayDate})
                      </span>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={Boolean(isAbsent(selectedStudent._id, todayDate))}
                          onChange={() =>
                            handleToggleAbsence(selectedStudent._id, todayDate)
                          }
                        />
                        <div
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isAbsent(selectedStudent._id, todayDate)
                              ? 'bg-red-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {isAbsent(selectedStudent._id, todayDate) ? 'غایب است' : 'حاضر است'}
                        </div>
                      </label>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="تاریخ خاص (1404/08/15)"
                        className="flex-1 p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-orange-500"
                        value={manualAbsenceDate}
                        onChange={(e) => setManualAbsenceDate(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (manualAbsenceDate.trim()) {
                            handleToggleAbsence(
                              selectedStudent._id,
                              manualAbsenceDate.trim(),
                              absenceType
                            );
                            setManualAbsenceDate('');
                          }
                        }}
                        className="bg-orange-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors whitespace-nowrap shrink-0"
                      >
                        ثبت/حذف غیبت
                      </button>
                    </div>

                    <fieldset className="mb-4">
                      <legend className="text-xs font-medium text-slate-500 mb-2">
                        نوع غیبت هنگام ثبت:
                      </legend>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                        <label
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                            absenceType === 'unexcused'
                              ? 'bg-white text-red-700 shadow-sm ring-1 ring-red-200 font-bold'
                              : 'text-slate-600 hover:text-slate-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name="absenceType"
                            value="unexcused"
                            checked={absenceType === 'unexcused'}
                            onChange={() => setAbsenceType('unexcused')}
                            className="accent-red-600"
                          />
                          <span>غیرموجه</span>
                        </label>
                        <label
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                            absenceType === 'excused'
                              ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200 font-bold'
                              : 'text-slate-600 hover:text-slate-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name="absenceType"
                            value="excused"
                            checked={absenceType === 'excused'}
                            onChange={() => setAbsenceType('excused')}
                            className="accent-emerald-600"
                          />
                          <span>موجه</span>
                        </label>
                      </div>
                    </fieldset>

                    <div>
                      <p className="text-xs font-bold text-slate-400 mb-2">
                        لیست غیبت‌های ثبت شده (از قدیمی‌ترین به جدیدترین):
                      </p>
                      <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                        {data.attendance
                          .filter((a) => a.studentId === selectedStudent._id)
                          .sort((a, b) => compareJalaliDatesAsc(a.date, b.date))
                          .map((a) => {
                            const type = resolveAbsenceType(a);
                            const isExcused = type === 'excused';
                            return (
                              <div
                                key={a._id}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 tabular-nums">
                                    {a.date}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">
                                    ·
                                  </span>
                                  <span
                                    className={`font-semibold ${
                                      isExcused ? 'text-emerald-700' : 'text-red-700'
                                    }`}
                                  >
                                    {isExcused ? 'موجه' : 'غیرموجه'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSwitchAbsenceType(a._id, type)}
                                    className="text-slate-600 hover:text-blue-700 underline-offset-2 hover:underline font-medium"
                                  >
                                    {isExcused ? 'تبدیل به غیرموجه' : 'تبدیل به موجه'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleAbsence(selectedStudent._id, a.date)
                                    }
                                    className="text-red-500 hover:text-red-700 p-1"
                                    aria-label={`حذف غیبت تاریخ ${a.date}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        {data.attendance.filter((a) => a.studentId === selectedStudent._id)
                          .length === 0 && (
                          <span className="text-slate-400 text-xs">بدون غیبت</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Student Health, Left-Handedness & Home Follow-up Card */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-800 flex items-center justify-between text-sm">
                      <span>مشخصات سلامت و پیگیری آموزش غیرحضوری</span>
                      {editStudentProfile.isLeftHanded && (
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                          دست‌چپ
                        </span>
                      )}
                    </h3>

                    <StudentProfileFields
                      idPrefix="edit-student"
                      value={editStudentProfile}
                      onChange={setEditStudentProfile}
                    />

                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={handleSaveStudentProfile}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl transition-colors text-xs font-bold disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {savingProfile ? 'در حال ذخیره...' : 'ذخیره مشخصات تکمیلی دانش‌آموز'}
                      </span>
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center text-sm">
                      <Phone className="w-4 h-4 ml-2 text-purple-600" />
                      تماس و یادداشت
                    </h3>
                    <div className="mb-3">
                      <label className="text-xs text-slate-500 block mb-1">
                        شماره تماس والدین
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: 0912..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-purple-500"
                        value={studentPhone}
                        onChange={(e) => setStudentPhone(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="text-xs text-slate-500 block mb-1">
                        افزودن یادداشت روزانه جدید
                      </label>
                      <textarea
                        placeholder="رفتار امروز دانش‌آموز چطور بود؟"
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-sm h-20 resize-none outline-none focus:border-purple-500"
                        value={studentNote}
                        onChange={(e) => setStudentNote(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveStudentInfo}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-2.5 rounded-xl hover:bg-black transition-colors text-xs font-bold"
                    >
                      <Save className="w-4 h-4" />
                      <span>ذخیره اطلاعات</span>
                    </button>

                    {selectedStudent.dailyNotes && selectedStudent.dailyNotes.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 mb-2">
                          تاریخچه یادداشت‌ها:
                        </p>
                        <div className="space-y-2 max-h-36 overflow-y-auto">
                          {selectedStudent.dailyNotes.map((note, i) => (
                            <div
                              key={i}
                              className="bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-xs"
                            >
                              <div className="text-[11px] text-amber-800 font-bold mb-0.5">
                                {note.date}
                              </div>
                              <div className="text-slate-700">{note.content}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-indigo-50/70 border border-indigo-100 p-5 rounded-2xl">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-indigo-950 flex items-center text-sm">
                        <BrainCircuit className="w-4 h-4 ml-2" />
                        تحلیل عملکرد
                      </h3>
                      <button
                        type="button"
                        onClick={handleAI}
                        disabled={isGeneratingAI}
                        className="bg-indigo-600 text-white text-xs px-3.5 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-bold"
                      >
                        {isGeneratingAI ? 'در حال تحلیل...' : 'تولید گزارش جدید'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white/70 p-3.5 rounded-xl min-h-[80px]">
                      {isGeneratingAI
                        ? 'لطفاً صبر کنید...'
                        : 'برای دریافت تحلیل عملکرد، دکمه بالا را فشار دهید.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ================= STUDENTS TAB ================= */}
              {activeTab === 'students' && (
                <div className="space-y-5">
                  <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="جستجوی دانش‌آموز (نام، نام پدر، کد ملی)..."
                        className="w-full pr-9 pl-3 py-2.5 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddHomework((p) => !p)}
                        className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                      >
                        <FileText className="w-4 h-4 text-purple-600" />
                        <span>ارسال تکلیف</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLevels((p) => !p)}
                        className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                      >
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span>مدیریت خوانداری</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddStudent((p) => !p)}
                        className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        <span>دانش‌آموز جدید</span>
                      </button>
                    </div>
                  </div>

                  {showLevels && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center text-sm">
                        <BookOpen className="w-5 h-5 ml-2 text-blue-600" />
                        تمرین خوانداری فارسی
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                        {readingLevels.map((level, i) => (
                          <button
                            type="button"
                            onClick={() => farsiDirectHander(level)}
                            key={i}
                            className="py-2 px-3 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-600 hover:text-white transition-colors"
                          >
                            پایه {level}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={responsesPageHandler}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                        >
                          مشاهده پاسخ دانش‌آموزان
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLevels(false)}
                          className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                        >
                          بستن
                        </button>
                      </div>
                    </div>
                  )}

                  {isShowStResponses && showLevels && (
                    <StudentResponseGrid data={data} responses={studentReadingData} />
                  )}

                  {showAddHomework && (
                    <div className="bg-white p-5 rounded-2xl border border-purple-200 space-y-3.5">
                      <h3 className="font-bold text-purple-950 text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <span>تعریف تکلیف جدید</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          placeholder="عنوان تکلیف"
                          className="p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-purple-500"
                          value={newHomework.title}
                          onChange={(e) =>
                            setNewHomework({ ...newHomework, title: e.target.value })
                          }
                        />
                        <JalaliDatePicker
                          value={newHomework.dueDate}
                          onChange={(dateVal) =>
                            setNewHomework({ ...newHomework, dueDate: dateVal })
                          }
                          placeholder="تاریخ تحویل (مثال: 1405/09/05)"
                          ariaLabel="تاریخ تحویل تکلیف"
                          buttonAriaLabel="انتخاب تاریخ تحویل از تقویم"
                          showTomorrowButton
                          accentColor="purple"
                        />
                      </div>

                      {/* Display duration in student panel */}
                      <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <label
                          htmlFor="homework-display-days"
                          className="text-xs font-bold text-purple-950"
                        >
                          مدت نمایش تکلیف در پنل دانش‌آموز (چند روز نمایش داده شود؟):
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          {[1, 3, 7, 14].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() =>
                                setNewHomework({
                                  ...newHomework,
                                  displayDays: String(days),
                                })
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                Number(newHomework.displayDays) === days
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-white border border-purple-200 text-purple-800 hover:bg-purple-100'
                              }`}
                            >
                              {toPersianDigits(days)} روز
                            </button>
                          ))}
                          <div className="flex items-center gap-1.5">
                            <input
                              id="homework-display-days"
                              type="number"
                              min={1}
                              max={365}
                              aria-label="تعداد روز نمایش تکلیف"
                              value={newHomework.displayDays}
                              onChange={(e) =>
                                setNewHomework({
                                  ...newHomework,
                                  displayDays: e.target.value,
                                })
                              }
                              className="w-16 px-2 py-1 rounded-lg border border-purple-300 bg-white text-center text-xs font-extrabold text-purple-950 tabular-nums outline-none focus:border-purple-600"
                            />
                            <span className="text-xs font-semibold text-purple-800">
                              روز
                            </span>
                          </div>
                        </div>
                      </div>

                      <select
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-purple-500 bg-white"
                        value={newHomework.target}
                        onChange={(e) =>
                          setNewHomework({ ...newHomework, target: e.target.value })
                        }
                      >
                        <option value="ALL">ارسال برای همه دانش‌آموزان این پایه</option>
                        {visibleStudents.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.firstName} {s.lastName}
                          </option>
                        ))}
                      </select>
                      <textarea
                        placeholder="توضیحات کامل تکلیف..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-sm h-20 resize-none outline-none focus:border-purple-500"
                        value={newHomework.description}
                        onChange={(e) =>
                          setNewHomework({ ...newHomework, description: e.target.value })
                        }
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddHomework(false)}
                          className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                        >
                          انصراف
                        </button>
                        <button
                          type="button"
                          onClick={handleAddHomework}
                          className="bg-purple-600 text-white px-6 py-2 rounded-xl hover:bg-purple-700 text-xs font-bold"
                        >
                          ارسال تکلیف
                        </button>
                      </div>
                    </div>
                  )}

                  {showAddStudent && (
                    <div className="bg-white p-5 rounded-2xl border border-blue-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-blue-950 text-sm">
                          افزودن دانش‌آموز جدید
                          {activeLevel !== 'ALL' ? ` (پایه ${activeLevel})` : ''}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <input
                          placeholder="نام"
                          className="p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500"
                          value={newStudent.firstName}
                          onChange={(e) =>
                            setNewStudent({ ...newStudent, firstName: e.target.value })
                          }
                        />
                        <input
                          placeholder="نام خانوادگی"
                          className="p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500"
                          value={newStudent.lastName}
                          onChange={(e) =>
                            setNewStudent({ ...newStudent, lastName: e.target.value })
                          }
                        />
                        <input
                          placeholder="کد ملی"
                          className="p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500"
                          value={newStudent.nationalId}
                          onChange={(e) =>
                            setNewStudent({ ...newStudent, nationalId: e.target.value })
                          }
                        />
                        <input
                          placeholder="نام پدر"
                          className="p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500"
                          value={newStudent.fatherName}
                          onChange={(e) =>
                            setNewStudent({ ...newStudent, fatherName: e.target.value })
                          }
                        />
                      </div>

                      <StudentProfileFields
                        idPrefix="new-student"
                        value={newStudentProfile}
                        onChange={setNewStudentProfile}
                      />

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddStudent(false);
                            setNewStudentProfile({ ...EMPTY_STUDENT_PROFILE });
                          }}
                          className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                        >
                          انصراف
                        </button>
                        <button
                          type="button"
                          onClick={handleAddStudent}
                          className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 text-xs font-bold"
                        >
                          افزودن
                        </button>
                      </div>
                    </div>
                  )}

                  {visibleStudents.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-16 text-center">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-600 mb-1">
                        هیچ دانش‌آموزی در این پایه نمایش داده نشد.
                      </p>
                      <p className="text-xs text-slate-400">
                        با دکمه «دانش‌آموز جدید» اولین دانش‌آموز را اضافه کنید.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {visibleStudents.map((student) => {
                        const todayAbsent = isAbsent(student._id, todayDate);
                        const avg = getStudentAverage(student._id);
                        return (
                          <div
                            key={student._id}
                            onClick={() => setSelectedStudent(student)}
                            className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="bg-slate-100 p-2.5 rounded-xl text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shrink-0">
                                  <GraduationCap className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-sm text-slate-900 truncate">
                                    {student.firstName} {student.lastName}
                                  </h3>
                                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    پدر: {student.fatherName || '—'}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`text-[11px] font-bold shrink-0 ${
                                  todayAbsent ? 'text-red-600' : 'text-emerald-600'
                                }`}
                              >
                                {todayAbsent ? 'غایب' : 'حاضر'}
                              </span>
                            </div>

                            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                              <span className="tabular-nums">
                                معدل:{' '}
                                <strong className="text-slate-900">
                                  {toPersianDigits(avg)}
                                </strong>
                              </span>
                              <span className="tabular-nums text-[11px] text-slate-400">
                                {student.level ? `پایه ${student.level}` : student.nationalId ? toPersianDigits(student.nationalId) : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ================= LEADERBOARD TAB ================= */}
              {activeTab === 'leaderboard' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <BarChart className="w-5 h-5 text-amber-500" />
                      <span>رتبه‌بندی دانش‌آموزان</span>
                    </h2>
                    <span className="text-xs text-slate-500">
                      {toPersianDigits(visibleStudents.length)} دانش‌آموز
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3.5 text-center w-20">رتبه</th>
                          <th className="p-3.5 text-right">نام دانش‌آموز</th>
                          <th className="p-3.5 text-right">نام پدر</th>
                          <th className="p-3.5 text-center">معدل کل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleStudents
                          .map((s) => ({ ...s, avg: getStudentAverage(s._id) }))
                          .sort((a, b) => b.avg - a.avg)
                          .map((s, index) => (
                            <tr
                              key={s._id}
                              onClick={() => setSelectedStudent(s)}
                              className="hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <td className="p-3.5 text-center font-extrabold tabular-nums text-slate-600">
                                {toPersianDigits(index + 1)}
                              </td>
                              <td className="p-3.5 font-bold text-slate-900">
                                {s.firstName} {s.lastName}
                              </td>
                              <td className="p-3.5 text-slate-600">
                                {s.fatherName || '—'}
                              </td>
                              <td className="p-3.5 text-center font-extrabold tabular-nums">
                                <span
                                  className={
                                    s.avg >= 17
                                      ? 'text-emerald-700'
                                      : s.avg >= 10
                                      ? 'text-amber-700'
                                      : 'text-red-700'
                                  }
                                >
                                  {toPersianDigits(s.avg)}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ================= COURSES TAB ================= */}
              {activeTab === 'courses' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-extrabold text-slate-900">
                      لیست دروس {activeLevel !== 'ALL' ? `(پایه ${activeLevel})` : ''}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowAddCourse((p) => !p)}
                      className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-xs font-bold transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن درس</span>
                    </button>
                  </div>

                  {showAddCourse && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex gap-2.5">
                      <input
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500"
                        placeholder="نام درس جدید (مثال: ریاضی)"
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddCourse}
                        className="bg-emerald-600 text-white px-6 py-2 rounded-xl hover:bg-emerald-700 text-xs font-bold"
                      >
                        ثبت درس
                      </button>
                    </div>
                  )}

                  {visibleCourses.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-14 text-center text-sm text-slate-500">
                      هنوز درسی برای این پایه ثبت نشده است.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {visibleCourses.map((c) => (
                        <div
                          key={c._id}
                          className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center gap-3 hover:border-blue-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="bg-orange-50 p-2.5 rounded-xl text-orange-600 shrink-0">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 text-sm block truncate">
                                {c.name}
                              </span>
                              {c.level && (
                                <span className="text-[11px] text-slate-500">
                                  پایه {c.level}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLesson(c._id)}
                            aria-label={`حذف درس ${c.name}`}
                            className="text-red-500 hover:text-red-700 p-2 rounded-xl hover:bg-red-50 transition-colors shrink-0"
                          >
                            <BookMinus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ================= EVENTS TAB ================= */}
              {activeTab === 'events' && (
                <TeacherEventsPanel
                  events={data.events || []}
                  activeLevel={activeLevel}
                  onAddEvent={handleAddTeacherEvent}
                  onDeleteEvent={handleDeleteTeacherEvent}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
