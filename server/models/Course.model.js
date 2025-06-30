import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: [true, 'Course code is required'],
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{2,4}\s\d{4}$/, 'Course code must be in format: ABCD 1234']
  },
  courseName: {
    type: String,
    required: [true, 'Course name is required'],
    trim: true,
    maxlength: [200, 'Course name cannot exceed 200 characters']
  },
  credit: {
    type: Number,
    required: [true, 'Credit hours are required'],
    min: [1, 'Credit hours must be at least 1'],
    max: [6, 'Credit hours cannot exceed 6']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: {
      values: ['Freshman', 'Electrical', 'Manufacturing', 'Automotive'],
      message: 'Department must be one of: Freshman, Electrical, Manufacturing, Automotive'
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Course creator is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  prerequisites: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Compound index for unique course per department/year/semester
courseSchema.index({
  courseCode: 1,
  department: 1,
  year: 1,
  semester: 1
}, {
  unique: true,
  name: 'unique_course_per_semester'
});

// Index for efficient queries
courseSchema.index({ department: 1, year: 1, semester: 1 });
courseSchema.index({ createdBy: 1 });
courseSchema.index({ isActive: 1 });

// Virtual for full course identifier
courseSchema.virtual('fullIdentifier').get(function () {
  return `${this.courseCode} - ${this.courseName} (${this.credit} credits)`;
});

// Static method to get courses for specific semester
courseSchema.statics.getCoursesForSemester = function (department, year, semester) {
  return this.find({
    department,
    year,
    semester,
    isActive: true
  }).sort({ courseCode: 1 });
};

// Static method to calculate total credits for semester
courseSchema.statics.getTotalCreditsForSemester = async function (department, year, semester) {
  const result = await this.aggregate([
    {
      $match: {
        department,
        year,
        semester,
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalCredits: { $sum: '$credit' },
        courseCount: { $sum: 1 }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { totalCredits: 0, courseCount: 0 };
};

// Instance method to check if course can be deleted
courseSchema.methods.canBeDeleted = async function () {
  // Check if any students are registered for this course
  const Registration = mongoose.model('Registration');
  const registrationCount = await Registration.countDocuments({
    'courses.courseCode': this.courseCode,
    'courses.department': this.department,
    'courses.year': this.year,
    'courses.semester': this.semester
  });

  return registrationCount === 0;
};

const Course = mongoose.model('Course', courseSchema);

export default Course;