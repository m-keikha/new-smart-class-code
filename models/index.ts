import mongoose, { Schema, model, models } from "mongoose";
import { string } from "yup";

const classSchema = new Schema({
  className: String,
  teacherName: String,
  schoolName: { type: String, default: "" },
  gradeLevel: { type: String, default: "" },
  gradeLevels: { type: [String], default: [] },
  province: { type: String, default: "" },
  city: { type: String, default: "" },
  password: { type: String, required: true },
  userName: { type: String, required: true, unique: true }, // اضافه شده برای لاگین
  role: { type: String, default: "teacher", required: true },
});

// Student Schema
const studentSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },
  firstName: String,
  lastName: String,
  nationalId: { type: String, unique: true },
  fatherName: String,
  level: { type: String, default: "" },
  password: { type: String, default: "" },
  phoneNumber: { type: String, default: "" },
  specialDisease: { type: String, default: "" },
  isLeftHanded: { type: Boolean, default: false },
  guardianName: { type: String, default: "" },
  guardianRelation: { type: String, default: "" },
  guardianPhone: { type: String, default: "" },
  messengerType: { type: String, default: "" },
  remoteAccessMethods: { type: [String], default: [] },
  dailyNotes: [
    {
      date: String,
      content: String,
    },
  ],
});

const courseSchema = new Schema({
  classId: { type: Schema.Types.ObjectId, ref: "Class", index: true },
  name: String,
  level: { type: String, default: "" },
});

const gradeSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },
  studentId: { type: Schema.Types.ObjectId, ref: "Student" },
  courseId: { type: Schema.Types.ObjectId, ref: "Course" },
  score: Number,
  description: String,
  date: String,
});

const attendanceSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    index: true,
  },
  studentId: { type: Schema.Types.ObjectId, ref: "Student" },
  date: String,
  status: { type: String, enum: ["absent", "present"], default: "absent" },
  absenceType: {
    type: String,
    enum: ["unexcused", "excused"],
    default: "unexcused",
  },
});

const StudentsReadingResponseSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    index: true,
    required: true,
  },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  questions: { type: [Schema.Types.Mixed], default: [] },
});
// if (models.StudentResponse) {
//   delete mongoose.models.StudentResponse;
// }

const homeworkSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },
  title: String,
  description: String,
  dueDate: String,
  target: String, // 'ALL' or Student ObjectId
  level: { type: String, default: "" },
  displayDays: { type: Number, default: 7 },
  expiresAt: { type: Date, default: null },
  completedBy: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const teacherEventSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },
  date: { type: String, required: true },
  title: { type: String, default: "" },
  description: { type: String, required: true },
  level: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const QuestionSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
  },
  listeningId: { type: Schema.Types.ObjectId, ref: "Listening" },
  questions: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

const ListeningSchema = new Schema(
  {
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      index: true,
    },

    title: {
      type: String,
      // required: [true, "عنوان الزامی است"],
      trim: true,
    },

    level: {
      type: String,
      // required: [true, "سطح الزامی است"],
      enum: ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم"],
    },

    text: {
      type: String,
    },

    vipListening: {
      voiceName: { type: String },
      text: { type: String },
      transcription: { type: Schema.Types.Mixed },
    },


    audio_url: { type: String },
    audioPublicId: { type: String },
  },
  {
    timestamps: true,
  },
);


const reportSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },
  studentId: { type: Schema.Types.ObjectId, ref: "Student" },
  content: String,
  timestamp: Number,
});

if (models.Class) {
  delete models.Class;
}

const MediaVariantSchema = new Schema({
  text: { type: String, required: true },
  imageUrl: { type: String, default: "" },
  imagePublicId: { type: String, default: "" },
  audioUrl: { type: String, default: "" },
  audioPublicId: { type: String, default: "" },
});

const SentenceVariantSchema = new Schema({
  text: { type: String, required: true },
  audioUrl: { type: String, default: "" },
  audioPublicId: { type: String, default: "" },
});

const AlphabetSchema = new Schema(
  {
    letterGroup: {
      type: String,
      required: [true, "نام گروه حرف الفبایی الزامی است"],
      unique: true,
      trim: true,
    },
    letterVariants: [MediaVariantSchema],
    examples: [MediaVariantSchema],
    sentences: [SentenceVariantSchema],
  },
  {
    timestamps: true,
  },
);

export const ListeningModel =
  models.Listening || model("Listening", ListeningSchema);

export const QuestionModel =
  models.Question || model("Question", QuestionSchema);

export const StudentResponseModel =
  models.StudentResponse ||
  model("StudentResponse", StudentsReadingResponseSchema);
export const ClassModel = models.Class || model("Class", classSchema);
if (
  models.Student &&
  (!models.Student.schema.path("level") ||
    !models.Student.schema.path("isLeftHanded") ||
    !models.Student.schema.path("remoteAccessMethods"))
) {
  delete models.Student;
}
export const StudentModel = models.Student || model("Student", studentSchema);
if (models.Course && !models.Course.schema.path("level")) {
  delete models.Course;
}
export const CourseModel = models.Course || model("Course", courseSchema);
export const GradeModel = models.Grade || model("Grade", gradeSchema);
if (models.Attendance && !models.Attendance.schema.path("absenceType")) {
  delete models.Attendance;
}

export const AttendanceModel =
  models.Attendance || model("Attendance", attendanceSchema);
if (
  models.Homework &&
  (!models.Homework.schema.path("level") ||
    !models.Homework.schema.path("displayDays") ||
    !models.Homework.schema.path("expiresAt") ||
    !models.Homework.schema.path("completedBy"))
) {
  delete models.Homework;
}
export const HomeworkModel =
  models.Homework || model("Homework", homeworkSchema);
export const TeacherEventModel =
  models.TeacherEvent || model("TeacherEvent", teacherEventSchema);
export const ReportModel = models.Report || model("Report", reportSchema);
export const Alphabet = models.Alphabet || model("Alphabet", AlphabetSchema);
