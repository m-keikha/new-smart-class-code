export interface ClassInfo {
  _id?: string;
  className: string;
  teacherName: string;
  schoolName: string;
  gradeLevel: string;
  gradeLevels: string[];
  province: string;
  city: string;
  role: 'teacher' | 'adminstor' | 'ceo' | string;
}

export interface Student {
  _id: string;
  classId?: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  fatherName: string;
  level?: string;
  password?: string;
  phoneNumber?: string;
  specialDisease?: string;
  isLeftHanded?: boolean;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  messengerType?: string;
  remoteAccessMethods?: string[];
  dailyNotes?: { date: string; content: string }[];
}

export interface Course {
  _id: string;
  classId?: string;
  name: string;
  level?: string;
}

export interface Grade {
  _id: string;
  classId?: string;
  studentId: string;
  courseId: string;
  score: number;
  description?: string;
  date: string;
}

export interface Attendance {
  _id: string;
  classId?: string;
  studentId: string;
  date: string;
  status: 'absent' | 'present'; // We mainly track 'absent'
  absenceType?: 'excused' | 'unexcused';
}

export interface Homework {
  _id: string;
  classId?: string;
  title: string;
  description: string;
  dueDate: string;
  target: 'ALL' | string; // 'ALL' or specific studentId
  level?: string;
  displayDays?: number;
  expiresAt?: string | null;
  completedBy?: string[];
  createdAt: string;
}

export interface TeacherEvent {
  _id: string;
  classId?: string;
  date: string;
  title?: string;
  description: string;
  level?: string;
  createdAt?: string;
}

export interface AIReport {
  _id?: string;
  studentId: string;
  content: string;
  timestamp: number;
}

export interface UserSession {
  role: 'teacher' | 'student';
  studentId?: string;
  name?: string;
}