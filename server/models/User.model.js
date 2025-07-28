import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  fatherName: {
    type: String,
    required: [true, 'Father name is required'],
    trim: true,
    maxlength: [50, 'Father name cannot exceed 50 characters']
  },
  grandfatherName: {
    type: String,
    required: [true, 'Grandfather name is required'],
    trim: true,
    maxlength: [50, 'Grandfather name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please provide a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  role: {
    type: String,
    enum: {
      values: ['student', 'instructor', 'departmentHead', 'registrar', 'itAdmin', 'president', 'placementCommittee', 'graduationCommittee'],
      message: 'Role must be one of: student, instructor, departmentHead, registrar, itAdmin, president, placementCommittee, graduationCommittee'
    },
    default: 'student'
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  // Student ID - unique and unchangeable
  studentId: {
    type: String,
    sparse: true,
    unique: true
  },
  department: {
    type: String,
    enum: ['Electrical', 'Manufacturing', 'Automotive', 'Construction', 'Freshman', 'ICT'],
    required: function() {
      return this.role === 'student' && this.currentYear > 1;
    }
  },
  currentYear: {
    type: Number,
    min: 1,
    max: 5,
    default: 1,
    required: function() {
      return this.role === 'student';
    }
  },
  currentSemester: {
    type: Number,
    min: 1,
    max: 2,
    default: 1,
    required: function() {
      return this.role === 'student';
    }
  },
  enrollmentYear: {
    type: Number,
    required: function() {
      return this.role === 'student';
    }
  },
  // PDF Upload fields for freshman students
  grade11Transcript: {
    type: String, // File path
    required: function() {
      return this.role === 'student' && this.currentYear === 1;
    }
  },
  grade12Transcript: {
    type: String, // File path
    required: function() {
      return this.role === 'student' && this.currentYear === 1;
    }
  },
  entranceExamResult: {
    type: String, // File path
    required: function() {
      return this.role === 'student' && this.currentYear === 1;
    }
  },
  // Additional fields for imported senior students
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  importedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'graduated'],
    default: 'active'
  },
  lastLogin: {
    type: Date
  },
  
  // Academic Standing Fields (BLOCK 5)
  probation: {
    type: Boolean,
    default: false
  },
  dismissed: {
    type: Boolean,
    default: false
  },
  lastCGPA: {
    type: Number,
    min: 0,
    max: 4,
    default: 0
  },
  totalCreditsEarned: {
    type: Number,
    min: 0,
    default: 0
  },
  academicStandingLastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Student ID Card Fields
  photoUrl: {
    type: String // File path for uploaded photo
  },
  idCardIssuedAt: {
    type: Date
  },
  idCardStatus: {
    type: String,
    enum: ['Active', 'Inactive', 'Not Generated'],
    default: 'Not Generated'
  },
  
  // Graduation Fields
  isGraduated: {
    type: Boolean,
    default: false
  },
  graduationDate: {
    type: Date
  },
  clearanceStatus: {
    type: String,
    enum: ['Pending', 'Cleared', 'Blocked'],
    default: 'Pending'
  },
  clearanceItems: [{
    itemType: {
      type: String,
      enum: ['Library', 'Laboratory', 'Dormitory', 'Other'],
      required: true
    },
    itemName: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Cleared', 'Blocked'],
      default: 'Pending'
    },
    notes: String,
    clearedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    clearedAt: Date
  }],
  finalProjectStatus: {
    type: String,
    enum: ['Not Submitted', 'Pending', 'Approved', 'Rejected'],
    default: 'Not Submitted'
  },
  finalProject: {
    title: String,
    description: String,
    filePath: String,
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    submittedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String,
    comments: String
  },
  internshipStatus: {
    type: String,
    enum: ['N/A', 'Not Submitted', 'Pending', 'Approved', 'Rejected'],
    default: 'N/A'
  },
  internship: {
    company: String,
    position: String,
    startDate: Date,
    endDate: Date,
    supervisorName: String,
    supervisorContact: String,
    documentPath: String,
    submittedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String,
    comments: String
  },
  graduationApproval: {
    isApproved: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    comments: String
  },
  graduationChecklist: {
    creditsCompleted: {
      type: Boolean,
      default: false
    },
    cgpaRequirementMet: {
      type: Boolean,
      default: false
    },
    requiredCoursesPassed: {
      type: Boolean,
      default: false
    },
    finalProjectApproved: {
      type: Boolean,
      default: false
    },
    internshipApproved: {
      type: Boolean,
      default: false
    },
    clearanceApproved: {
      type: Boolean,
      default: false
    }
  },
  officialTranscriptPath: String,
  transcriptGeneratedAt: Date
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash password with salt rounds of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to generate student ID if not provided
userSchema.pre('save', async function(next) {
  if (this.isNew && this.role === 'student' && !this.studentId) {
    try {
      // Generate student ID based on enrollment year
      const year = this.enrollmentYear || new Date().getFullYear();
      
      // Count existing students for this year to get the next number
      const studentCount = await this.constructor.countDocuments({
        role: 'student',
        studentId: { $regex: `^ATTC-${year}-` }
      });
      
      // Format: ATTC-YEAR-XXXXX (padded to 5 digits)
      this.studentId = `ATTC-${year}-${String(studentCount + 1).padStart(5, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Static method to generate institutional email with collision handling
userSchema.statics.generateInstitutionalEmail = async function(firstName, fatherName) {
  const cleanFirstName = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanFatherName = fatherName.toLowerCase().replace(/[^a-z]/g, '');
  
  if (!cleanFirstName || !cleanFatherName) {
    throw new Error('Invalid name format for email generation');
  }

  // Base email format: first letter of firstName (lowercase) + first letter of fatherName (uppercase)
  const baseEmail = `${cleanFirstName.charAt(0)}${cleanFatherName.charAt(0).toUpperCase()}@attc.edu.et`;
  
  // Check if base email exists
  const existingUser = await this.findOne({ email: baseEmail });
  
  if (!existingUser) {
    return baseEmail;
  }

  // Handle collision by appending numbers
  let counter = 1;
  let emailWithNumber;
  
  do {
    emailWithNumber = `${cleanFirstName.charAt(0)}${cleanFatherName.charAt(0).toUpperCase()}${counter}@attc.edu.et`;
    const userWithEmail = await this.findOne({ email: emailWithNumber });
    
    if (!userWithEmail) {
      return emailWithNumber;
    }
    
    counter++;
  } while (counter < 1000); // Prevent infinite loop
  
  throw new Error('Unable to generate unique email after 1000 attempts');
};

// Static method to generate temporary password
userSchema.statics.generateTempPassword = function() {
  // Generate 8-character temporary password: 4 letters + 4 numbers
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  
  let tempPassword = '';
  
  // Add 4 random letters
  for (let i = 0; i < 4; i++) {
    tempPassword += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  // Add 4 random numbers
  for (let i = 0; i < 4; i++) {
    tempPassword += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return tempPassword;
};

// Instance method to get academic standing summary
userSchema.methods.getAcademicStanding = function() {
  return {
    cgpa: this.lastCGPA,
    totalCreditsEarned: this.totalCreditsEarned,
    probation: this.probation,
    dismissed: this.dismissed,
    status: this.status,
    lastUpdated: this.academicStandingLastUpdated
  };
};

// Instance method to update academic standing
userSchema.methods.updateAcademicStanding = function(cgpa, totalCredits) {
  this.lastCGPA = cgpa;
  this.totalCreditsEarned = totalCredits;
  
  // Determine academic standing
  if (cgpa < 1.0 && totalCredits >= 9) { // At least 3 courses completed
    this.dismissed = true;
    this.probation = false;
    this.status = 'suspended';
  } else if (cgpa < 2.0 && totalCredits >= 9) {
    this.probation = true;
    this.dismissed = false;
    if (this.status === 'suspended') {
      this.status = 'active'; // Reinstate if improved
    }
  } else {
    this.probation = false;
    this.dismissed = false;
    if (this.status === 'suspended') {
      this.status = 'active'; // Reinstate if improved
    }
  }
  
  this.academicStandingLastUpdated = new Date();
  return this.save();
};

// Method to check if student is eligible for graduation
userSchema.methods.checkGraduationEligibility = async function() {
  try {
    const Grade = mongoose.model('Grade');
    const Course = mongoose.model('Course');
    
    // Get department requirements
    const departmentRequirements = getDepartmentRequirements(this.department);
    
    // 1. Check total credits earned
    const creditsCompleted = this.totalCreditsEarned >= departmentRequirements.requiredCredits;
    
    // 2. Check CGPA requirement
    const cgpaRequirementMet = this.lastCGPA >= 2.0;
    
    // 3. Check if all required courses are passed
    const requiredCoursesPassed = await checkRequiredCourses(this._id, departmentRequirements.requiredCourses);
    
    // 4. Check final project status
    const finalProjectApproved = this.finalProjectStatus === 'Approved';
    
    // 5. Check internship status (if required)
    const internshipApproved = departmentRequirements.internshipRequired ? 
      this.internshipStatus === 'Approved' : true;
    
    // 6. Check clearance status
    const clearanceApproved = this.clearanceStatus === 'Cleared';
    
    // Update graduation checklist
    this.graduationChecklist = {
      creditsCompleted,
      cgpaRequirementMet,
      requiredCoursesPassed,
      finalProjectApproved,
      internshipApproved,
      clearanceApproved
    };
    
    await this.save();
    
    // Check if all requirements are met
    const isEligible = creditsCompleted && 
                      cgpaRequirementMet && 
                      requiredCoursesPassed && 
                      finalProjectApproved && 
                      internshipApproved && 
                      clearanceApproved;
    
    return {
      isEligible,
      checklist: this.graduationChecklist,
      details: {
        totalCredits: this.totalCreditsEarned,
        requiredCredits: departmentRequirements.requiredCredits,
        cgpa: this.lastCGPA,
        finalProjectStatus: this.finalProjectStatus,
        internshipStatus: this.internshipStatus,
        clearanceStatus: this.clearanceStatus
      }
    };
  } catch (error) {
    console.error('Error checking graduation eligibility:', error);
    throw error;
  }
};

// Method to mark student as graduated
userSchema.methods.markAsGraduated = async function(approvedBy, comments) {
  this.isGraduated = true;
  this.graduationDate = new Date();
  this.status = 'graduated';
  this.graduationApproval = {
    isApproved: true,
    approvedBy,
    approvedAt: new Date(),
    comments: comments || 'Graduation approved'
  };
  
  return this.save();
};

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ studentId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ department: 1, currentYear: 1, currentSemester: 1 });
userSchema.index({ probation: 1 });
userSchema.index({ dismissed: 1 });
userSchema.index({ status: 1 });
userSchema.index({ isGraduated: 1 });
userSchema.index({ clearanceStatus: 1 });
userSchema.index({ finalProjectStatus: 1 });
userSchema.index({ internshipStatus: 1 });
userSchema.index({ idCardStatus: 1 });

// Helper function to get department-specific graduation requirements
function getDepartmentRequirements(department) {
  const requirements = {
    'Electrical': {
      requiredCredits: 180,
      requiredCourses: ['ELE 4001', 'ELE 4002', 'ELE 3005'],
      internshipRequired: true
    },
    'Manufacturing': {
      requiredCredits: 175,
      requiredCourses: ['MAN 4001', 'MAN 4002', 'MAN 3005'],
      internshipRequired: true
    },
    'Automotive': {
      requiredCredits: 178,
      requiredCourses: ['AUTO 4001', 'AUTO 4002', 'AUTO 3005'],
      internshipRequired: true
    },
    'Construction': {
      requiredCredits: 182,
      requiredCourses: ['CONS 4001', 'CONS 4002', 'CONS 3005'],
      internshipRequired: true
    },
    'ICT': {
      requiredCredits: 170,
      requiredCourses: ['ICT 4001', 'ICT 4002', 'ICT 3005'],
      internshipRequired: true
    }
  };
  
  return requirements[department] || {
    requiredCredits: 180,
    requiredCourses: [],
    internshipRequired: false
  };
}

// Helper function to check if student has passed all required courses
async function checkRequiredCourses(studentId, requiredCourses) {
  if (!requiredCourses || requiredCourses.length === 0) {
    return true;
  }
  
  const Grade = mongoose.model('Grade');
  
  // Get all passed courses for the student
  const passedGrades = await Grade.find({
    studentId,
    status: { $in: ['finalized', 'locked'] },
    letterGrade: { $nin: ['F', 'NG', 'W', 'I'] }
  }).populate('courseId', 'courseCode');
  
  const passedCourseCodes = passedGrades.map(grade => grade.courseId.courseCode);
  
  // Check if all required courses are in the passed courses list
  return requiredCourses.every(courseCode => passedCourseCodes.includes(courseCode));
}

const User = mongoose.model('User', userSchema);

export default User;