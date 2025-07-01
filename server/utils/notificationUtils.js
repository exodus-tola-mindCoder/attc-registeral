import Notification from '../models/Notification.model.js';

// Create a notification for a single user
export const createNotification = async (data) => {
  try {
    const notification = await Notification.create({
      recipientId: data.recipientId,
      title: data.title,
      message: data.message,
      type: data.type || 'Info',
      link: data.link,
      sourceType: data.sourceType || 'system',
      sourceId: data.sourceId,
      sourceModel: data.sourceModel,
      expiresAt: data.expiresAt,
      createdBy: data.createdBy
    });

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

// Create notifications for multiple users
export const createMultipleNotifications = async (recipients, data) => {
  try {
    if (!recipients || recipients.length === 0) {
      return 0;
    }

    const notifications = recipients.map(recipientId => ({
      recipientId,
      title: data.title,
      message: data.message,
      type: data.type || 'Info',
      link: data.link,
      sourceType: data.sourceType || 'system',
      sourceId: data.sourceId,
      sourceModel: data.sourceModel,
      expiresAt: data.expiresAt,
      createdBy: data.createdBy
    }));

    const result = await Notification.insertMany(notifications);
    return result.length;
  } catch (error) {
    console.error('Create multiple notifications error:', error);
    return 0;
  }
};

// Create a broadcast notification for all users or filtered by role
export const createBroadcast = async (data, roles = null) => {
  try {
    return await Notification.createBroadcast(data, roles);
  } catch (error) {
    console.error('Create broadcast error:', error);
    return 0;
  }
};

// Create a notification for a grade submission
export const notifyGradeSubmission = async (grade) => {
  try {
    // Notify department head
    const departmentHeads = await mongoose.model('User').find({
      role: 'departmentHead',
      department: grade.department,
      status: 'active'
    }).select('_id');

    if (departmentHeads.length > 0) {
      await createMultipleNotifications(
        departmentHeads.map(head => head._id),
        {
          title: 'Grade Submission Requires Approval',
          message: `Grades for ${grade.courseId.courseCode} have been submitted and require your approval.`,
          type: 'Deadline',
          link: '/grades/pending',
          sourceType: 'grade',
          sourceId: grade._id,
          sourceModel: 'Grade',
          createdBy: grade.instructorId
        }
      );
    }

    return true;
  } catch (error) {
    console.error('Notify grade submission error:', error);
    return false;
  }
};

// Create a notification for grade approval
export const notifyGradeApproval = async (grade) => {
  try {
    // Notify registrar
    const registrars = await mongoose.model('User').find({
      role: 'registrar',
      status: 'active'
    }).select('_id');

    if (registrars.length > 0) {
      await createMultipleNotifications(
        registrars.map(registrar => registrar._id),
        {
          title: 'Grade Approval Requires Finalization',
          message: `Grades for ${grade.courseId.courseCode} have been approved by the department head and require finalization.`,
          type: 'Deadline',
          link: '/grades/pending',
          sourceType: 'grade',
          sourceId: grade._id,
          sourceModel: 'Grade',
          createdBy: grade.approvedBy
        }
      );
    }

    return true;
  } catch (error) {
    console.error('Notify grade approval error:', error);
    return false;
  }
};

// Create a notification for grade finalization
export const notifyGradeFinalization = async (grade) => {
  try {
    // Notify student
    await createNotification({
      recipientId: grade.studentId,
      title: 'Final Grade Available',
      message: `Your final grade for ${grade.courseId.courseCode} is now available.`,
      type: 'Info',
      link: '/grades',
      sourceType: 'grade',
      sourceId: grade._id,
      sourceModel: 'Grade',
      createdBy: grade.finalizedBy
    });

    return true;
  } catch (error) {
    console.error('Notify grade finalization error:', error);
    return false;
  }
};

// Create a notification for academic standing warning
export const notifyAcademicStanding = async (student) => {
  try {
    let title, message, type;

    if (student.dismissed) {
      title = 'URGENT: Academic Dismissal Warning';
      message = 'Your CGPA is below 1.0. You are subject to academic dismissal. Please contact the Academic Affairs office immediately.';
      type = 'Warning';
    } else if (student.probation) {
      title = 'Academic Probation Warning';
      message = 'Your CGPA is below 2.0. You are on academic probation. Please meet with your academic advisor to develop an improvement plan.';
      type = 'Warning';
    } else {
      return true; // No notification needed
    }

    await createNotification({
      recipientId: student._id,
      title,
      message,
      type,
      link: '/grades/standing',
      sourceType: 'system',
      sourceModel: 'User',
      sourceId: student._id
    });

    return true;
  } catch (error) {
    console.error('Notify academic standing error:', error);
    return false;
  }
};

// Create a notification for placement decision
export const notifyPlacementDecision = async (placement) => {
  try {
    let title, message, type;

    if (placement.status === 'approved') {
      title = 'Department Placement Approved';
      message = `Congratulations! Your placement request has been approved for the ${placement.approvedDepartment} department.`;
      type = 'Info';
    } else if (placement.status === 'rejected') {
      title = 'Department Placement Rejected';
      message = `Your placement request has been rejected. Reason: ${placement.rejectionReason || 'No reason provided'}`;
      type = 'Warning';
    } else {
      return true; // No notification needed
    }

    await createNotification({
      recipientId: placement.studentId,
      title,
      message,
      type,
      link: '/placement/status',
      sourceType: 'placement',
      sourceId: placement._id,
      sourceModel: 'PlacementRequest',
      createdBy: placement.reviewedBy[0]?.memberId
    });

    return true;
  } catch (error) {
    console.error('Notify placement decision error:', error);
    return false;
  }
};

// Create a notification for attendance warning
export const notifyAttendanceWarning = async (student, course, attendanceData) => {
  try {
    if (attendanceData.percentage < 75) {
      await createNotification({
        recipientId: student._id,
        title: 'Low Attendance Warning',
        message: `Your attendance for ${course.courseCode} is ${attendanceData.percentage}%, which is below the required 75%. This may affect your eligibility for the final exam.`,
        type: 'Warning',
        link: '/attendance',
        sourceType: 'attendance',
        sourceId: course._id,
        sourceModel: 'Course'
      });
    }

    return true;
  } catch (error) {
    console.error('Notify attendance warning error:', error);
    return false;
  }
};

// Create a notification for registration opening
export const notifyRegistrationOpening = async (department, year, semester, academicYear) => {
  try {
    // Find all students in this department and year
    const students = await mongoose.model('User').find({
      role: 'student',
      department,
      currentYear: year,
      currentSemester: semester,
      status: 'active'
    }).select('_id');

    if (students.length > 0) {
      const registrationDeadline = new Date();
      registrationDeadline.setDate(registrationDeadline.getDate() + 14); // 2 weeks from now

      await createMultipleNotifications(
        students.map(student => student._id),
        {
          title: 'Course Registration Now Open',
          message: `Registration for ${department} - Year ${year}, Semester ${semester} (${academicYear}) is now open. Please register before ${registrationDeadline.toLocaleDateString()}.`,
          type: 'Deadline',
          link: '/registration',
          sourceType: 'registration',
          expiresAt: registrationDeadline
        }
      );
    }

    return true;
  } catch (error) {
    console.error('Notify registration opening error:', error);
    return false;
  }
};

// Create a notification for evaluation reminder
export const notifyEvaluationReminder = async (student, pendingEvaluations) => {
  try {
    if (pendingEvaluations > 0) {
      await createNotification({
        recipientId: student._id,
        title: 'Instructor Evaluation Reminder',
        message: `You have ${pendingEvaluations} pending instructor evaluations. Please complete them to be eligible for next semester registration.`,
        type: 'Deadline',
        link: '/evaluations',
        sourceType: 'evaluation'
      });
    }

    return true;
  } catch (error) {
    console.error('Notify evaluation reminder error:', error);
    return false;
  }
};

export default {
  createNotification,
  createMultipleNotifications,
  createBroadcast,
  notifyGradeSubmission,
  notifyGradeApproval,
  notifyGradeFinalization,
  notifyAcademicStanding,
  notifyPlacementDecision,
  notifyAttendanceWarning,
  notifyRegistrationOpening,
  notifyEvaluationReminder
};