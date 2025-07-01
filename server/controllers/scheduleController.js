import ClassSchedule from '../models/ClassSchedule.model.js';
import Course from '../models/Course.model.js';
import User from '../models/User.model.js';
import AuditLog from '../models/AuditLog.model.js';

// @desc    Create a new class schedule
// @route   POST /api/schedule/create
// @access  Private (Department Head, Registrar)
export const createSchedule = async (req, res) => {
  try {
    const {
      courseId,
      instructorId,
      academicYear,
      semester,
      department,
      dayOfWeek,
      startTime,
      endTime,
      roomNumber,
      notes
    } = req.body;

    // Validation
    if (!courseId || !instructorId || !academicYear || !semester || !department ||
      !dayOfWeek || !startTime || !endTime || !roomNumber) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Validate instructor exists and has instructor role
    const instructor = await User.findById(instructorId);
    if (!instructor || instructor.role !== 'instructor') {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found or user is not an instructor'
      });
    }

    // Create schedule data
    const scheduleData = {
      courseId,
      instructorId,
      academicYear,
      semester,
      department,
      dayOfWeek,
      startTime,
      endTime,
      roomNumber,
      notes: notes || '',
      createdBy: req.user.id
    };

    // Check for conflicts
    const conflicts = await ClassSchedule.checkConflicts(scheduleData);

    if (conflicts.hasConflicts) {
      return res.status(409).json({
        success: false,
        message: 'Scheduling conflict detected',
        data: {
          instructorConflicts: conflicts.instructorConflicts.length > 0,
          roomConflicts: conflicts.roomConflicts.length > 0,
          details: {
            instructorConflicts: conflicts.instructorConflicts.map(c => ({
              id: c._id,
              course: c.courseId,
              day: c.dayOfWeek,
              time: `${c.startTime} - ${c.endTime}`
            })),
            roomConflicts: conflicts.roomConflicts.map(c => ({
              id: c._id,
              course: c.courseId,
              day: c.dayOfWeek,
              time: `${c.startTime} - ${c.endTime}`
            }))
          }
        }
      });
    }

    // Create new schedule
    const schedule = new ClassSchedule(scheduleData);

    // Validate time slot
    if (!schedule.isValidTimeSlot()) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }

    await schedule.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'SCHEDULE_CREATED',
      targetId: schedule._id,
      targetModel: 'ClassSchedule',
      targetName: `${course.courseCode} - ${dayOfWeek} ${startTime}-${endTime}`,
      category: 'data_modification',
      severity: 'low',
      details: {
        courseCode: course.courseCode,
        instructor: `${instructor.firstName} ${instructor.fatherName}`,
        dayOfWeek,
        timeSlot: `${startTime}-${endTime}`,
        roomNumber
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`📅 Class schedule created: ${course.courseCode} on ${dayOfWeek} at ${startTime}-${endTime} in Room ${roomNumber}`);
    console.log(`   👤 Instructor: ${instructor.firstName} ${instructor.fatherName}`);
    console.log(`   📊 Created by: ${req.user.firstName} ${req.user.fatherName} (${req.user.role})`);

    res.status(201).json({
      success: true,
      message: 'Class schedule created successfully',
      data: {
        schedule: {
          _id: schedule._id,
          courseCode: course.courseCode,
          courseName: course.courseName,
          instructor: `${instructor.firstName} ${instructor.fatherName}`,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          roomNumber: schedule.roomNumber,
          academicYear: schedule.academicYear,
          semester: schedule.semester,
          department: schedule.department
        }
      }
    });

  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create class schedule',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get student's class schedule
