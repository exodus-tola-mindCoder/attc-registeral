import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required']
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID is required']
  },
  classScheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSchedule',
    required: [true, 'Class Schedule ID is required']
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  status: {
    type: String,
    enum: {
      values: ['present', 'absent', 'excused'],
      message: 'Status must be one of: present, absent, excused'
    },
    required: [true, 'Status is required']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdated: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index to ensure one attendance record per student per course per date
attendanceSchema.index({
  studentId: 1,
  courseId: 1,
  date: 1
}, {
  unique: true,
  name: 'unique_attendance_record'
});

// Indexes for efficient queries
attendanceSchema.index({ courseId: 1, date: 1 });
attendanceSchema.index({ studentId: 1, courseId: 1 });
attendanceSchema.index({ instructorId: 1, date: 1 });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ classScheduleId: 1 });

// Static method to calculate attendance percentage for a student in a course
attendanceSchema.statics.calculateAttendancePercentage = async function (studentId, courseId) {
  const attendanceRecords = await this.find({
    studentId,
    courseId
  });

  if (attendanceRecords.length === 0) {
    return {
      percentage: 0,
      totalClasses: 0,
      present: 0,
      absent: 0,
      excused: 0
    };
  }

  const totalClasses = attendanceRecords.length;
  const present = attendanceRecords.filter(record => record.status === 'present').length;
  const absent = attendanceRecords.filter(record => record.status === 'absent').length;
  const excused = attendanceRecords.filter(record => record.status === 'excused').length;

  // Calculate percentage (present + excused) / total
  const percentage = ((present + excused) / totalClasses) * 100;

  return {
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
    totalClasses,
    present,
    absent,
    excused
  };
};

// Static method to get attendance summary for a course
attendanceSchema.statics.getCourseAttendanceSummary = async function (courseId) {
  // Get all unique students for this course
  const uniqueStudents = await this.distinct('studentId', { courseId });

  // Get all attendance records for this course
  const attendanceRecords = await this.find({ courseId })
    .populate('studentId', 'firstName fatherName grandfatherName studentId')
    .populate('classScheduleId', 'dayOfWeek startTime endTime roomNumber');

  // Calculate total classes (unique dates)
  const uniqueDates = [...new Set(attendanceRecords.map(record =>
    record.date.toISOString().split('T')[0]
  ))];

  const totalClasses = uniqueDates.length;

  // Group by student
  const studentAttendance = {};

  for (const record of attendanceRecords) {
    const studentId = record.studentId._id.toString();

    if (!studentAttendance[studentId]) {
      studentAttendance[studentId] = {
        student: {
          id: studentId,
          name: `${record.studentId.firstName} ${record.studentId.fatherName}`,
          studentId: record.studentId.studentId
        },
        present: 0,
        absent: 0,
        excused: 0,
        percentage: 0
      };
    }

    studentAttendance[studentId][record.status]++;
  }

  // Calculate percentages
  Object.values(studentAttendance).forEach(student => {
    const attended = student.present + student.excused;
    student.percentage = totalClasses > 0 ? Math.round((attended / totalClasses) * 1000) / 10 : 0;
    student.totalClasses = totalClasses;
  });

  return {
    courseId,
    totalClasses,
    uniqueDates,
    studentCount: uniqueStudents.length,
    studentAttendance: Object.values(studentAttendance),
    averageAttendance: Object.values(studentAttendance).reduce((sum, student) => sum + student.percentage, 0) /
      (Object.values(studentAttendance).length || 1)
  };
};

// Static method to check if a student is eligible for final exam based on attendance
attendanceSchema.statics.checkFinalExamEligibility = async function (studentId, courseId, requiredPercentage = 75) {
  const attendanceStats = await this.calculateAttendancePercentage(studentId, courseId);

  return {
    eligible: attendanceStats.percentage >= requiredPercentage,
    percentage: attendanceStats.percentage,
    requiredPercentage,
    deficit: Math.max(0, requiredPercentage - attendanceStats.percentage),
    totalClasses: attendanceStats.totalClasses,
    present: attendanceStats.present,
    absent: attendanceStats.absent,
    excused: attendanceStats.excused
  };
};

// Static method to get all attendance records for a student across all courses
attendanceSchema.statics.getStudentAttendanceAcrossCourses = async function (studentId) {
  // Get all courses the student has attendance records for
  const courses = await this.distinct('courseId', { studentId });

  const attendanceByCourse = [];

  for (const courseId of courses) {
    const courseDetails = await mongoose.model('Course').findById(courseId);
    const attendanceStats = await this.calculateAttendancePercentage(studentId, courseId);

    attendanceByCourse.push({
      courseId,
      courseCode: courseDetails?.courseCode || 'Unknown',
      courseName: courseDetails?.courseName || 'Unknown',
      ...attendanceStats
    });
  }

  return {
    studentId,
    courses: attendanceByCourse,
    overallAttendance: attendanceByCourse.reduce((sum, course) => sum + course.percentage, 0) /
      (attendanceByCourse.length || 1)
  };
};

// Instance method to check if attendance can be updated
attendanceSchema.methods.canBeUpdated = function (userId, userRole) {
  // Get current date without time
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recordDate = new Date(this.date);
  recordDate.setHours(0, 0, 0, 0);

  // Instructors can only update attendance for the current day
  if (userRole === 'instructor') {
    // Allow if it's the same instructor and same day
    return this.instructorId.toString() === userId && recordDate.getTime() === today.getTime();
  }

  // Department heads and registrars can update any attendance
  return ['departmentHead', 'registrar'].includes(userRole);
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;