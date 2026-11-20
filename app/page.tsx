'use client';

import React, { useState, useEffect } from 'react';
import { UserRoundKey, GraduationCap, School, ArrowRight, SquareArrowLeft } from 'lucide-react'
import { UserPlus } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { seedData, checkStudentLogin, loginTeacher } from './actions';
import { saveTeacherClientSession } from '@/lib/clientSession';

export default function LoginPage() {
  const [mode, setMode] = useState<'selection' | 'teacher' | 'student'>('selection');
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Initial seed
    seedData();
  }, []);

  const handleTeacherLogin = async () => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const loginResult = await loginTeacher(userName.trim(), password);

      if (loginResult.success && loginResult.classId) {
        saveTeacherClientSession({
          sessionToken: loginResult.sessionToken,
          classId: loginResult.classId.toString(),
          teacherName: loginResult.teacherName,
        });
        router.push('/teacher');
      } else {
        setError(loginResult.error ?? 'خطا در برقراری ارتباط');
      }
    } catch {
      setError('خطا در برقراری ارتباط با سرور');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentLogin = async () => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const student = await checkStudentLogin(nationalId.trim());

      if (student.students && student.students.length > 0) {
        const studentPass = student.students[0].password;
        if (password === studentPass) {
          localStorage.setItem('user_role', 'student');
          localStorage.setItem('student_id', student.students[0]._id);
          router.push('/student');
        } else {
          setError('رمز عبور اشتباه است.');
        }
      } else {
        setError('دانشآموزی با این کد ملی یافت نشد.');
      }
    } catch {
      setError('خطا در برقراری ارتباط با سرور');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'selection') {
    return (

      <div className="min-h-screen bg-[url('/nature.jpg')] bg-cover bg-center bg-fixed relative flex items-center justify-center p-4" dir="rtl">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>


        <div className="relative z-10 bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 max-w-2xl w-full text-center transform transition-all">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-50 p-4 rounded-full">
              <School className="w-14 h-14 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl p-2 bg-gradient-to-r from-sky-400 to-blue-700 my-4 block rounded-2xl shadow-lg font-extrabold text-white mb-3">
            سامانه مدیریت هوشمند پیشرفت تحصیلی
          </h1>
          <span className="text-sm inline-block   p-2 border-b-4  transition-all duration-200  px-4   rounded-lg   text-gray-500 font-medium mb-6">طراحی و توسعه: مهدی کیخا</span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <button
              onClick={() => setMode('teacher')}
              className="group bg-white p-6 border-2 border-gray-100 hover:border-blue-500 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:shadow-blue-300 flex flex-col items-center"
            >
              <div className="bg-blue-50 p-4 rounded-2xl mb-4 group-hover:bg-blue-600 transition-colors duration-300">
                <UserRoundKey className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">ورود همکار</h3>
              <p className="text-sm text-gray-500 mt-2">پنل مدیریت و معلمان</p>
            </button>

            <button
              onClick={() => setMode('student')}
              className="group bg-white p-6 border-2 border-gray-100 hover:border-emerald-500 rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-1 flex flex-col items-center"
            >
              <div className="bg-emerald-50 p-4 rounded-2xl mb-4 group-hover:bg-emerald-600 transition-colors duration-300">
                <GraduationCap className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-emerald-600 transition-colors">پنل دانش‌آموزی</h3>
              <p className="text-sm text-gray-500 mt-2">مشاهده نمرات و کارنامه</p>
            </button>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[url('/nature.jpg')] bg-cover bg-center bg-fixed relative flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

      <div className={`relative z-10 bg-white/95  backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-300`}>


        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => { setMode('selection'); setError(''); }}
            className="text-sm group font-medium text-gray-500  hover:text-gray-800 transition-colors flex items-center gap-1 bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200"
          >
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform " />
            بازگشت
          </button>
          {mode === 'teacher' && (
            <button
              onClick={() => window.location.href = '/signup/teacher'}
              className="text-md flex font-medium text-green-700 px-3 py-2   hover:shadow-sm hover:shadow-green-200 border-2 border-b-4 rounded-lg hover:bg-emerald-400 hover:text-white   hover:rounded-2xl  transition-colors duration-200"
            >
              < UserPlus />

              <span className='mx-2 '> ثبت نام </span>
            </button>
          )}
        </div>

        <div className="flex flex-col items-center  mb-8">
          <div className={`p-3 rounded-full mb-3 ${mode === 'teacher' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {mode === 'teacher' ? <UserRoundKey className="w-12 h-12" /> : <GraduationCap className="w-12 h-12" />}
          </div>
          <h2 className={`text-2xl font-bold text-gray-700 p-2 px-10   my-4 block rounded-2xl shadow-b-lg shadow-2xl   border-b-4 ${mode === 'teacher' ? 'border-blue-500 shadow-blue-300 ' : 'border-emerald-600 shadow-emerald-300'}     `}>
            {mode === 'teacher' ? 'ورود همکاران' : 'ورود دانش‌آموزان'}
          </h2>
        </div>


        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'teacher') {
              handleTeacherLogin();
            } else {
              handleStudentLogin();
            }
          }}
          className="space-y-4"
        >
          {mode === 'student' ? (
            <input
              type="text"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder="کد ملی"
              dir="ltr"
            />
          ) : (
            <input
              type="text"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="نام کاربری (ایمیل)"
              dir="ltr"
            />
          )}

          <input
            type="password"
            className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:border-transparent outline-none transition-all ${mode === 'teacher' ? 'focus:ring-blue-500' : 'focus:ring-emerald-500'}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="رمز عبور"
            dir="ltr"
          />

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl text-center border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 rounded-xl text-white font-bold shadow-lg transition-all hover:-translate-y-0.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed ${mode === 'teacher'
              ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30'
              : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/30'
              }`}
          >
            {isSubmitting ? 'در حال ورود...' : 'ورود به سامانه'}
          </button>
        </form>
      </div>
    </div>
  );
}