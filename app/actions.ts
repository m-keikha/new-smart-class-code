"use server";
import { cookies, headers } from "next/headers";
import { ObjectId, Types } from "mongoose";
import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from "cloudinary";

import connectDB from "@/lib/db";
import {
  StudentModel,
  CourseModel,
  GradeModel,
  AttendanceModel,
  HomeworkModel,
  TeacherEventModel,
  ClassModel,
  ListeningModel,
  ReportModel,
  QuestionModel,
  StudentResponseModel,
  Alphabet,
} from "@/models";
import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { normalizeCityName } from "@/lib/provinces";
import { normalizePersianText } from "@/lib/teacherReports";
import {
  createTeacherSessionToken,
  escapeRegExp,
  resolveTeacherClassId,
} from "@/lib/teacherSession";

async function getAuthenticatedTeacherClassId(
  sessionToken?: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get("teacher_session")?.value;
  return resolveTeacherClassId(cookieVal, sessionToken);
}

async function isHttpsRequest(): Promise<boolean> {
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto") || "";
  const origin = headerStore.get("origin") || "";
  const referer = headerStore.get("referer") || "";
  return (
    forwardedProto.includes("https") ||
    origin.startsWith("https://") ||
    referer.startsWith("https://") ||
    process.env.NODE_ENV === "production"
  );
}

interface Login {
  email: string;
  password: string;
}

interface VipListening {
  voiceName?: string;
  text?: string;
  transcription?: any;
}

export interface ListeningDetail {
  _id: string;
  classId?: string;
  title: string;
  level: string;
  text?: string;
  vipListening?: VipListening;
  audio_url?: string;
  audioPublicId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CloudinaryUploadResponse = {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
};

export type CloudinaryMetadataResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

export type CloudinaryDeleteResponse = {
  success: boolean;
  result?: any;
  error?: string;
};

export type Level = "اول" | "دوم" | "سوم" | "چهارم" | "پنجم" | "ششم";

export async function seedData() {
  await connectDB();
  const count = await CourseModel.countDocuments();
  if (count === 0) {
    await CourseModel.insertMany([
      { name: "ریاضی" },
      { name: "علوم تجربی" },
      { name: "ادبیات فارسی" },
    ]);
  }
}

export async function getTeacherData(sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  // بررسی اینکه آیا معلم لاگین هست یا خیر
  if (!classId) {
    return { error: "عدم دسترسی: لطفاً ابتدا وارد شوید." };
  }

  await connectDB();
  const classDoc = await (ClassModel as any)
    .findById(classId)
    .select("className teacherName schoolName gradeLevel gradeLevels province city role")
    .lean();
  const students = await (StudentModel as any).find({ classId }).lean();
  const courses = await (CourseModel as any).find({ classId }).lean();
  const grades = await (GradeModel as any).find({ classId }).lean();
  const attendance = await (AttendanceModel as any).find({ classId }).lean();
  const homeworks = await (
    HomeworkModel.find({ classId }).sort({ createdAt: -1 }) as any
  ).lean();
  const events = await (
    TeacherEventModel.find({ classId }).sort({ createdAt: -1 }) as any
  ).lean();

  const serialize = (arr: any[]) => JSON.parse(JSON.stringify(arr));

  return {
    classInfo: classDoc
      ? {
          _id: classDoc._id ? String(classDoc._id) : classId,
          className: classDoc.className || "",
          teacherName: classDoc.teacherName || "",
          schoolName: classDoc.schoolName || "",
          gradeLevel: classDoc.gradeLevel || "",
          gradeLevels: Array.isArray(classDoc.gradeLevels)
            ? classDoc.gradeLevels.filter(Boolean)
            : [],
          province: classDoc.province || "",
          city: classDoc.city || "",
          role: classDoc.role || "teacher",
        }
      : null,
    students: serialize(students),
    courses: serialize(courses),
    grades: serialize(grades),
    attendance: serialize(attendance),
    homeworks: serialize(homeworks),
    events: serialize(events),
  };
}

export async function getListeningById(
  id: string,
): Promise<ListeningDetail | null> {
  try {
    await connectDB();

    // بررسی معتبر بودن ObjectId
    if (!Types.ObjectId.isValid(id)) {
      throw new Error("شناسه نامعتبر است");
    }

    const listening = await ListeningModel.findById(id)
      .populate("classId", "name")
      .lean();

    if (!listening) {
      return null;
    }

    return {
      _id: listening._id.toString(),
      classId: listening.classId?.toString(),
      title: listening.title,
      level: listening.level,
      text: listening.text,
      vipListening: listening.vipListening,
      audio_url: listening.audio_url,

      createdAt: listening.createdAt?.toISOString(),
      updatedAt: listening.updatedAt?.toISOString(),
    };
  } catch (error) {
    console.error("Error in getListeningById:", error);
    throw new Error("خطا در دریافت اطلاعات listening");
  }
}

export async function studentScoreById(studentId: string) {
  await connectDB();

  const students = await (GradeModel as any).find({ studentId }).lean();

  const serializedStudents = JSON.parse(JSON.stringify(students));

  return {
    students: serializedStudents,
  };
}

export async function getCourses(sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) return { success: false, error: "عدم دسترسی" };

