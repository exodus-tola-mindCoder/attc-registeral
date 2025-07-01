import mongoose from 'mongoose';

const gradeSchema = new mongoose.Schema({
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
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: [true, 'Registration ID is required']
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor ID is required']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required']
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    enum: [1, 2]
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: 1,
    max: 5
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['Freshman', 'Electrical', 'Manufacturing', 'Automotive']
  },
  
  // Grade Components
  midtermMark: {
    type: Number,
    min: [0, 'Midterm mark cannot be negative'],
    max: [30, 'Midterm mark cannot exceed 30'],
    default: 0
  },
  continuousMark: {
    type: Number,
    min: [0, 'Continuous mark cannot be negative'],
    max: [30, 'Continuous mark cannot exceed 30'],
    default: 0
  },
  finalExamMark: {
    type: Number,
    min: [0, 'Final exam mark cannot be negative'],
    max: [40, 'Final exam mark cannot exceed 40'],
    default: 0
  },
  
  // Calculated Fields
  totalMark: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  letterGrade: {
    type: String,
    enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F', 'NG', 'W', 'I'],
    default: 'NG'
  },
  gradePoints: {
    type: Number,
    min: 0,
    max: 4,
    default: 0
  },
  
  // Academic Status Flags
  probation: {
    type: Boolean,
    default: false
  },
  dismissed: {
    type: Boolean,
    default: false
  },
  repeatRequired: {
    type: Boolean,
    default: false
  },
  
  // Workflow Status
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected', 'finalized', 'locked'],
    default: 'draft'
  },
  
  // Workflow Tracking
  submittedAt: Date,
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  finalizedAt: Date,
  finalizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lockedAt: Date,
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Comments and Notes
  instructorComments: {
    type: String,
    maxlength: [500, 'Instructor comments cannot exceed 500 characters']
  },
  deptHeadComments: {
    type: String,
    maxlength: [500, 'Department head comments cannot exceed 500 characters']
  },
  registrarComments: {
    type: String,
    maxlength: [500, 'Registrar comments cannot exceed 500 characters']
  },
  
  // Rejection Reason
  rejectionReason: {
    type: String,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
gradeSchema.index({ studentId: 1, courseId: 1, academicYear: 1 }, { unique: true });
gradeSchema.index({ instructorId: 1, status: 1 });
gradeSchema.index({ department: 1, year: 1, semester: 1 });
gradeSchema.index({ status: 1, submittedAt: -1 });
gradeSchema.index({ academicYear: 1, semester: 1 });

// Pre-save middleware to calculate total mark and grade
gradeSchema.pre('save', function(next) {
  // Calculate total mark
  this.totalMark = this.midtermMark + this.continuousMark + this.finalExamMark;
  
  // Calculate letter grade and grade points
  const gradeInfo = this.calculateLetterGrade(this.totalMark);
  this.letterGrade = gradeInfo.letter;
  this.gradePoints = gradeInfo.points;
  
  // Check if repeat is required
  this.repeatRequired = ['F', 'NG'].includes(this.letterGrade);
  
  next();
});

// Instance method to calculate letter grade
gradeSchema.methods.calculateLetterGrade = function(totalMark) {
  if (totalMark >= 90) return { letter: 'A+', points: 4.0 };
  if (totalMark >= 85) return { letter: 'A', points: 4.0 };
  if (totalMark >= 80) return { letter: 'A-', points: 3.75 };
  if (totalMark >= 75) return { letter: 'B+', points: 3.5 };
  if (totalMark >= 70) return { letter: 'B', points: 3.0 };
  if (totalMark >= 65) return { letter: 'B-', points: 2.75 };
  if (totalMark >= 60) return { letter: 'C+', points: 2.5 };
  if (totalMark >= 50) return { letter: 'C', points: 2.0 };
  if (totalMark >= 40) return { letter: 'D', points: 1.0 };
  return { letter: 'F', points: 0.0 };
};

// Instance method to check if grade can be modified
gradeSchema.methods.canBeModified = function() {
  return ['draft', 'rejected'].includes(this.status);
};

// Instance method to check if grade can be submitted
gradeSchema.methods.canBeSubmitted = function() {
  return ['draft', 'rejected'].includes(this.status);
};

// Instance method to check if grade can be approved
gradeSchema.methods.canBeApproved = function() {
  return this.status === 'submitted';
};

// Instance method to check if grade can be finalized
gradeSchema.methods.canBeFinalized = function() {
  return this.status === 'approved';
};

// Static method to calculate student CGPA
gradeSchema.statics.calculateStudentCGPA = async function(studentId, academicYear = null) {
  const matchQuery = { 
    studentId, 
    status: 'finalized',
    letterGrade: { $nin: ['W', 'I', 'NG'] }
  };
  
  if (academicYear) {
    matchQuery.academicYear = academicYear;
  }

  const grades = await this.aggregate([
    { $match: matchQuery },
    {
      $lookup: {
        from: 'courses',
        localField: 'courseId',
        foreignField: '_id',
        as: 'course'
      }
    },
    { $unwind: '$course' },
    {
      $group: {
        _id: null,
        totalGradePoints: { 
          $sum: { $multiply: ['$gradePoints', '$course.credit'] }
        },
        totalCredits: { $sum: '$course.credit' },
        courseCount: { $sum: 1 }
      }
    }
  ]);

  if (grades.length === 0) {
    return { cgpa: 0, totalCredits: 0, courseCount: 0 };
  }

  const result = grades[0];
  const cgpa = result.totalCredits > 0 ? result.totalGradePoints / result.totalCredits : 0;
  
  return {
    cgpa: Math.round(cgpa * 100) / 100, // Round to 2 decimal places
    totalCredits: result.totalCredits,
    courseCount: result.courseCount
  };
};

// Static method to get grades pending approval
gradeSchema.statics.getPendingApprovals = function(departmentHeadId) {
  return this.find({
    status: 'submitted'
  })
  .populate('studentId', 'firstName fatherName grandfatherName studentId')
  .populate('courseId', 'courseCode courseName credit')
  .populate('instructorId', 'firstName fatherName')
  .sort({ submittedAt: 1 });
};

// Static method to get semester grade statistics
gradeSchema.statics.getSemesterStats = async function(department, year, semester, academicYear) {
  const stats = await this.aggregate([
    {
      $match: {
        department,
        year,
        semester,
        academicYear,
        status: 'finalized'
      }
    },
    {
      $group: {
        _id: '$letterGrade',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  const totalStudents = await this.countDocuments({
    department,
    year,
    semester,
    academicYear,
    status: 'finalized'
  });

  return {
    gradeDistribution: stats,
    totalStudents
  };
};

const Grade = mongoose.model('Grade', gradeSchema);

export default Grade;