// @route   GET /api/schedule/student
// @access  Private (Student only)
export const getStudentSchedule = async (req, res) => {
  try {
    const { academicYear, semester } = req.query;

    // Default to current academic year and semester if not provided
    const currentYear = new Date().getFullYear();
    const currentAcademicYear = academicYear || `${currentYear}-${currentYear + 1}`;
    const currentSemester = semester || (new Date().getMonth() < 6 ? 1 : 2); // Assuming semester 1 is Jan-Jun, semester 2 is Jul-Dec

    // Get student's schedule
    const schedule = await ClassSchedule.getStudentSchedule(
      req.user.id,
      currentAcademicYear,
      currentSemester
    );

    // Group by day of week for easier frontend rendering
    const scheduleByDay = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: []
    };

    schedule.forEach(slot => {
      scheduleByDay[slot.dayOfWeek].push({
        _id: slot._id,
        courseCode: slot.courseId.courseCode,
        courseName: slot.courseId.courseName,
        instructor: `${slot.instructorId.firstName} ${slot.instructorId.fatherName}`,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber,
        duration: slot.durationMinutes
      });
    });

    res.status(200).json({
      success: true,
      message: 'Student schedule retrieved successfully',
      data: {
        scheduleByDay,
        academicYear: currentAcademicYear,
        semester: currentSemester,
        totalCourses: schedule.length
      }
    });

  } catch (error) {
    console.error('Get student schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student schedule',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get instructor's teaching schedule
// @route   GET /api/schedule/instructor
// @access  Private (Instructor only)
export const getInstructorSchedule = async (req, res) => {
  try {
    const { academicYear, semester } = req.query;

    // Default to current academic year and semester if not provided
    const currentYear = new Date().getFullYear();
    const currentAcademicYear = academicYear || `${currentYear}-${currentYear + 1}`;
    const currentSemester = semester || (new Date().getMonth() < 6 ? 1 : 2);

    // Get instructor's schedule
    const schedule = await ClassSchedule.find({
      instructorId: req.user.id,
      academicYear: currentAcademicYear,
      semester: currentSemester,
      isActive: true
    })
      .populate('courseId', 'courseCode courseName credit department')
      .sort({ dayOfWeek: 1, startTime: 1 });

    // Group by day of week
    const scheduleByDay = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: []
    };

    schedule.forEach(slot => {
      scheduleByDay[slot.dayOfWeek].push({
        _id: slot._id,
        courseCode: slot.courseId.courseCode,
        courseName: slot.courseId.courseName,
        department: slot.courseId.department,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber,
        duration: slot.durationMinutes
      });
    });

    // Get total teaching hours per week
    const totalHours = schedule.reduce((sum, slot) => {
      return sum + (slot.durationMinutes / 60);
    }, 0);

    res.status(200).json({
      success: true,
      message: 'Instructor schedule retrieved successfully',
      data: {
        scheduleByDay,
        academicYear: currentAcademicYear,
        semester: currentSemester,
        totalCourses: schedule.length,
        totalHoursPerWeek: Math.round(totalHours * 10) / 10
      }
    });

  } catch (error) {
    console.error('Get instructor schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve instructor schedule',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get all schedules for department management
// @route   GET /api/schedule/department
// @access  Private (Department Head, Registrar)
export const getDepartmentSchedules = async (req, res) => {
  try {
    const { department, academicYear, semester } = req.query;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department parameter is required'
      });
    }

    // Default to current academic year and semester if not provided
    const currentYear = new Date().getFullYear();
    const currentAcademicYear = academicYear || `${currentYear}-${currentYear + 1}`;
    const currentSemester = semester ? parseInt(semester) : (new Date().getMonth() < 6 ? 1 : 2);

    // Get department schedules
    const schedules = await ClassSchedule.find({
      department,
      academicYear: currentAcademicYear,
      semester: currentSemester,
      isActive: true
    })
      .populate('courseId', 'courseCode courseName credit year')
      .populate('instructorId', 'firstName fatherName email')
      .populate('createdBy', 'firstName fatherName')
      .sort({ dayOfWeek: 1, startTime: 1 });

    // Get unique rooms and instructors for filtering
    const uniqueRooms = [...new Set(schedules.map(s => s.roomNumber))];
    const uniqueInstructors = [...new Set(schedules.map(s => s.instructorId._id.toString()))];
    const instructorDetails = schedules.reduce((acc, s) => {
      const id = s.instructorId._id.toString();
      if (!acc[id]) {
        acc[id] = {
          _id: id,
          name: `${s.instructorId.firstName} ${s.instructorId.fatherName}`,
          email: s.instructorId.email
        };
      }
      return acc;
    }, {});

    // Group by day of week
    const scheduleByDay = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: []
    };

    schedules.forEach(slot => {
      scheduleByDay[slot.dayOfWeek].push({
        _id: slot._id,
        courseCode: slot.courseId.courseCode,
        courseName: slot.courseId.courseName,
        year: slot.courseId.year,
        instructor: {
          _id: slot.instructorId._id,
          name: `${slot.instructorId.firstName} ${slot.instructorId.fatherName}`,
          email: slot.instructorId.email
        },
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber,
        createdBy: `${slot.createdBy.firstName} ${slot.createdBy.fatherName}`,
        createdAt: slot.createdAt
      });
    });

    res.status(200).json({
      success: true,
      message: 'Department schedules retrieved successfully',
      data: {
        scheduleByDay,
        academicYear: currentAcademicYear,
        semester: currentSemester,
        department,
        totalSchedules: schedules.length,
        filters: {
          rooms: uniqueRooms,
          instructors: Object.values(instructorDetails)
        }
      }
    });

  } catch (error) {
    console.error('Get department schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department schedules',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Update a class schedule
// @route   PUT /api/schedule/:scheduleId
// @access  Private (Department Head, Registrar)
export const updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const {
      instructorId,
      dayOfWeek,
      startTime,
      endTime,
      roomNumber,
      notes,
      isActive
    } = req.body;

    // Find the schedule
    const schedule = await ClassSchedule.findById(scheduleId)
      .populate('courseId', 'courseCode courseName')
      .populate('instructorId', 'firstName fatherName');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Prepare update data
    const updateData = {};
    if (instructorId) updateData.instructorId = instructorId;
    if (dayOfWeek) updateData.dayOfWeek = dayOfWeek;
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (roomNumber) updateData.roomNumber = roomNumber;
    if (notes !== undefined) updateData.notes = notes;
    if (isActive !== undefined) updateData.isActive = isActive;

    // If time or room or instructor is changing, check for conflicts
    if (instructorId || dayOfWeek || startTime || endTime || roomNumber) {
      const scheduleData = {
        ...schedule.toObject(),
        ...updateData
      };

      const conflicts = await ClassSchedule.checkConflicts(scheduleData, scheduleId);

      if (conflicts.hasConflicts) {
        return res.status(409).json({
          success: false,
          message: 'Scheduling conflict detected',
          data: {
            instructorConflicts: conflicts.instructorConflicts.length > 0,
            roomConflicts: conflicts.roomConflicts.length > 0,
            details: {
              instructorConflicts: conflicts.instructorConflicts.map(c => ({
                id: c._id,
                course: c.courseId,
                day: c.dayOfWeek,
                time: `${c.startTime} - ${c.endTime}`
              })),
              roomConflicts: conflicts.roomConflicts.map(c => ({
                id: c._id,
                course: c.courseId,
                day: c.dayOfWeek,
                time: `${c.startTime} - ${c.endTime}`
              }))
            }
          }
        });
      }
    }

    // Update schedule
    const updatedSchedule = await ClassSchedule.findByIdAndUpdate(
      scheduleId,
      updateData,
      { new: true }
    )
      .populate('courseId', 'courseCode courseName')
      .populate('instructorId', 'firstName fatherName');

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'SCHEDULE_UPDATED',
      targetId: schedule._id,
      targetModel: 'ClassSchedule',
      targetName: `${schedule.courseId.courseCode} - ${schedule.dayOfWeek} ${schedule.startTime}-${schedule.endTime}`,
      category: 'data_modification',
      severity: 'low',
      details: {
        before: {
          instructorId: schedule.instructorId._id,
          instructor: `${schedule.instructorId.firstName} ${schedule.instructorId.fatherName}`,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          roomNumber: schedule.roomNumber,
          isActive: schedule.isActive
        },
        after: {
          instructorId: updatedSchedule.instructorId._id,
          instructor: `${updatedSchedule.instructorId.firstName} ${updatedSchedule.instructorId.fatherName}`,
          dayOfWeek: updatedSchedule.dayOfWeek,
          startTime: updatedSchedule.startTime,
          endTime: updatedSchedule.endTime,
          roomNumber: updatedSchedule.roomNumber,
          isActive: updatedSchedule.isActive
        }
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`📅 Class schedule updated: ${updatedSchedule.courseId.courseCode} on ${updatedSchedule.dayOfWeek} at ${updatedSchedule.startTime}-${updatedSchedule.endTime}`);

    res.status(200).json({
      success: true,
      message: 'Class schedule updated successfully',
      data: {
        schedule: updatedSchedule
      }
    });

  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update class schedule',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Delete a class schedule
// @route   DELETE /api/schedule/:scheduleId
// @access  Private (Department Head, Registrar)
export const deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    // Find the schedule
    const schedule = await ClassSchedule.findById(scheduleId)
      .populate('courseId', 'courseCode courseName')
      .populate('instructorId', 'firstName fatherName');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check if attendance records exist for this schedule
    const Attendance = mongoose.model('Attendance');
    const attendanceCount = await Attendance.countDocuments({ classScheduleId: scheduleId });

    if (attendanceCount > 0) {
      // Instead of deleting, mark as inactive
      schedule.isActive = false;
      await schedule.save();

      console.log(`📅 Class schedule deactivated (has attendance records): ${schedule.courseId.courseCode} on ${schedule.dayOfWeek} at ${schedule.startTime}-${schedule.endTime}`);

      return res.status(200).json({
        success: true,
        message: 'Class schedule deactivated (attendance records exist)',
        data: {
          deactivated: true,
          attendanceCount
        }
      });
    }

    // Delete the schedule
    await ClassSchedule.findByIdAndDelete(scheduleId);

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'SCHEDULE_DELETED',
      targetId: schedule._id,
      targetModel: 'ClassSchedule',
      targetName: `${schedule.courseId.courseCode} - ${schedule.dayOfWeek} ${schedule.startTime}-${schedule.endTime}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        courseCode: schedule.courseId.courseCode,
        instructor: `${schedule.instructorId.firstName} ${schedule.instructorId.fatherName}`,
        dayOfWeek: schedule.dayOfWeek,
        timeSlot: `${schedule.startTime}-${schedule.endTime}`,
        roomNumber: schedule.roomNumber
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`🗑️ Class schedule deleted: ${schedule.courseId.courseCode} on ${schedule.dayOfWeek} at ${schedule.startTime}-${schedule.endTime}`);

    res.status(200).json({
      success: true,
      message: 'Class schedule deleted successfully'
    });

  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete class schedule',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get available instructors for scheduling
// @route   GET /api/schedule/available-instructors
// @access  Private (Department Head, Registrar)
export const getAvailableInstructors = async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, academicYear, semester, department } = req.query;

    if (!dayOfWeek || !startTime || !endTime || !academicYear || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Day, time slot, academic year, and semester are required'
      });
    }

    // Get all instructors
    const instructors = await User.find({
      role: 'instructor',
      status: 'active'
    })
      .select('_id firstName fatherName email department')
      .sort({ firstName: 1, fatherName: 1 });

    // Filter by department if specified
    const departmentInstructors = department
      ? instructors.filter(i => !i.department || i.department === department)
      : instructors;

    // Find busy instructors at the specified time
    const busyInstructorIds = await ClassSchedule.find({
      dayOfWeek,
      academicYear,
      semester,
      isActive: true,
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
    })
      .distinct('instructorId');

    // Filter out busy instructors
    const availableInstructors = departmentInstructors.filter(
      instructor => !busyInstructorIds.some(id => id.equals(instructor._id))
    );

    res.status(200).json({
      success: true,
      message: 'Available instructors retrieved successfully',
      data: {
        availableInstructors,
        totalAvailable: availableInstructors.length,
        totalInstructors: departmentInstructors.length,
        busyInstructors: departmentInstructors.length - availableInstructors.length
      }
    });

  } catch (error) {
    console.error('Get available instructors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available instructors',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get available rooms for scheduling
// @route   GET /api/schedule/available-rooms
// @access  Private (Department Head, Registrar)
export const getAvailableRooms = async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, academicYear, semester } = req.query;

    if (!dayOfWeek || !startTime || !endTime || !academicYear || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Day, time slot, academic year, and semester are required'
      });
    }

    // Get all rooms that are in use at the specified time
    const busyRooms = await ClassSchedule.find({
      dayOfWeek,
      academicYear,
      semester,
      isActive: true,
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
    })
      .distinct('roomNumber');

    // Get all rooms in the system
    const allRooms = await ClassSchedule.distinct('roomNumber');

    // Filter out busy rooms
    const availableRooms = allRooms.filter(room => !busyRooms.includes(room));

    res.status(200).json({
      success: true,
      message: 'Available rooms retrieved successfully',
      data: {
        availableRooms,
        totalAvailable: availableRooms.length,
        totalRooms: allRooms.length,
        busyRooms
      }
    });

  } catch (error) {
    console.error('Get available rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available rooms',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get schedule for a specific course
// @route   GET /api/schedule/course/:courseId
// @access  Private (All roles)
export const getCourseSchedule = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { academicYear, semester } = req.query;

    // Default to current academic year and semester if not provided
    const currentYear = new Date().getFullYear();
    const currentAcademicYear = academicYear || `${currentYear}-${currentYear + 1}`;
    const currentSemester = semester ? parseInt(semester) : (new Date().getMonth() < 6 ? 1 : 2);

    // Get course schedule
    const schedule = await ClassSchedule.find({
      courseId,
      academicYear: currentAcademicYear,
      semester: currentSemester,
      isActive: true
    })
      .populate('instructorId', 'firstName fatherName email')
      .sort({ dayOfWeek: 1, startTime: 1 });

    if (schedule.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No schedule found for this course'
      });
    }

    // Get course details
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Course schedule retrieved successfully',
      data: {
        course: {
          _id: course._id,
          courseCode: course.courseCode,
          courseName: course.courseName,
          credit: course.credit,
          department: course.department,
          year: course.year,
          semester: course.semester
        },
        schedule: schedule.map(slot => ({
          _id: slot._id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomNumber: slot.roomNumber,
          instructor: {
            _id: slot.instructorId._id,
            name: `${slot.instructorId.firstName} ${slot.instructorId.fatherName}`,
            email: slot.instructorId.email
          }
        })),
        academicYear: currentAcademicYear,
        semester: currentSemester
      }
    });

  } catch (error) {
    console.error('Get course schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve course schedule',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get schedule statistics
// @route   GET /api/schedule/stats
// @access  Private (Department Head, Registrar)
export const getScheduleStats = async (req, res) => {
  try {
    const { academicYear, semester, department } = req.query;

    // Default to current academic year and semester if not provided
    const currentYear = new Date().getFullYear();
    const currentAcademicYear = academicYear || `${currentYear}-${currentYear + 1}`;
    const currentSemester = semester ? parseInt(semester) : (new Date().getMonth() < 6 ? 1 : 2);

    // Build query
    const query = {
      academicYear: currentAcademicYear,
      semester: currentSemester,
      isActive: true
    };

    if (department) {
      query.department = department;
    }

    // Get schedule statistics
    const stats = await ClassSchedule.aggregate([
      { $match: query },
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
        $lookup: {
          from: 'users',
          localField: 'instructorId',
          foreignField: '_id',
          as: 'instructor'
        }
      },
      { $unwind: '$instructor' },
      {
        $group: {
          _id: {
            department: '$department',
            dayOfWeek: '$dayOfWeek'
          },
          count: { $sum: 1 },
          courses: { $addToSet: '$course.courseCode' },
          instructors: { $addToSet: '$instructor._id' },
          rooms: { $addToSet: '$roomNumber' }
        }
      },
      {
        $group: {
          _id: '$_id.department',
          dayStats: {
            $push: {
              day: '$_id.dayOfWeek',
              count: '$count',
              courseCount: { $size: '$courses' },
              instructorCount: { $size: '$instructors' },
              roomCount: { $size: '$rooms' }
            }
          },
          totalClasses: { $sum: '$count' },
          uniqueCourses: { $addToSet: '$courses' },
          uniqueInstructors: { $addToSet: '$instructors' },
          uniqueRooms: { $addToSet: '$rooms' }
        }
      },
      {
        $project: {
          _id: 0,
          department: '$_id',
          dayStats: 1,
          totalClasses: 1,
          uniqueCourses: { $size: { $reduce: { input: '$uniqueCourses', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } } },
          uniqueInstructors: { $size: { $reduce: { input: '$uniqueInstructors', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } } },
          uniqueRooms: { $size: { $reduce: { input: '$uniqueRooms', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } } }
        }
      },
      { $sort: { department: 1 } }
    ]);

    // Get room utilization
    const roomUtilization = await ClassSchedule.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$roomNumber',
          count: { $sum: 1 },
          days: { $addToSet: '$dayOfWeek' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get instructor load
    const instructorLoad = await ClassSchedule.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'instructorId',
          foreignField: '_id',
          as: 'instructor'
        }
      },
      { $unwind: '$instructor' },
      {
        $group: {
          _id: '$instructorId',
          instructorName: { $first: { $concat: ['$instructor.firstName', ' ', '$instructor.fatherName'] } },
          department: { $first: '$instructor.department' },
          count: { $sum: 1 },
          days: { $addToSet: '$dayOfWeek' },
          courses: { $addToSet: '$courseId' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      message: 'Schedule statistics retrieved successfully',
      data: {
        departmentStats: stats,
        roomUtilization,
        instructorLoad,
        academicYear: currentAcademicYear,
        semester: currentSemester,
        filters: {
          department: department || 'All'
        }
      }
    });

  } catch (error) {
    console.error('Get schedule stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve schedule statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};