  await connectDB();

  const courses = await (CourseModel as any).find({ classId }).lean();

  const serializedCourses = JSON.parse(JSON.stringify(courses));

  return {
    courses: serializedCourses,
  };
}

export async function checkStudentLogin(nationalId: string) {
  await connectDB();

  const students = await (StudentModel as any)
    .find({ nationalId: nationalId })
    .lean();

  const serializedStudents = JSON.parse(JSON.stringify(students));

  return {
    students: serializedStudents,
  };
}

export async function getQuestionsListeningByListeningId(
  listeningId: any,
  studentId: string,
) {
  // const cookieStore = await cookies();
  // const classId = cookieStore.get("teacher_session")?.value;

  // if (!classId) return { success: false, error: "عدم دسترسی" };

  await connectDB();
  const student = await (StudentModel.findById(studentId) as any).lean();
  if (!student) return { success: false };
  // console.log('stId:',student.classId)
  // console.log('st: ',student)

  const questions = await QuestionModel.find({
    listeningId: listeningId,
    classId: student.classId,
  })
    .sort({ createdAt: -1 })
    .lean();

  console.log("q :", questions);
  if (questions) return { success: true, data: questions[0].questions };
  else return { success: false };
}

export async function postQuestion(
  data: any,
  id: any,
  sessionToken?: string,
) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) return { success: false, error: "عدم دسترسی" };

  await connectDB();
  console.log(data);
  const q = await QuestionModel.create({
    listeningId: id,
    classId: classId,
    questions: data,
  });
  revalidatePath("/teacher");

  if (q) return { success: true };
  else return { success: false };
}

export async function getListeningTitlesByLevel(level: string) {
  try {
    await connectDB();
    const validLevels = ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم"];
    if (!validLevels.includes(level)) {
      throw new Error("سطح وارد شده معتبر نیست");
    }

    const listenings = await ListeningModel.find({ level })
      .select("_id title") // فقط _id و title برگردانده می‌شود
      .lean();

    // فرمت کردن نتایج
    const result = listenings.map((item) => ({
      id: item._id,
      title: item.title,
    }));

    return {
      success: true,
      data: result,
      count: result.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "خطای ناشناخته",
    };
  }
}

