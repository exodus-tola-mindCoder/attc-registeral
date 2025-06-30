import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: {
      values: ['Freshman', 'Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'],
      message: 'Department must be one of: Freshman, Electrical, Manufacturing, Automotive, Construction, ICT'
    }
  },
  year: {
    type: Number,
    required: [true, 'Academic year is required'],
    min: [1, 'Year must be between 1-5'],
    max: [5, 'Year must be between 1-5']
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    enum: {
      values: [1, 2],
      message: 'Semester must be 1 or 2'
    }
  },
  courses: [{
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    courseCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    courseName: {
      type: String,
      required: true,
      trim: true
    },
    credit: {
      type: Number,
      required: true,
      min: 1,
      max: 6
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    isRepeat: {
      type: Boolean,
      default: false
    },
    previousGrade: {
      type: String,
      enum: ['F', 'NG', 'D', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+']
    }
  }],
  totalCredits: {
    type: Number,
    required: [true, 'Total credits is required'],
    min: [0, 'Total credits cannot be negative']
  },
  registrationDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: String,
    enum: {
      values: ['registered', 'confirmed', 'cancelled', 'completed'],
      message: 'Status must be one of: registered, confirmed, cancelled, completed'
    },
    default: 'registered'
  },
  registrationSlipPath: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  academicYear: {
    type: String,
    required: true
  },
  registrationNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  isRepeatSemester: {
    type: Boolean,
    default: false
  },
  repeatCourseCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate registrations
registrationSchema.index({
  studentId: 1,
  year: 1,
  semester: 1
}, {
  unique: true,
  name: 'unique_student_semester_registration'
});

// Index for efficient queries
registrationSchema.index({ department: 1, year: 1, semester: 1 });
registrationSchema.index({ status: 1 });
registrationSchema.index({ registrationDate: -1 });
registrationSchema.index({ academicYear: 1 });
registrationSchema.index({ isRepeatSemester: 1 });

// Pre-save middleware to calculate total credits and repeat info
registrationSchema.pre('save', function (next) {
  if (this.courses && this.courses.length > 0) {
    this.totalCredits = this.courses.reduce((total, course) => total + course.credit, 0);
    this.repeatCourseCount = this.courses.filter(course => course.isRepeat).length;
    this.isRepeatSemester = this.repeatCourseCount > 0;
  }

  // Generate academic year string
  const regDate = new Date(this.registrationDate);
  const year = regDate.getFullYear();
  this.academicYear = `${year}-${year + 1}`;

  next();
});

// Pre-save middleware to generate registration number
registrationSchema.pre('save', async function (next) {
  if (this.isNew && !this.registrationNumber) {
    try {
      const count = await this.constructor.countDocuments({
        year: this.year,
        semester: this.semester,
        academicYear: this.academicYear
      });

      const prefix = this.isRepeatSemester ? 'REP' : 'REG';
      this.registrationNumber = `${prefix}-${this.academicYear}-Y${this.year}S${this.semester}-${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Virtual for registration summary
registrationSchema.virtual('summary').get(function () {
  return {
    registrationNumber: this.registrationNumber,
    student: this.studentId,
    semester: `Year ${this.year}, Semester ${this.semester}`,
    department: this.department,
    courseCount: this.courses.length,
    totalCredits: this.totalCredits,
    status: this.status,
    registrationDate: this.registrationDate,
    isRepeatSemester: this.isRepeatSemester,
    repeatCourseCount: this.repeatCourseCount
  };
});

// Static method to get student's registration history
registrationSchema.statics.getStudentHistory = function (studentId) {
  return this.find({ studentId })
    .populate('studentId', 'firstName fatherName grandfatherName studentId email')
    .sort({ year: -1, semester: -1, registrationDate: -1 });
};

// Static method to get semester statistics
registrationSchema.statics.getSemesterStats = async function (department, year, semester) {
  const stats = await this.aggregate([
    {
      $match: {
        department,
        year,
        semester,
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalRegistrations: { $sum: 1 },
        totalCredits: { $sum: '$totalCredits' },
        averageCredits: { $avg: '$totalCredits' },
        repeatRegistrations: {
          $sum: { $cond: ['$isRepeatSemester', 1, 0] }
        },
        statusBreakdown: {
          $push: '$status'
        }
      }
    }
  ]);

  return stats.length > 0 ? stats[0] : {
    totalRegistrations: 0,
    totalCredits: 0,
    averageCredits: 0,
    repeatRegistrations: 0,
    statusBreakdown: []
  };
};

// Instance method to check if registration can be modified
registrationSchema.methods.canBeModified = function () {
  const now = new Date();
  const registrationDate = new Date(this.registrationDate);
  const daysSinceRegistration = (now - registrationDate) / (1000 * 60 * 60 * 24);

  // Allow modifications within 7 days of registration and only if status is 'registered'
  return daysSinceRegistration <= 7 && this.status === 'registered';
};

// Instance method to generate registration slip filename
registrationSchema.methods.getSlipFilename = function () {
  return `registration-slip-${this.registrationNumber}.pdf`;
};

// Instance method to get repeat course summary
registrationSchema.methods.getRepeatCourseSummary = function () {
  const repeatCourses = this.courses.filter(course => course.isRepeat);
  return {
    hasRepeatCourses: repeatCourses.length > 0,
    repeatCourseCount: repeatCourses.length,
    repeatCourses: repeatCourses.map(course => ({
      courseCode: course.courseCode,
      courseName: course.courseName,
      previousGrade: course.previousGrade,
      credit: course.credit
    }))
  };
};

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;