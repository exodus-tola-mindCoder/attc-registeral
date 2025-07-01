/* eslint-disable @typescript-eslint/no-explicit-any */
export interface User {
  id: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  email: string;
  role: string;
  department?: string;
  currentYear?: number;
  currentSemester?: number;
  studentId?: string;
  enrollmentYear?: number;
  probation?: boolean;
  dismissed?: boolean;
  status?: string;
  lastCGPA?: number;
  totalCreditsEarned?: number;
  photoUrl?: string;
  idCardStatus?: string;
  idCardIssuedAt?: string;
  isGraduated?: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
    mustChangePassword?: boolean;
    email?: string;
    expiresAt?: string;
  };
}

export interface ImportResult {
  success: boolean;
  message: string;
  data?: {
    summary: {
      totalRows: number;
      processed: number;
      imported: number;
      duplicates: number;
      errorCount: number;
    };
    errors: string[];
    tempPasswords?: Array<{
      studentId: string;
      tempPassword: string;
    }>;
    note?: string;
  };
}

export interface Course {
  _id: string;
  courseCode: string;
  courseName: string;
  credit: number;
  department: string;
  year: number;
  semester: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  prerequisites?: string[];
  canRegister?: boolean;
  prerequisiteMessage?: string;
  missingPrerequisites?: string[];
  isRepeat?: boolean;
  previousGrade?: string;
}

export interface Registration {
  _id: string;
  studentId: string;
  department: string;
  year: number;
  semester: number;
  courses: Course[];
  totalCredits: number;
  registrationDate: string;
  status: string;
  registrationSlipPath?: string;
  isRepeatSemester?: boolean;
  repeatCourseCount?: number;
}

export interface Grade {
  _id: string;
  studentId?: {
    _id: string;
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    studentId: string;
  };
  courseId?: {
    _id: string;
    courseCode: string;
    courseName: string;
    credit: number;
  };
  instructorId?: {
    _id: string;
    firstName: string;
    fatherName: string;
  };
  academicYear: string;
  semester: number;
  year: number;
  department: string;
  midtermMark: number;
  continuousMark: number;
  finalExamMark: number;
  totalMark: number;
  letterGrade: string;
  gradePoints: number;
  status: string;
  submittedAt?: string;
  approvedAt?: string;
  finalizedAt?: string;
  instructorComments?: string;
  deptHeadComments?: string;
  registrarComments?: string;
  rejectionReason?: string;
  probation?: boolean;
  dismissed?: boolean;
  repeatRequired?: boolean;
}

export interface StudentGrade {
  _id: string;
  courseId?: {
    courseCode: string;
    courseName: string;
    credit: number;
  };
  academicYear: string;
  semester: number;
  totalMark: number;
  letterGrade: string;
  gradePoints: number;
  status: string;
}

export interface GradeSubmission {
  studentId: string;
  courseId: string;
  registrationId: string;
  midtermMark: number;
  continuousMark: number;
  finalExamMark: number;
  instructorComments: string;
}

export interface AcademicStanding {
  cgpa: number;
  totalCredits: number;
  courseCount: number;
  probation: boolean;
  dismissed: boolean;
  status: string;
}

export interface PlacementRequest {
  _id: string;
  studentId?: {
    _id: string;
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    studentId: string;
    email: string;
  };
  firstChoice: string;
  secondChoice?: string;
  personalStatement: string;
  reasonForChoice: string;
  careerGoals?: string;
  currentCGPA: number;
  totalCredits: number;
  status: string;
  approvedDepartment?: string;
  committeeComments?: string;
  rejectionReason?: string;
  submittedAt: string;
  priorityScore: number;
}

export interface DepartmentCapacity {
  department: string;
  capacity: number;
  approved: number;
  available: number;
  isFull: boolean;
}

export interface PlacementStats {
  departmentStats: Array<{
    _id: string;
    statusBreakdown: Array<{
      status: string;
      count: number;
      averageCGPA: number;
      averagePriorityScore: number;
    }>;
    totalRequests: number;
  }>;
  departmentCapacities: DepartmentCapacity[];
  overallStats: Array<{
    _id: string;
    count: number;
    averageCGPA: number;
    averagePriorityScore: number;
  }>;
  placementTimeline: Array<{
    _id: string;
    submissions: number;
  }>;
  academicYear: string;
}

export interface Evaluation {
  _id: string;
  studentId: string;
  instructorId: string;
  courseId: string;
  registrationId: string;
  academicYear: string;
  semester: number;
  year: number;
  department: string;
  ratings: Array<{
    questionId: string;
    question: string;
    score: number;
  }>;
  overallRating: number;
  comments?: string;
  submittedAt: string;
  status: string;
  anonymousHash: string;
}

export interface EvaluationQuestion {
  id: string;
  question: string;
  category: string;
}

export interface EvaluationRequirement {
  gradeId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  department: string;
  instructorId: string;
  instructorName: string;
  isEvaluated: boolean;
  evaluationId?: string;
  submittedAt?: string;
  overallRating?: number;
}

export interface EvaluationStatus {
  hasCompleted: boolean;
  totalRequired: number;
  completed: number;
  missing: number;
  missingCourses?: string[];
}

export interface InstructorEvaluationSummary {
  totalEvaluations: number;
  averageOverallRating: number;
  questionAverages: { [questionId: string]: number };
  ratingDistribution: { [rating: number]: number };
}

export interface TestResult {
  endpoint: string;
  status: number;
  expectedStatus: number;
  success: boolean;
  data: any;
  timestamp: string;
}

export interface Attendance {
  _id: string;
  studentId: string;
  courseId: string;
  instructorId: string;
  date: string;
  status: 'present' | 'absent' | 'excused';
  notes?: string;
  updatedBy?: string;
  lastUpdated?: string;
}

export interface AttendanceStats {
  percentage: number;
  totalClasses: number;
  present: number;
  absent: number;
  excused: number;
}

export interface AttendanceEligibility {
  eligible: boolean;
  percentage: number;
  requiredPercentage: number;
  deficit: number;
  totalClasses: number;
  present: number;
  absent: number;
  excused: number;
}

export interface ClassSchedule {
  _id: string;
  courseId: string;
  instructorId: string;
  academicYear: string;
  semester: number;
  department: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomNumber: string;
  createdBy: string;
  isActive: boolean;
  notes?: string;
}

export interface Notification {
  _id: string;
  recipientId: string;
  title: string;
  message: string;
  type: 'System' | 'Deadline' | 'Warning' | 'Info';
  isRead: boolean;
  link?: string;
  sourceType?: string;
  createdAt: string;
  createdBy?: {
    _id: string;
    firstName: string;
    fatherName: string;
    role: string;
  };
  age?: string;
}

export interface StudentIDCard {
  studentId: string;
  idCardStatus: string;
  idCardIssuedAt: string | null;
  photoUrl: string | null;
  hasPhoto: boolean;
}

export interface RegistrationPeriod {
  _id: string;
  type: 'signup' | 'courseRegistration';
  academicYear: string;
  semester: number;
  department: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  notes?: string;
  createdBy?: {
    firstName: string;
    fatherName: string;
  };
  createdAt: string;
  updatedAt: string;
}