export async function getStudentData(studentId: string) {
  await connectDB();
  const student = await (StudentModel.findById(studentId) as any).lean();

  const courses = await (
    CourseModel.find({ classId: student.classId }) as any
  ).lean();
  const grades = await (GradeModel.find({ studentId }) as any).lean();
  const attendance = await (AttendanceModel.find({ studentId }) as any).lean();
  const homeworks = await (
    HomeworkModel.find({ classId: student.classId }).sort({ dueDate: 1 }) as any
  ).lean();
  const report = await (ReportModel.findOne({ studentId }) as any).lean();

  const serialize = (val: any) => (val ? JSON.parse(JSON.stringify(val)) : null);

  return {
    student: serialize(student),
    courses: serialize(courses) || [],
    grades: serialize(grades) || [],
    attendance: serialize(attendance) || [],
    homeworks: serialize(homeworks) || [],
    report: serialize(report),
  };
}

export async function checkExistingUser(email: string) {
  await connectDB();

  const cleanedEmail = (email || "").trim();
  const teacherClass =
    (await ClassModel.findOne({ userName: cleanedEmail })) ||
    (cleanedEmail
      ? await ClassModel.findOne({
          userName: { $regex: new RegExp(`^${escapeRegExp(cleanedEmail)}$`, "i") },
        })
      : null);

  if (teacherClass) {
    return {
      success: false,
      error: "این ایمیل قبلا ثبت شده است از قسمت ورود اقدام کنید.",
    };
  }
  return { success: true };
}
export async function checkAccessAdmin(sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  // بررسی اینکه آیا معلم لاگین هست یا خیر
  if (!classId) {
    return { success: false, error: "عدم دسترسی: لطفاً ابتدا وارد شوید." };
  }

  await connectDB();

  const teacherClass = await ClassModel.findById(classId).lean() as any;

  if (teacherClass && (teacherClass.role === "adminstor" || teacherClass.role === "ceo")) {
    return {
      success: true,
      role: teacherClass.role,
    };
  } else {
    return { success: false, error: "خطای عدم دسترسی" };
  }
}

export async function addTeacherGradeLevel(
  newLevel: string,
  sessionToken?: string,
) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) return { success: false, error: "عدم دسترسی" };

  const trimmed = (newLevel || "").trim();
  if (!trimmed) return { success: false, error: "لطفاً نام پایه تحصیلی را وارد کنید." };

  await connectDB();
  const classDoc = await (ClassModel as any).findById(classId);
  if (!classDoc) return { success: false, error: "حساب معلم یافت نشد." };

  const existing: string[] = [];
  const seen = new Set<string>();
  const pushUnique = (val?: string) => {
    const clean = (val || "").trim();
    const norm = normalizePersianText(clean);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      existing.push(clean);
    }
  };

  pushUnique(classDoc.gradeLevel);
  if (Array.isArray(classDoc.gradeLevels)) {
    for (const item of classDoc.gradeLevels) pushUnique(item);
  }
  pushUnique(trimmed);

  classDoc.gradeLevels = existing;
  if (!classDoc.gradeLevel) {
    classDoc.gradeLevel = trimmed;
  }
  await classDoc.save();

  revalidatePath("/teacher");
  return {
    success: true,
    gradeLevel: classDoc.gradeLevel || "",
    gradeLevels: existing,
  };
}

