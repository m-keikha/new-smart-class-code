'use client';

export const TEACHER_TOKEN_KEY = 'teacher_session_token';

export function saveTeacherClientSession(params: {
  sessionToken?: string;
  classId: string;
  teacherName?: string;
}) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('user_role', 'teacher');
    localStorage.setItem('login-data', String(params.classId));
    if (params.teacherName !== undefined) {
      localStorage.setItem('name', params.teacherName);
    }
    if (params.sessionToken) {
      localStorage.setItem(TEACHER_TOKEN_KEY, params.sessionToken);
    }
  } catch {
    // Fallback to sessionStorage if localStorage is blocked
  }
  try {
    if (params.sessionToken) {
      sessionStorage.setItem(TEACHER_TOKEN_KEY, params.sessionToken);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getTeacherSessionToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const fromLocal = localStorage.getItem(TEACHER_TOKEN_KEY);
    if (fromLocal) return fromLocal;
  } catch {
    // Ignore localStorage access errors
  }
  try {
    const fromSession = sessionStorage.getItem(TEACHER_TOKEN_KEY);
    if (fromSession) return fromSession;
  } catch {
    // Ignore sessionStorage access errors
  }
  return undefined;
}

export function clearTeacherClientSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TEACHER_TOKEN_KEY);
    localStorage.removeItem('login-data');
    localStorage.removeItem('user_role');
    localStorage.removeItem('teacher_active_level');
  } catch {
    // Ignore
  }
  try {
    sessionStorage.removeItem(TEACHER_TOKEN_KEY);
  } catch {
    // Ignore
  }
}
