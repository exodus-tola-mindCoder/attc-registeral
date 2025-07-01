import mongoose from 'mongoose';

const classScheduleSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID is required']
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
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['Freshman', 'Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT']
  },
  dayOfWeek: {
    type: String,
    required: [true, 'Day of week is required'],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format']
  },
  roomNumber: {
    type: String,
    required: [true, 'Room number is required'],
    trim: true,
    maxlength: [20, 'Room number cannot exceed 20 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
classScheduleSchema.index({
  courseId: 1,
  academicYear: 1,
  semester: 1
});

// Indexes for conflict checking
classScheduleSchema.index({
  instructorId: 1,
  dayOfWeek: 1,
  academicYear: 1,
  semester: 1
});

classScheduleSchema.index({
  roomNumber: 1,
  dayOfWeek: 1,
  academicYear: 1,
  semester: 1
});

// Index for student schedule lookup
classScheduleSchema.index({
  department: 1,
  academicYear: 1,
  semester: 1
});

// Static method to check for scheduling conflicts
classScheduleSchema.statics.checkConflicts = async function (scheduleData, excludeId = null) {
  const { instructorId, roomNumber, dayOfWeek, startTime, endTime, academicYear, semester } = scheduleData;

  // Convert time strings to minutes for easier comparison
  const startMinutes = convertTimeToMinutes(startTime);
  const endMinutes = convertTimeToMinutes(endTime);

  // Base query for conflicts
  const baseQuery = {
    dayOfWeek,
    academicYear,
    semester,
    isActive: true
  };

  if (excludeId) {
    baseQuery._id = { $ne: excludeId };
  }

  // Check for instructor conflicts
  const instructorConflicts = await this.find({
    ...baseQuery,
    instructorId,
    $or: [
      // New class starts during an existing class
      {
        startTime: { $lte: startTime },
        endTime: { $gt: startTime }
      },
      // New class ends during an existing class
      {
        startTime: { $lt: endTime },
        endTime: { $gte: endTime }
      },
      // New class completely contains an existing class
      {
        startTime: { $gte: startTime },
        endTime: { $lte: endTime }
      }
    ]
  });

  // Check for room conflicts
  const roomConflicts = await this.find({
    ...baseQuery,
    roomNumber,
    $or: [
      // New class starts during an existing class
      {
        startTime: { $lte: startTime },
        endTime: { $gt: startTime }
      },
      // New class ends during an existing class
      {
        startTime: { $lt: endTime },
        endTime: { $gte: endTime }
      },
      // New class completely contains an existing class
      {
        startTime: { $gte: startTime },
        endTime: { $lte: endTime }
      }
    ]
  });

  return {
    hasConflicts: instructorConflicts.length > 0 || roomConflicts.length > 0,
    instructorConflicts,
    roomConflicts
  };
};

// Static method to get student schedule
classScheduleSchema.statics.getStudentSchedule = async function (studentId, academicYear, semester) {
  // Get student's registered courses
  const Registration = mongoose.model('Registration');
  const registrations = await Registration.find({
    studentId,
    academicYear,
    semester,
    status: { $ne: 'cancelled' }
  });

  if (registrations.length === 0) {
    return [];
  }

  // Extract course IDs from registrations
  const courseIds = registrations.flatMap(reg =>
    reg.courses.map(course => course.courseId)
  );

  // Find schedules for these courses
  return this.find({
    courseId: { $in: courseIds },
    academicYear,
    semester,
    isActive: true
  })
    .populate('courseId', 'courseCode courseName credit')
    .populate('instructorId', 'firstName fatherName')
    .sort({ dayOfWeek: 1, startTime: 1 });
};

// Helper function to convert HH:MM to minutes for comparison
function convertTimeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Instance method to check if a time slot is valid
classScheduleSchema.methods.isValidTimeSlot = function () {
  const startMinutes = convertTimeToMinutes(this.startTime);
  const endMinutes = convertTimeToMinutes(this.endTime);

  // End time must be after start time
  return endMinutes > startMinutes;
};

// Virtual for formatted time slot
classScheduleSchema.virtual('timeSlot').get(function () {
  return `${this.startTime} - ${this.endTime}`;
});

// Virtual for duration in minutes
classScheduleSchema.virtual('durationMinutes').get(function () {
  const startMinutes = convertTimeToMinutes(this.startTime);
  const endMinutes = convertTimeToMinutes(this.endTime);
  return endMinutes - startMinutes;
});

const ClassSchedule = mongoose.model('ClassSchedule', classScheduleSchema);

export default ClassSchedule;