export async function getManagementData(sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) {
    return { success: false as const, error: "عدم دسترسی: لطفاً ابتدا وارد شوید." };
  }

  await connectDB();
  const viewerDoc = await (ClassModel as any)
    .findById(classId)
    .select("_id className teacherName schoolName gradeLevel gradeLevels province city role")
    .lean();

  if (!viewerDoc) {
    return { success: false as const, error: "حساب کاربری یافت نشد." };
  }

  const role = String(viewerDoc.role || "teacher");
  if (role !== "adminstor" && role !== "ceo") {
    return {
      success: false as const,
      error: "شما مجوز دسترسی به پنل مدیریت را ندارید.",
    };
  }

  const allClassesRaw = await (ClassModel as any)
    .find({})
    .select("_id className teacherName schoolName gradeLevel gradeLevels province city role")
    .lean();

  const viewerCity = (viewerDoc.city || "").trim();
  const viewerCityNorm = normalizeCityName(viewerCity);
  const cityScopeMissing = role === "adminstor" && !viewerCityNorm;

  const scopedClassesRaw =
    role === "adminstor" && viewerCityNorm
      ? allClassesRaw.filter(
          (c: any) => normalizeCityName(c.city) === viewerCityNorm,
        )
      : allClassesRaw;

  const scopedClassIds = scopedClassesRaw.map((c: any) => String(c._id));

  const [students, courses, grades, attendance] = await Promise.all([
    (StudentModel as any).find({ classId: { $in: scopedClassIds } }).lean(),
    (CourseModel as any).find({ classId: { $in: scopedClassIds } }).lean(),
    (GradeModel as any).find({ classId: { $in: scopedClassIds } }).lean(),
    (AttendanceModel as any).find({ classId: { $in: scopedClassIds } }).lean(),
  ]);

  const serialize = (val: any) => JSON.parse(JSON.stringify(val));

  const classes = scopedClassesRaw.map((c: any) => ({
    _id: String(c._id),
    className: c.className || "",
    teacherName: c.teacherName || "",
    schoolName: c.schoolName || "",
    gradeLevel: c.gradeLevel || "",
    gradeLevels: Array.isArray(c.gradeLevels) ? c.gradeLevels.filter(Boolean) : [],
    province: c.province || "",
    city: c.city || "",
    role: c.role || "teacher",
  }));

  return {
    success: true as const,
    viewer: {
      _id: String(viewerDoc._id),
      role: role as "adminstor" | "ceo",
      teacherName: viewerDoc.teacherName || "",
      schoolName: viewerDoc.schoolName || "",
      province: viewerDoc.province || "",
      city: viewerCity,
      cityScopeMissing,
    },
    classes,
    students: serialize(students),
    courses: serialize(courses),
    grades: serialize(grades),
    attendance: serialize(attendance),
  };
}

export async function loginTeacher(email: string, password: string) {
  try {
    const cleanedEmail = (email || "").trim();
    if (!cleanedEmail || !password) {
      return {
        success: false,
        error: "لطفاً نام کاربری و رمز عبور را وارد کنید.",
      };
    }

    await connectDB();

    const teacherClass =
      (await ClassModel.findOne({ userName: cleanedEmail })) ||
      (await ClassModel.findOne({
        userName: { $regex: new RegExp(`^${escapeRegExp(cleanedEmail)}$`, "i") },
      }));

    if (!teacherClass) {
      return { success: false, error: "کاربری با این ایمیل یافت نشد." };
    }

    if (String(teacherClass.password) !== String(password)) {
      return { success: false, error: "رمز عبور اشتباه است." };
    }

    const classIdStr = teacherClass._id.toString();
    const sessionToken = createTeacherSessionToken(classIdStr);

    const cookieStore = await cookies();
    const isHttps = await isHttpsRequest();

    cookieStore.set("teacher_session", sessionToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      ...(isHttps ? { partitioned: true } : {}),
      maxAge: 60 * 60 * 24 * 7, // انقضا: ۷ روز
      path: "/",
    } as any);

    return {
      success: true,
      message: "خوش آمدید!",
      classId: classIdStr,
      teacherName: teacherClass.teacherName,
      sessionToken,
    };
  } catch (error) {
    console.error("loginTeacher error:", error);
    return { success: false, error: "خطای سرور" };
  }
}

export async function addStudent(data: any, sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) return { success: false, error: "عدم دسترسی" };
  await connectDB();

  await StudentModel.create({ ...data, classId });
  revalidatePath("/teacher");
}

export async function addListening(data: any) {
  // const cookieStore = await cookies();
  // const classId = cookieStore.get("teacher_session")?.value;

  // if (!classId) return { success: false, error: "عدم دسترسی" };
  await connectDB();

  const res = await ListeningModel.create({ ...data });

  revalidatePath("/teacher");
  if (res) return { success: true };
  else return { success: false };
}

