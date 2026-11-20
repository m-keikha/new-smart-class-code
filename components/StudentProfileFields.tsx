'use client';

import React from 'react';
import { HeartPulse, Home, Wifi } from 'lucide-react';
import { MESSENGER_OPTIONS, REMOTE_ACCESS_OPTIONS } from '@/lib/studentOptions';

export interface StudentProfileFormValues {
  specialDisease: string;
  isLeftHanded: boolean;
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
  messengerType: string;
  remoteAccessMethods: string[];
}

export const EMPTY_STUDENT_PROFILE: StudentProfileFormValues = {
  specialDisease: '',
  isLeftHanded: false,
  guardianName: '',
  guardianRelation: '',
  guardianPhone: '',
  messengerType: '',
  remoteAccessMethods: [],
};

interface StudentProfileFieldsProps {
  value: StudentProfileFormValues;
  onChange: (next: StudentProfileFormValues) => void;
  idPrefix: string;
}

export default function StudentProfileFields({
  value,
  onChange,
  idPrefix,
}: StudentProfileFieldsProps) {
  const toggleRemoteMethod = (option: string) => {
    const current = Array.isArray(value.remoteAccessMethods)
      ? value.remoteAccessMethods
      : [];
    const exists = current.includes(option);
    const next = exists
      ? current.filter((item) => item !== option)
      : [...current, option];
    onChange({ ...value, remoteAccessMethods: next });
  };

  return (
    <div className="space-y-4">
      {/* Health & Handedness */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <HeartPulse className="w-4 h-4 text-rose-500" />
          <span>وضعیت سلامت و ویژگی‌های فردی</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${idPrefix}-special-disease`}
              className="text-xs text-slate-600 font-medium block mb-1"
            >
              دارای بیماری خاص
            </label>
            <input
              id={`${idPrefix}-special-disease`}
              type="text"
              placeholder="در صورت وجود بنویسید (مثال: آسم، آلرژی...)"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500"
              value={value.specialDisease}
              onChange={(e) =>
                onChange({ ...value, specialDisease: e.target.value })
              }
            />
          </div>

          <fieldset>
            <legend className="text-xs text-slate-600 font-medium block mb-1">
              دست چپ بودن
            </legend>
            <div className="grid grid-cols-2 gap-2 p-1 bg-white border border-slate-200 rounded-xl">
              <label
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs cursor-pointer transition-colors ${
                  !value.isLeftHanded
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-50 font-medium'
                }`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-left-handed`}
                  checked={!value.isLeftHanded}
                  onChange={() => onChange({ ...value, isLeftHanded: false })}
                  className="sr-only"
                />
                <span>خیر</span>
              </label>
              <label
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs cursor-pointer transition-colors ${
                  value.isLeftHanded
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-50 font-medium'
                }`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-left-handed`}
                  checked={value.isLeftHanded}
                  onChange={() => onChange({ ...value, isLeftHanded: true })}
                  className="sr-only"
                />
                <span>بله</span>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Home Follow-up Guardian & Remote Education Access */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Home className="w-4 h-4 text-blue-600" />
          <span>
            مشخصات مسئول پیگیری انجام فعالیت‌ها در منزل و وضعیت دسترسی در آموزش غیرحضوری
          </span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${idPrefix}-guardian-name`}
              className="text-xs text-slate-600 font-medium block mb-1"
            >
              نام و نام خانوادگی مسئول پیگیری
            </label>
            <input
              id={`${idPrefix}-guardian-name`}
              type="text"
              placeholder="مثال: رضا محمدی"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500"
              value={value.guardianName}
              onChange={(e) =>
                onChange({ ...value, guardianName: e.target.value })
              }
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-guardian-relation`}
              className="text-xs text-slate-600 font-medium block mb-1"
            >
              نسبت با دانش‌آموز
            </label>
            <input
              id={`${idPrefix}-guardian-relation`}
              type="text"
              placeholder="مثال: پدر، مادر، خواهر..."
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500"
              value={value.guardianRelation}
              onChange={(e) =>
                onChange({ ...value, guardianRelation: e.target.value })
              }
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-guardian-phone`}
              className="text-xs text-slate-600 font-medium block mb-1"
            >
              شماره همراه
            </label>
            <input
              id={`${idPrefix}-guardian-phone`}
              type="text"
              placeholder="0915..."
              dir="ltr"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500"
              value={value.guardianPhone}
              onChange={(e) =>
                onChange({ ...value, guardianPhone: e.target.value })
              }
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-messenger`}
              className="text-xs text-slate-600 font-medium block mb-1"
            >
              انتخاب نوع پیام‌رسان
            </label>
            <select
              id={`${idPrefix}-messenger`}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500"
              value={value.messengerType}
              onChange={(e) =>
                onChange({ ...value, messengerType: e.target.value })
              }
            >
              <option value="">انتخاب پیام‌رسان...</option>
              {MESSENGER_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="pt-1">
          <legend className="text-xs text-slate-600 font-medium flex items-center gap-1.5 mb-2">
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              وضعیت دسترسی در آموزش غیرحضوری / زمان قطعی احتمالی اینترنت (یک یا چند گزینه):
            </span>
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {REMOTE_ACCESS_OPTIONS.map((option) => {
              const checked = (value.remoteAccessMethods || []).includes(option);
              return (
                <label
                  key={option}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs cursor-pointer transition-colors select-none ${
                    checked
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRemoteMethod(option)}
                    className="accent-emerald-600 rounded w-4 h-4"
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
