'use client';

import React, { useMemo, useState } from 'react';
import { BellRing, CalendarClock, Plus, Trash2 } from 'lucide-react';
import type { TeacherEvent } from '@/types';
import JalaliDatePicker from './JalaliDatePicker';
import {
  formatJalaliDatePersian,
  formatJalaliLongLabel,
  getEventTimingStatus,
  getTodayJalaliString,
  getTomorrowJalaliString,
  sortEventsForTeacher,
} from '@/lib/jalaliCalendar';
import { toPersianDigits } from '@/lib/teacherReports';

interface TeacherEventsPanelProps {
  events: TeacherEvent[];
  activeLevel: string;
  onAddEvent: (payload: {
    date: string;
    title: string;
    description: string;
  }) => Promise<boolean>;
  onDeleteEvent: (eventId: string) => Promise<void>;
}

export default function TeacherEventsPanel({
  events,
  activeLevel,
  onAddEvent,
  onDeleteEvent,
}: TeacherEventsPanelProps) {
  const todayStr = useMemo(() => getTodayJalaliString(), []);
  const tomorrowStr = useMemo(() => getTomorrowJalaliString(), []);

  const [eventDate, setEventDate] = useState<string>(tomorrowStr);
  const [eventTitle, setEventTitle] = useState<string>('');
  const [eventDescription, setEventDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortedEvents = useMemo(
    () => sortEventsForTeacher(events, todayStr),
    [events, todayStr]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDate.trim() || !eventDescription.trim() || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onAddEvent({
        date: eventDate.trim(),
        title: eventTitle.trim(),
        description: eventDescription.trim(),
      });
      if (ok) {
        setEventTitle('');
        setEventDescription('');
        setEventDate(getTomorrowJalaliString());
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteEvent(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Event Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-amber-600" />
              <span>ثبت رویداد و یادآور جدید</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              رویدادهای ثبت‌شده در تاریخ مقرر به‌صورت خودکار در صفحه اصلی پنل معلم نمایش داده می‌شوند.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setEventDate(todayStr)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                eventDate === todayStr
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              امروز ({formatJalaliDatePersian(todayStr)})
            </button>
            <button
              type="button"
              onClick={() => setEventDate(tomorrowStr)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                eventDate === tomorrowStr
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              فردا ({formatJalaliDatePersian(tomorrowStr)})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="teacher-event-date"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              تاریخ رویداد (شمسی)
            </label>
            <JalaliDatePicker
              id="teacher-event-date"
              value={eventDate}
              onChange={setEventDate}
              ariaLabel="تاریخ رویداد"
              buttonAriaLabel="باز کردن تقویم تاریخ رویداد"
              showTomorrowButton
              accentColor="amber"
            />
          </div>
          <div>
            <label
              htmlFor="teacher-event-title"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              عنوان کوتاه (اختیاری)
            </label>
            <input
              id="teacher-event-title"
              type="text"
              placeholder="مثال: پرسش کلاسی فارسی"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white text-sm"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="teacher-event-description"
            className="block text-xs font-bold text-slate-700 mb-1.5"
          >
            توضیحات رویداد
          </label>
          <textarea
            id="teacher-event-description"
            required
            placeholder="مثال: پرسیدن درس سوم فارسی از دانش‌آموزان"
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white text-sm h-24 resize-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-xs text-slate-500">
            {activeLevel !== 'ALL' ? `ثبت برای پایه ${activeLevel}` : 'ثبت برای کل کلاس'}
          </span>
          <button
            type="submit"
            disabled={submitting || !eventDate.trim() || !eventDescription.trim()}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{submitting ? 'در حال ثبت...' : 'ثبت رویداد'}</span>
          </button>
        </div>
      </form>

      {/* Registered Events List */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-amber-600" />
            <span>لیست رویدادهای ثبت‌شده</span>
          </h3>
          <span className="text-xs text-slate-500 tabular-nums">
            {toPersianDigits(sortedEvents.length)} رویداد
          </span>
        </div>

        {sortedEvents.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-500">
            هنوز هیچ رویدادی ثبت نشده است. اولین رویداد خود را از فرم بالا ثبت کنید.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedEvents.map((ev) => {
              const timing = getEventTimingStatus(ev.date, todayStr);
              const badgeStyles =
                timing === 'today'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : timing === 'upcoming'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200';
              const badgeText =
                timing === 'today'
                  ? 'رویداد امروز'
                  : timing === 'upcoming'
                  ? 'پیشِ‌رو'
                  : 'گذشته';

              return (
                <div
                  key={ev._id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    timing === 'today' ? 'bg-amber-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${badgeStyles}`}
                      >
                        {badgeText}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800 tabular-nums">
                        {formatJalaliLongLabel(ev.date)} ({formatJalaliDatePersian(ev.date)})
                      </span>
                      {ev.level && (
                        <span className="text-[11px] text-slate-500">
                          · پایه {ev.level}
                        </span>
                      )}
                    </div>
                    {ev.title && (
                      <h4 className="font-bold text-slate-900 text-sm">{ev.title}</h4>
                    )}
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {ev.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={deletingId === ev._id}
                    onClick={() => handleDelete(ev._id)}
                    aria-label={`حذف رویداد ${ev.title || ev.description}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors shrink-0 self-end sm:self-center disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{deletingId === ev._id ? 'در حال حذف...' : 'حذف رویداد'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