export async function listeningUpdateById(data: any, id: any) {
  // const cookieStore = await cookies();
  // const classId = cookieStore.get("teacher_session")?.value;

  // if (!classId) return { success: false, error: "عدم دسترسی" };
  await connectDB();
  const question = [...data];

  const listening = await ListeningModel.findByIdAndUpdate(id, {
    question: question,
  });

  // await ListeningModel.create({ ...data });
  revalidatePath("/teacher");

  if (listening) {
    return { success: true };
  }
}

export async function addClass(data: any) {
  try {
    await connectDB();
    const result = await ClassModel.create({ ...data });
    revalidatePath("/signup/teacher");
    return { success: true, payload: JSON.parse(JSON.stringify(result)) };
  } catch {
    return { success: false, error: "پیام خطا" };
  }
}

export async function addStudentResponse(
  data: any,
  studentId: any,
  listeningId: any,
) {
  await connectDB();

  // پیدا کردن دانش‌آموز برای گرفتن classId
  const student: any = await StudentModel.findById(studentId).lean();
  if (!student) return { success: false, message: "Student not found" };

  const finalData = { ...data, listeningId: listeningId };

  let result = await StudentResponseModel.findOneAndUpdate(
    {
      studentId: studentId,
      classId: student.classId,
      "questions.listeningId": listeningId,
    },
    {
      $set: { "questions.$": finalData },
    },
    { new: true },
  );

  if (!result) {
    result = await StudentResponseModel.findOneAndUpdate(
      { studentId: studentId, classId: student.classId },
      {
        $push: { questions: finalData },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    );
  }

  return result ? { success: true, result } : { success: false };
}

export async function getStudentResponse(sessionToken?: string) {
  await connectDB();
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) return { success: false, error: "عدم دسترسی" };

  const result = await StudentResponseModel.find({
    classId: classId,
  }).lean();

  if (result) return { success: true, result: result };
  else {
    return { success: false };
  }
}
export async function teacherAccess(sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) return { success: false, error: "عدم دسترسی" };
  else return { success: true };
}

export async function updateStudent(id: string, data: any) {
  await connectDB();
  const updatedStudent = await StudentModel.findByIdAndUpdate(id, data, {
    new: true,
  });
  revalidatePath("/teacher");
  revalidatePath("/teacher/reports/students");
  if (updatedStudent) {
    return { success: true };
  }
  return { success: false };
}

export async function addCourse(
  name: string,
  level?: string,
  sessionToken?: string,
) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) return { success: false, error: "عدم دسترسی" };
  await connectDB();
  await CourseModel.create({
    name,
    classId: classId,
    level: (level || "").trim(),
  });
  revalidatePath("/teacher");
}

export async function addGrade(data: any, sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) return { success: false, error: "عدم دسترسی" };
  const gradeData = {
    ...data,
    classId: classId,
  };
  await connectDB();
  const scoreSave = await GradeModel.create(gradeData);
  revalidatePath("/teacher");
  if (scoreSave.score) return true;
  return false;
}

export async function removeGrade(gradeId: any, sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);
  if (!classId) {
    return { error: "عدم دسترسی: لطفاً ابتدا وارد شوید." };
  }
  await connectDB();
  const result = await GradeModel.findByIdAndDelete(gradeId);
  revalidatePath("/teacher");

  if (!result) return { error: "خطای ناشناخته در حذف نمره" };
  if (result) return { success: true, message: "عملیات موفق", result: result };
}

export async function addAttendance(
  studentId: string,
  date: string,
  absenceType: "excused" | "unexcused" = "unexcused",
  sessionToken?: string,
) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) {
    return { error: "عدم دسترسی: لطفاً ابتدا وارد شوید." };
  }

  const normalizedType = absenceType === "excused" ? "excused" : "unexcused";

  await connectDB();

  const exists = await AttendanceModel.findOne({ studentId, date });
  if (!exists) {
    await AttendanceModel.create({
      studentId,
      date,
      status: "absent",
      absenceType: normalizedType,
      classId,
    });
  } else {
    exists.absenceType = normalizedType;
    await exists.save();
  }
  revalidatePath("/teacher");
  revalidatePath("/teacher/reports/absences");
}

