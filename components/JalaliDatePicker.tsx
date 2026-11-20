'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  JALALI_MONTH_NAMES,
  PERSIAN_WEEKDAY_SHORT,
  buildJalaliCalendarGrid,
  formatJalaliDateAscii,
  getTodayJalaliParts,
  getTodayJalaliString,
  getTomorrowJalaliString,
  parseJalaliParts,
} from '@/lib/jalaliCalendar';
import { toPersianDigits } from '@/lib/teacherReports';

interface JalaliDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  buttonAriaLabel?: string;
  showTomorrowButton?: boolean;
  accentColor?: 'blue' | 'purple' | 'amber';
  className?: string;
}

export default function JalaliDatePicker({
  value,
  onChange,
  placeholder = 'مثال: 1405/08/30',
  id,
  ariaLabel = 'تاریخ شمسی',
  buttonAriaLabel = 'باز کردن تقویم شمسی',
  showTomorrowButton = false,
  accentColor = 'blue',
  className = '',
}: JalaliDatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const todayParts = useMemo(() => getTodayJalaliParts(), []);
  const parsedValue = useMemo(() => parseJalaliParts(value), [value]);

  const [viewYear, setViewYear] = useState<number>(
    parsedValue?.jy ?? todayParts.jy
  );
  const [viewMonth, setViewMonth] = useState<number>(
    parsedValue?.jm ?? todayParts.jm
  );

  // Keep calendar view synced when opening or when external value changes to a valid date
  useEffect(() => {
    if (open && parsedValue) {
      setViewYear(parsedValue.jy);
      setViewMonth(parsedValue.jm);
    }
  }, [open, parsedValue]);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const cells = useMemo(
    () => buildJalaliCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    onChange(formatJalaliDateAscii({ jy: viewYear, jm: viewMonth, jd: day }));
    setOpen(false);
  };

  const accentClasses =
    accentColor === 'purple'
      ? {
          ring: 'focus:ring-purple-500 focus:border-purple-500',
          selected: 'bg-purple-600 text-white font-bold shadow-sm',
          todayRing: 'ring-1 ring-purple-400 text-purple-700 font-bold',
          iconBtn: 'text-purple-600 hover:bg-purple-50',
        }
      : accentColor === 'amber'
      ? {
          ring: 'focus:ring-amber-500 focus:border-amber-500',
          selected: 'bg-amber-600 text-white font-bold shadow-sm',
          todayRing: 'ring-1 ring-amber-400 text-amber-800 font-bold',
          iconBtn: 'text-amber-600 hover:bg-amber-50',
        }
      : {
          ring: 'focus:ring-blue-500 focus:border-blue-500',
          selected: 'bg-blue-600 text-white font-bold shadow-sm',
          todayRing: 'ring-1 ring-blue-400 text-blue-700 font-bold',
          iconBtn: 'text-blue-600 hover:bg-blue-50',
        };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          dir="ltr"
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          className={`w-full pl-11 pr-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 outline-none bg-white text-sm text-right tabular-nums ${accentClasses.ring}`}
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={buttonAriaLabel}
          aria-expanded={open}
          className={`absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${accentClasses.iconBtn}`}
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div
          dir="rtl"
          role="dialog"
          aria-label="تقویم شمسی"
          className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 z-50"
        >
          {/* Month & Year Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="ماه قبل"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-sm font-extrabold text-slate-900 select-none">
              {JALALI_MONTH_NAMES[viewMonth - 1]} {toPersianDigits(viewYear)}
            </div>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="ماه بعد"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
            {PERSIAN_WEEKDAY_SHORT.map((dayName) => (
              <div
                key={dayName}
                className="text-[11px] font-bold text-slate-400 py-1"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const isSelected =
                parsedValue?.jy === viewYear &&
                parsedValue?.jm === viewMonth &&
                parsedValue?.jd === day;
              const isToday =
                todayParts.jy === viewYear &&
                todayParts.jm === viewMonth &&
                todayParts.jd === day;

              return (
                <button
                  key={`${viewYear}-${viewMonth}-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  aria-label={`${day} ${JALALI_MONTH_NAMES[viewMonth - 1]} ${viewYear}`}
                  aria-pressed={isSelected}
                  className={`h-8 rounded-lg text-xs tabular-nums transition-colors ${
                    isSelected
                      ? accentClasses.selected
                      : isToday
                      ? `${accentClasses.todayRing} hover:bg-slate-100`
                      : 'text-slate-700 hover:bg-slate-100 font-medium'
                  }`}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>

          {/* Quick Shortcuts */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onChange(getTodayJalaliString());
                  setOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
              >
                امروز
              </button>
              {showTomorrowButton && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(getTomorrowJalaliString());
                    setOpen(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold transition-colors"
                >
                  فردا
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 px-2 py-1"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
