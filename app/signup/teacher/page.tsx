'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, School, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { addClass, checkExistingUser, loginTeacher } from '../../actions';
import {
  DEFAULT_PROVINCE,
  GRADE_LEVEL_OPTIONS,
  PROVINCES,
  SISTAN_BALUCHESTAN_CITIES,
} from '@/lib/provinces';
import { saveTeacherClientSession } from '@/lib/clientSession';

export interface UserSignUp {
  name: string;
  schoolName: string;
  gradeLevel: string;
  className?: string;
  province: string;
  city: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const schema = yup.object().shape({
  name: yup.string().trim().required('وارد کردن نام و نام خانوادگی ضروریست'),
  schoolName: yup.string().trim().required('وارد کردن نام مدرسه ضروریست'),
  gradeLevel: yup.string().trim().required('انتخاب پایه تحصیلی ضروریست'),
  className: yup.string().trim().optional(),
  province: yup.string().trim().required('انتخاب استان ضروریست'),
  city: yup.string().trim().required('انتخاب شهرستان ضروریست'),
  email: yup
    .string()
    .trim()
    .email('ایمیل وارد شده نامعتبر است')
    .required('وارد کردن ایمیل ضروریست'),
  password: yup
    .string()
    .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
    .max(30)
    .required('وارد کردن رمز عبور ضروریست')
    .matches(/[a-zA-Z]+/, 'رمز عبور باید شامل ترکیبی از عدد و حروف انگلیسی باشد')
    .matches(/\d+/, 'رمز عبور باید شامل ترکیبی از عدد و حروف انگلیسی باشد'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'رمز عبور یکسان نیست')
    .required('وارد کردن تکرار رمز عبور ضروریست'),
});

export default function SignUp() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserSignUp>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      province: DEFAULT_PROVINCE,
      city: '',
      gradeLevel: '',
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const onHandleSubmit = async (data: UserSignUp) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const existingUser = await checkExistingUser(data.email);
      if (existingUser && existingUser.success === false) {
        setError(existingUser.error || 'این ایمیل قبلاً ثبت شده است.');
        return;
      }

      const dataSignUp = {
        className: data.className?.trim() || `پایه ${data.gradeLevel}`,
        teacherName: data.name.trim(),
        schoolName: data.schoolName.trim(),
        gradeLevel: data.gradeLevel.trim(),
        gradeLevels: [data.gradeLevel.trim()],
        province: data.province.trim() || DEFAULT_PROVINCE,
        city: data.city.trim(),
        password: data.password,
        userName: data.email.trim(),
        role: 'teacher',
      };

      const res = await addClass(dataSignUp);

      if (res.success) {
        const loginResult = await loginTeacher(data.email.trim(), data.password);
        if (loginResult.success && loginResult.classId) {
          saveTeacherClientSession({
            sessionToken: loginResult.sessionToken,
            classId: loginResult.classId.toString(),
            teacherName: data.name.trim(),
          });
          setSuccessMsg('ثبت نام با موفقیت انجام شد. در حال انتقال به پنل معلم...');
          router.push('/teacher');
          return;
        }
        setSuccessMsg('ثبت نام با موفقیت انجام شد. اکنون می‌توانید وارد شوید.');
        router.push('/');
      } else {
        setError('خطا در ثبت نام. لطفاً دوباره تلاش کنید.');
      }
    } catch {
      setError('خطای غیرمنتظره در ارتباط با سرور.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = (hasError: boolean) =>
    `w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm text-slate-900 outline-none transition-all ${
      hasError
        ? 'border-red-400 focus:ring-2 focus:ring-red-500/30'
        : 'border-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500'
    }`;

  return (
    <div
      className="min-h-screen bg-[url('/nature.jpg')] bg-cover bg-center bg-fixed relative flex items-center justify-center p-4 sm:p-6"
      dir="rtl"
    >
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />

      <div className="relative z-10 bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-600 to-teal-600 px-6 py-7 text-center relative">
          <Link
            href="/"
            aria-label="بازگشت به صفحه ورود"
            className="absolute top-6 right-6 text-white/90 hover:text-white bg-white/15 hover:bg-white/25 p-2 rounded-xl transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-white/15 text-white mb-2.5">
            <School className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
            ثبت نام همکار (معلم)
          </h1>
          <p className="text-emerald-50 text-xs sm:text-sm">
            مشخصات فردی، مدرسه و محل خدمت خود را تکمیل کنید
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onHandleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نام و نام خانوادگی <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={fieldClass(Boolean(errors.name))}
                  placeholder="مثال: علی محمدی"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-red-600 text-xs font-medium mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نام مدرسه <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={fieldClass(Boolean(errors.schoolName))}
                  placeholder="مثال: دبستان شهید بهشتی"
                  {...register('schoolName')}
                />
                {errors.schoolName && (
                  <p className="text-red-600 text-xs font-medium mt-1">
                    {errors.schoolName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  پایه تحصیلی <span className="text-red-500">*</span>
                </label>
                <select
                  className={fieldClass(Boolean(errors.gradeLevel))}
                  {...register('gradeLevel')}
                >
                  <option value="">انتخاب پایه تحصیلی...</option>
                  {GRADE_LEVEL_OPTIONS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      پایه {lvl}
                    </option>
                  ))}
                </select>
                {errors.gradeLevel && (
                  <p className="text-red-600 text-xs font-medium mt-1">
                    {errors.gradeLevel.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نام کلاس (اختیاری)
                </label>
                <input
                  type="text"
                  className={fieldClass(Boolean(errors.className))}
                  placeholder="مثال: کلاس ششم الف"
                  {...register('className')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>استان</span>
                </label>
                <select
                  className={fieldClass(Boolean(errors.province))}
                  {...register('province')}
                >
                  {PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
                {errors.province && (
                  <p className="text-red-600 text-xs font-medium mt-1">
                    {errors.province.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  شهرستان <span className="text-red-500">*</span>
                </label>
                <select
                  className={fieldClass(Boolean(errors.city))}
                  {...register('city')}
                >
                  <option value="">انتخاب شهرستان...</option>
                  {SISTAN_BALUCHESTAN_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                {errors.city && (
                  <p className="text-red-600 text-xs font-medium mt-1">
                    {errors.city.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ایمیل <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                className={fieldClass(Boolean(errors.email))}
                placeholder="example@mail.com"
                dir="ltr"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-600 text-xs font-medium mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رمز عبور <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  className={fieldClass(Boolean(errors.password))}
                  placeholder="حداقل ۸ کاراکتر (حروف و عدد)"
                  dir="ltr"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-red-600 text-xs font-medium mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تکرار رمز عبور <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  className={fieldClass(Boolean(errors.confirmPassword))}
                  placeholder="تکرار رمز عبور"
                  dir="ltr"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="text-red-600 text-xs font-medium mt-1">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-xs sm:text-sm px-4 py-3 rounded-xl border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 text-emerald-800 text-xs sm:text-sm px-4 py-3 rounded-xl border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 mt-2 w-full py-3.5 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white text-base font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 text-white" />
                  <span>در حال ایجاد حساب...</span>
                </>
              ) : (
                <span>ثبت نام در سامانه</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