export async function updateAttendanceType(
  attendanceId: string,
  absenceType: "excused" | "unexcused",
  sessionToken?: string,
) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) {
    return { error: "عدم دسترسی: لطفاً ابتدا وارد شوید." };
  }

  const normalizedType = absenceType === "excused" ? "excused" : "unexcused";

  await connectDB();
  await AttendanceModel.findOneAndUpdate(
    { _id: attendanceId, classId },
    { absenceType: normalizedType },
  );
  revalidatePath("/teacher");
  revalidatePath("/teacher/reports/absences");
  return { success: true };
}

export async function removeAttendance(studentId: string, date: string) {
  await connectDB();
  await AttendanceModel.findOneAndDelete({ studentId, date });
  revalidatePath("/teacher");
  revalidatePath("/teacher/reports/absences");
}

export async function removeStudent(studentId: string) {
  await connectDB();
  const deletedStudent = await StudentModel.findByIdAndDelete(studentId);

  if (!deletedStudent) {
    console.log("موردی پیدا نشد!");
  } else {
    console.log("دانشجو با موفقیت حذف شد:", deletedStudent.firstName);
    return {
      firstName: deletedStudent.firstName,
      lastName: deletedStudent.lastName,
    };
  }
  revalidatePath("/teacher");
}

export async function removeCourse(courseId: string) {
  await connectDB();
  const deletedCourse = await CourseModel.findByIdAndDelete(courseId);

  if (!deletedCourse) {
    console.log("موردی پیدا نشد!");
  } else {
    console.log("درس موردنظر با موفقیت حذف شد:", deletedCourse.firstName);
    return {
      name: deletedCourse.name,
    };
  }
  revalidatePath("/teacher");
}

export async function addHomework(data: any, sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (!classId) return { success: false, error: "عدم دسترسی" };

  const parsedDays = Number(data?.displayDays);
  const displayDays =
    Number.isFinite(parsedDays) && parsedDays > 0
      ? Math.min(365, Math.round(parsedDays))
      : 7;
  const expiresAt = new Date(Date.now() + displayDays * 24 * 60 * 60 * 1000);

  await connectDB();
  await HomeworkModel.create({
    ...data,
    classId,
    displayDays,
    expiresAt,
    completedBy: [],
  });
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { success: true };
}

export async function markHomeworkCompleted(
  homeworkId: string,
  studentId: string,
) {
  if (!homeworkId || !studentId) {
    return { success: false, error: "شناسه تکلیف یا دانش‌آموز نامعتبر است." };
  }
  await connectDB();
  const updated = await HomeworkModel.findByIdAndUpdate(
    homeworkId,
    { $addToSet: { completedBy: String(studentId) } },
    { new: true },
  );
  if (!updated) {
    return { success: false, error: "تکلیف مورد نظر یافت نشد." };
  }
  revalidatePath("/student");
  revalidatePath("/teacher");
  return { success: true };
}

export async function addTeacherEvent(
  data: { date: string; title?: string; description: string; level?: string },
  sessionToken?: string,
) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);
  if (!classId) return { success: false, error: "عدم دسترسی" };

  const date = (data?.date || "").trim();
  const description = (data?.description || "").trim();
  const title = (data?.title || "").trim();
  const level = (data?.level || "").trim();

  if (!date || !description) {
    return {
      success: false,
      error: "لطفاً تاریخ و توضیحات رویداد را وارد کنید.",
    };
  }

  await connectDB();
  const created = await TeacherEventModel.create({
    classId,
    date,
    title,
    description,
    level,
  });
  revalidatePath("/teacher");
  return {
    success: true,
    event: JSON.parse(JSON.stringify(created)),
  };
}

export async function removeTeacherEvent(
  eventId: string,
  sessionToken?: string,
) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);
  if (!classId) return { success: false, error: "عدم دسترسی" };

  await connectDB();
  await TeacherEventModel.findOneAndDelete({ _id: eventId, classId });
  revalidatePath("/teacher");
  return { success: true };
}

export async function saveAIReport(studentId: string, content: string) {
  await connectDB();
  await ReportModel.findOneAndUpdate(
    { studentId },
    { content, timestamp: Date.now() },
    { upsert: true },
  );
  revalidatePath("/teacher");
}

export async function generateAIReportAction(
  student: any,
  grades: any[],
  courses: any[],
) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "API Key missing";

  const ai = new GoogleGenAI({ apiKey });

  const gradeDetails = grades
    .map((g) => {
      const courseName =
        courses.find((c) => c._id.toString() === g.courseId.toString())?.name ||
        "درس نامشخص";
      return `- درس: ${courseName}، نمره: ${g.score}، توضیحات: ${g.description || "ندارد"}`;
    })
    .join("\n");

  const prompt = `
    نقش: مشاور تحصیلی مدرسه.
    دانش‌آموز: ${student.firstName} ${student.lastName}
    نمرات:
    ${gradeDetails}
    
    یک گزارش کوتاه (حداکثر 150 کلمه) تحلیل عملکرد بنویس. نقاط قوت و ضعف و توصیه ارائه بده.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "خطا در تولید متن";
  } catch (e) {
    console.error(e);
    return "خطا در ارتباط با هوش مصنوعی";
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const isHttps = await isHttpsRequest();

  cookieStore.set("teacher_session", "", {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    ...(isHttps ? { partitioned: true } : {}),
    maxAge: 0,
    path: "/",
  } as any);

  return { success: true };
}

export async function loginCheck(sessionToken?: string) {
  const classId = await getAuthenticatedTeacherClassId(sessionToken);

  if (classId) return { success: true };
  return { success: false, error: "عدم دسترسی" };
}

export async function getAlphabetsList() {
  try {
    await connectDB();

    const alphabets = await Alphabet.find({}).select("_id letterGroup").lean();

    const formattedData = alphabets.map((item: any) => ({
      _id: item._id.toString(),
      letterGroup: item.letterGroup,
    }));

    return { success: true, data: formattedData };
  } catch (error) {
    console.error("خطا در دریافت لیست الفبا:", error);
    return {
      success: false,
      error: "مشکلی در دریافت اطلاعات از سرور پیش آمد.",
    };
  }
}

export async function getAlphabetById(id: string) {
  try {
    await connectDB();

    const alphabet = await Alphabet.findById(id).lean();

    if (!alphabet) {
      return { success: false, error: "حرف مورد نظر یافت نشد." };
    }

    const plainResult = JSON.parse(JSON.stringify(alphabet));

    return { success: true, data: plainResult };
  } catch (error) {
    console.error("خطا در دریافت اطلاعات حرف الفبا:", error);
    return {
      success: false,
      error: "خطای برقراری ارتباط با سرور.",
    };
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(
  formData: FormData,
): Promise<CloudinaryUploadResponse> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "فایلی انتخاب نشده است" };

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "smart_class_assets",
          resource_type: "auto",
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (result) {
            resolve({
              success: true,
              url: result.secure_url,
              publicId: result.public_id,
            });
          } else {
            reject({ success: false, error: error.message });
          }
        },
      );
      uploadStream.end(buffer);
    });
  } catch (error) {
    return { success: false, error: "خطا در پردازش فایل آپلودی" };
  }
}

export async function getCloudinaryFile(
  publicId: string,
): Promise<CloudinaryMetadataResponse> {
  try {
    const result = await cloudinary.api.resource(publicId);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: "فایل پیدا نشد یا خطایی رخ داد" };
  }
}
