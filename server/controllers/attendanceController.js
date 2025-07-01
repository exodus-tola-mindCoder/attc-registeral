import Attendance from '../models/Attendance.model.js';
import Course from '../models/Course.model.js';
import Registration from '../models/Registration.model.js';
import ClassSchedule from '../models/ClassSchedule.model.js';
import AuditLog from '../models/AuditLog.model.js';
import ExcelJS from 'exceljs';
import { createNotification } from '../utils/notificationUtils.js';

// @desc    Mark attendance for students in a course
// @route   POST /api/attendance/mark
// @access  Private (Instructor only)
export const markAttendance = async (req, res) => {
  try {
    const {
      courseId,
      date,
      attendanceRecords
    } = req.body;

    // Validation
    if (!courseId || !attendanceRecords || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({
        success: false,
        message: 'Course ID and attendance records array are required'
      });
    }

    // Validate date (default to today if not provided)
    const attendanceDate = date ? new Date(date) : new Date();

    // Check if date is valid
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Check if date is in the future
    if (attendanceDate > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark attendance for future dates'
      });
    }

    // Check if instructor is assigned to this course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get day of week for the attendance date
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = daysOfWeek[attendanceDate.getDay()];

    // Check if there's a valid class schedule for this course, instructor, and day
    const validSchedule = await ClassSchedule.findOne({
      courseId,
      instructorId: req.user.id,
      dayOfWeek,
      isActive: true
    });

    if (!validSchedule) {
      return res.status(403).json({
        success: false,
        message: `No valid class schedule found for this course on ${dayOfWeek}. You can only mark attendance for scheduled classes.`
      });
    }

    // Get registered students for this course
    const registrations = await Registration.find({
      'courses.courseId': courseId,
      status: { $ne: 'cancelled' }
    }).populate('studentId', 'firstName fatherName grandfatherName studentId');

    if (registrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students registered for this course'
      });
    }

    // Validate attendance records
    const validStatuses = ['present', 'absent', 'excused'];
    const invalidRecords = attendanceRecords.filter(record =>
      !record.studentId || !validStatuses.includes(record.status)
    );

    if (invalidRecords.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance records found',
        data: {
          invalidRecords
        }
      });
    }

    // Check if all students are registered
    const registeredStudentIds = registrations.map(reg => reg.studentId._id.toString());
    const unregisteredStudents = attendanceRecords.filter(record =>
      !registeredStudentIds.includes(record.studentId)
    );

    if (unregisteredStudents.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some students are not registered for this course',
        data: {
          unregisteredStudents
        }
      });
    }

    // Format date to remove time component
    const formattedDate = new Date(attendanceDate);
    formattedDate.setHours(0, 0, 0, 0);

    // Process attendance records
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      records: []
    };

    for (const record of attendanceRecords) {
      try {
        // Check if attendance record already exists
        const existingRecord = await Attendance.findOne({
          studentId: record.studentId,
          courseId,
          date: {
            $gte: new Date(formattedDate),
            $lt: new Date(formattedDate.getTime() + 24 * 60 * 60 * 1000)
          }
        });

        if (existingRecord) {
          // Update existing record
          existingRecord.status = record.status;
          existingRecord.notes = record.notes || '';
          existingRecord.updatedBy = req.user.id;
          existingRecord.lastUpdated = new Date();
          existingRecord.classScheduleId = validSchedule._id; // Link to class schedule

          await existingRecord.save();
          results.updated++;
          results.records.push({
            studentId: record.studentId,
            status: record.status,
            updated: true
          });
        } else {
          // Create new record
          const newAttendance = new Attendance({
            studentId: record.studentId,
            courseId,
            instructorId: req.user.id,
            classScheduleId: validSchedule._id, // Link to class schedule
            date: formattedDate,
            status: record.status,
            notes: record.notes || '',
            updatedBy: req.user.id,
            lastUpdated: new Date()
          });

          await newAttendance.save();
          results.created++;
          results.records.push({
            studentId: record.studentId,
            status: record.status,
            created: true
          });
        }

        // Send notification for absent students
        if (record.status === 'absent') {
          try {
            await createNotification({
              recipientId: record.studentId,
              title: 'Absence Recorded',
              message: `You were marked as absent for ${course.courseCode} (${course.courseName}) on ${formattedDate.toLocaleDateString()}.`,
              type: 'Warning',
              link: '/attendance',
              sourceType: 'attendance',
              sourceId: courseId,
              sourceModel: 'Course',
              createdBy: req.user.id
            });
          } catch (notificationError) {
            console.error('Attendance notification error:', notificationError);
            // Continue even if notification fails
          }
        }
      } catch (error) {
        console.error('Error processing attendance record:', error);
        results.failed++;
        results.records.push({
          studentId: record.studentId,
          error: error.message,
          failed: true
        });
      }
    }

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'ATTENDANCE_MARKED',
      targetId: courseId,
      targetModel: 'Course',
      targetName: course.courseCode,
      category: 'data_modification',
      severity: 'low',
      details: {
        date: formattedDate,
        created: results.created,
        updated: results.updated,
        failed: results.failed,
        scheduleId: validSchedule._id,
        dayOfWeek: dayOfWeek
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`✅ Attendance marked for ${course.courseCode} on ${formattedDate.toLocaleDateString()}`);
    console.log(`   👤 Instructor: ${req.user.firstName} ${req.user.fatherName}`);
    console.log(`   📊 Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`);
    console.log(`   📅 Schedule: ${dayOfWeek}, ${validSchedule.startTime}-${validSchedule.endTime}, Room ${validSchedule.roomNumber}`);

    // Check for students with low attendance and send warnings
    const studentsToCheck = [...new Set(attendanceRecords.map(record => record.studentId))];
    for (const studentId of studentsToCheck) {
      const eligibility = await Attendance.checkFinalExamEligibility(studentId, courseId);

      // If attendance is below 75% and above 60% (to avoid sending too many notifications)
      if (eligibility.percentage < 75 && eligibility.percentage >= 60) {
        try {
          await createNotification({
            recipientId: studentId,
            title: 'Low Attendance Warning',
            message: `Your attendance for ${course.courseCode} (${course.courseName}) is ${eligibility.percentage.toFixed(1)}%, which is below the required 75%. This may affect your eligibility for the final exam.`,
            type: 'Warning',
            link: '/attendance',
            sourceType: 'attendance',
            sourceId: courseId,
            sourceModel: 'Course',
            createdBy: req.user.id
          });
        } catch (notificationError) {
          console.error('Attendance warning notification error:', notificationError);
          // Continue even if notification fails
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        results,
        summary: {
          course: course.courseCode,
          date: formattedDate,
          totalStudents: registrations.length,
          processed: results.created + results.updated,
          failed: results.failed,
          schedule: {
            day: dayOfWeek,
            time: `${validSchedule.startTime}-${validSchedule.endTime}`,
            room: validSchedule.roomNumber
          }
        }
      }
    });

  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get attendance for a student in a course
// @route   GET /api/attendance/:courseId
// @access  Private (Student only)
export const getStudentAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Validate course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if student is registered for this course
    const registration = await Registration.findOne({
      studentId: req.user.id,
      'courses.courseId': courseId,
      status: { $ne: 'cancelled' }
    });

    if (!registration) {
      return res.status(403).json({
        success: false,
        message: 'You are not registered for this course'
      });
    }

    // Get class schedule for this course
    const schedules = await ClassSchedule.find({
      courseId,
      isActive: true
    }).sort({ dayOfWeek: 1, startTime: 1 });

    // Calculate attendance percentage
    const attendanceStats = await Attendance.calculateAttendancePercentage(
      req.user.id,
      courseId
    );

    // Get detailed attendance records
    const attendanceRecords = await Attendance.find({
      studentId: req.user.id,
      courseId
    })
      .populate('classScheduleId', 'dayOfWeek startTime endTime roomNumber')
      .sort({ date: -1 });

    // Check eligibility for final exam
    const eligibility = await Attendance.checkFinalExamEligibility(
      req.user.id,
      courseId
    );

    res.status(200).json({
      success: true,
      message: 'Attendance retrieved successfully',
      data: {
        course: {
          _id: course._id,
          courseCode: course.courseCode,
          courseName: course.courseName
        },
        schedules: schedules.map(schedule => ({
          _id: schedule._id,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          roomNumber: schedule.roomNumber
        })),
        attendanceStats,
        eligibility,
        records: attendanceRecords.map(record => ({
          _id: record._id,
          date: record.date,
          status: record.status,
          notes: record.notes,
          schedule: record.classScheduleId ? {
            dayOfWeek: record.classScheduleId.dayOfWeek,
            time: `${record.classScheduleId.startTime}-${record.classScheduleId.endTime}`,
            room: record.classScheduleId.roomNumber
          } : null
        }))
      }
    });

  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get student's attendance across all courses
// @route   GET /api/attendance/student/all
// @access  Private (Student only)
export const getStudentAllAttendance = async (req, res) => {
  try {
    const attendanceSummary = await Attendance.getStudentAttendanceAcrossCourses(req.user.id);

    // Get class schedules for each course
    for (const course of attendanceSummary.courses) {
      const schedules = await ClassSchedule.find({
        courseId: course.courseId,
        isActive: true
      }).sort({ dayOfWeek: 1, startTime: 1 });

      course.schedules = schedules.map(schedule => ({
        _id: schedule._id,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        roomNumber: schedule.roomNumber
      }));
    }

    res.status(200).json({
      success: true,
      message: 'Attendance summary retrieved successfully',
      data: attendanceSummary
    });

  } catch (error) {
    console.error('Get student all attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance summary',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get attendance report for a course
// @route   GET /api/attendance/report/:courseId
// @access  Private (Instructor, Department Head, Registrar)
export const getCourseAttendanceReport = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { date } = req.query;

    // Validate course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // If instructor, check if they are assigned to this course
    if (req.user.role === 'instructor') {
      const isAssigned = await ClassSchedule.exists({
        courseId,
        instructorId: req.user.id,
        isActive: true
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to teach this course'
        });
      }
    }

    // Get registered students
    const registrations = await Registration.find({
      'courses.courseId': courseId,
      status: { $ne: 'cancelled' }
    }).populate('studentId', 'firstName fatherName grandfatherName studentId');

    if (registrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students registered for this course'
      });
    }

    // Get class schedules for this course
    const schedules = await ClassSchedule.find({
      courseId,
      isActive: true
    }).sort({ dayOfWeek: 1, startTime: 1 });

    // Get attendance summary
    const attendanceSummary = await Attendance.getCourseAttendanceSummary(courseId);

    // If specific date is provided, get attendance for that date
    let dailyAttendance = null;
    if (date) {
      const attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(attendanceDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const records = await Attendance.find({
        courseId,
        date: {
          $gte: attendanceDate,
          $lt: nextDay
        }
      })
        .populate('studentId', 'firstName fatherName grandfatherName studentId')
        .populate('classScheduleId', 'dayOfWeek startTime endTime roomNumber');

      // Create a map of student IDs to attendance status
      const attendanceMap = {};
      records.forEach(record => {
        attendanceMap[record.studentId._id.toString()] = {
          status: record.status,
          notes: record.notes,
          attendanceId: record._id,
          schedule: record.classScheduleId ? {
            dayOfWeek: record.classScheduleId.dayOfWeek,
            time: `${record.classScheduleId.startTime}-${record.classScheduleId.endTime}`,
            room: record.classScheduleId.roomNumber
          } : null
        };
      });

      // Create daily attendance record for all registered students
      dailyAttendance = {
        date: attendanceDate,
        records: registrations.map(reg => ({
          studentId: reg.studentId._id,
          studentName: `${reg.studentId.firstName} ${reg.studentId.fatherName}`,
          studentIdNumber: reg.studentId.studentId,
          status: attendanceMap[reg.studentId._id.toString()]?.status || 'not_marked',
          notes: attendanceMap[reg.studentId._id.toString()]?.notes || '',
          attendanceId: attendanceMap[reg.studentId._id.toString()]?.attendanceId || null,
          schedule: attendanceMap[reg.studentId._id.toString()]?.schedule || null
        }))
      };
    }

    res.status(200).json({
      success: true,
      message: 'Attendance report retrieved successfully',
      data: {
        course: {
          _id: course._id,
          courseCode: course.courseCode,
          courseName: course.courseName,
          department: course.department,
          year: course.year,
          semester: course.semester
        },
        schedules: schedules.map(schedule => ({
          _id: schedule._id,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          roomNumber: schedule.roomNumber
        })),
        summary: attendanceSummary,
        dailyAttendance,
        registeredStudents: registrations.length
      }
    });

  } catch (error) {
    console.error('Get course attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance report',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Export attendance report to Excel
// @route   GET /api/attendance/export/:courseId
// @access  Private (Instructor, Department Head, Registrar)
export const exportAttendanceReport = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Validate course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // If instructor, check if they are assigned to this course
    if (req.user.role === 'instructor') {
      const isAssigned = await ClassSchedule.exists({
        courseId,
        instructorId: req.user.id,
        isActive: true
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to teach this course'
        });
      }
    }

    // Get class schedules for this course
    const schedules = await ClassSchedule.find({
      courseId,
      isActive: true
    }).sort({ dayOfWeek: 1, startTime: 1 });

    // Get attendance summary
    const attendanceSummary = await Attendance.getCourseAttendanceSummary(courseId);

    // Get all attendance records for this course
    const attendanceRecords = await Attendance.find({ courseId })
      .populate('studentId', 'firstName fatherName grandfatherName studentId')
      .populate('classScheduleId', 'dayOfWeek startTime endTime roomNumber')
      .sort({ date: 1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ATTC University';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');

    // Course info
    summarySheet.mergeCells('A1:F1');
    summarySheet.getCell('A1').value = 'ATTC UNIVERSITY - ATTENDANCE REPORT';
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getCell('A1').alignment = { horizontal: 'center' };

    summarySheet.mergeCells('A2:F2');
    summarySheet.getCell('A2').value = `${course.courseCode} - ${course.courseName}`;
    summarySheet.getCell('A2').font = { bold: true, size: 14 };
    summarySheet.getCell('A2').alignment = { horizontal: 'center' };

    summarySheet.addRow([]);
    summarySheet.addRow(['Department:', course.department, '', 'Year:', course.year]);
    summarySheet.addRow(['Semester:', course.semester, '', 'Total Classes:', attendanceSummary.totalClasses]);
    summarySheet.addRow(['Student Count:', attendanceSummary.studentCount, '', 'Average Attendance:', `${Math.round(attendanceSummary.averageAttendance)}%`]);
    summarySheet.addRow([]);

    // Class schedule information
    summarySheet.addRow(['CLASS SCHEDULE']);
    summarySheet.addRow(['Day', 'Start Time', 'End Time', 'Room', '', '']);
    schedules.forEach(schedule => {
      summarySheet.addRow([
        schedule.dayOfWeek,
        schedule.startTime,
        schedule.endTime,
        schedule.roomNumber,
        '',
        ''
      ]);
    });
    summarySheet.addRow([]);

    // Style header row
    summarySheet.getRow(7).font = { bold: true };
    summarySheet.getRow(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' }
    };
    summarySheet.getRow(7).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add headers
    summarySheet.addRow(['Student ID', 'Student Name', 'Total Classes', 'Present', 'Absent', 'Excused', 'Attendance %', 'Status']);

    // Add student data
    attendanceSummary.studentAttendance.forEach(student => {
      const status = student.percentage >= 75 ? 'Eligible' : 'At Risk';
      summarySheet.addRow([
        student.student.studentId,
        student.student.name,
        student.totalClasses,
        student.present,
        student.absent,
        student.excused,
        `${student.percentage}%`,
        status
      ]);

      // Color code status
      const row = summarySheet.lastRow;
      const statusCell = row.getCell(8);
      if (status === 'At Risk') {
        statusCell.font = { color: { argb: 'FFFF0000' } };
      } else {
        statusCell.font = { color: { argb: 'FF008000' } };
      }
    });

    // Format columns
    summarySheet.columns.forEach(column => {
      column.width = 15;
    });

    // Daily attendance sheet
    const dailySheet = workbook.addWorksheet('Daily Attendance');

    // Get unique dates
    const uniqueDates = [...new Set(attendanceRecords.map(record =>
      record.date.toISOString().split('T')[0]
    ))].sort();

    // Get unique students
    const uniqueStudents = [...new Set(attendanceRecords.map(record =>
      record.studentId._id.toString()
    ))];

    // Create student map
    const studentMap = {};
    attendanceRecords.forEach(record => {
      const studentId = record.studentId._id.toString();
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          id: studentId,
          name: `${record.studentId.firstName} ${record.studentId.fatherName}`,
          studentId: record.studentId.studentId
        };
      }
    });

    // Create headers (Student info + dates)
    const headers = ['Student ID', 'Student Name'];
    uniqueDates.forEach(date => {
      headers.push(new Date(date).toLocaleDateString());
    });

    dailySheet.addRow(headers);

    // Style header row
    dailySheet.getRow(1).font = { bold: true };
    dailySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' }
    };
    dailySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Create attendance map
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      const studentId = record.studentId._id.toString();
      const date = record.date.toISOString().split('T')[0];

      if (!attendanceMap[studentId]) {
        attendanceMap[studentId] = {};
      }

      attendanceMap[studentId][date] = record.status;
    });

    // Add student rows
    Object.values(studentMap).forEach(student => {
      const row = [student.studentId, student.name];

      uniqueDates.forEach(date => {
        const status = attendanceMap[student.id]?.[date] || 'N/A';
        row.push(status);
      });

      dailySheet.addRow(row);
    });

    // Format columns
    dailySheet.columns.forEach((column, index) => {
      if (index < 2) {
        column.width = 20;
      } else {
        column.width = 12;
      }
    });

    // Color code attendance status
    dailySheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        for (let colNumber = 3; colNumber <= uniqueDates.length + 2; colNumber++) {
          const cell = row.getCell(colNumber);
          switch (cell.value) {
            case 'present':
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF10B981' } // Green
              };
              break;
            case 'absent':
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFEF4444' } // Red
              };
              break;
            case 'excused':
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFBBF24' } // Yellow
              };
              break;
            default:
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE5E7EB' } // Gray
              };
          }
        }
      }
    });

    // Schedule sheet
    const scheduleSheet = workbook.addWorksheet('Class Schedule');

    scheduleSheet.addRow(['COURSE SCHEDULE']);
    scheduleSheet.addRow(['Day of Week', 'Start Time', 'End Time', 'Room Number']);

    schedules.forEach(schedule => {
      scheduleSheet.addRow([
        schedule.dayOfWeek,
        schedule.startTime,
        schedule.endTime,
        schedule.roomNumber
      ]);
    });

    // Style header row
    scheduleSheet.getRow(2).font = { bold: true };
    scheduleSheet.getRow(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' }
    };
    scheduleSheet.getRow(2).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Format columns
    scheduleSheet.columns.forEach(column => {
      column.width = 15;
    });

    // Set response headers
    const filename = `Attendance_${course.courseCode.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'DATA_EXPORT',
      targetId: courseId,
      targetModel: 'Course',
      targetName: course.courseCode,
      category: 'data_modification',
      severity: 'low',
      details: {
        documentType: 'Attendance Report',
        exportFormat: 'Excel',
        courseCode: course.courseCode,
        totalStudents: attendanceSummary.studentCount,
        totalClasses: attendanceSummary.totalClasses,
        scheduleCount: schedules.length
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`📊 Attendance report exported: ${filename} by ${req.user.firstName} ${req.user.fatherName}`);

  } catch (error) {
    console.error('Export attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export attendance report',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Update attendance record
// @route   PUT /api/attendance/:attendanceId
// @access  Private (Instructor, Department Head, Registrar)
export const updateAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { status, notes } = req.body;

    // Validate status
    if (!['present', 'absent', 'excused'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: present, absent, excused'
      });
    }

    // Find attendance record
    const attendance = await Attendance.findById(attendanceId)
      .populate('studentId', 'firstName fatherName')
      .populate('courseId', 'courseCode')
      .populate('classScheduleId', 'dayOfWeek startTime endTime roomNumber');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Check if user can update this record
    if (!attendance.canBeUpdated(req.user.id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this attendance record'
      });
    }

    // If instructor, check if they are assigned to this course via schedule
    if (req.user.role === 'instructor') {
      const isAssigned = await ClassSchedule.exists({
        courseId: attendance.courseId,
        instructorId: req.user.id,
        isActive: true
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to teach this course'
        });
      }
    }

    // Update record
    attendance.status = status;
    attendance.notes = notes || '';
    attendance.updatedBy = req.user.id;
    attendance.lastUpdated = new Date();

    await attendance.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'ATTENDANCE_UPDATED',
      targetId: attendance._id,
      targetModel: 'Attendance',
      targetName: `${attendance.studentId.firstName} ${attendance.studentId.fatherName} - ${attendance.courseId.courseCode}`,
      category: 'data_modification',
      severity: 'low',
      details: {
        previousStatus: attendance.status,
        newStatus: status,
        date: attendance.date,
        schedule: attendance.classScheduleId ? {
          dayOfWeek: attendance.classScheduleId.dayOfWeek,
          time: `${attendance.classScheduleId.startTime}-${attendance.classScheduleId.endTime}`,
          room: attendance.classScheduleId.roomNumber
        } : null
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send notification if status changed to absent
    if (status === 'absent' && attendance.status !== 'absent') {
      try {
        await createNotification({
          recipientId: attendance.studentId._id,
          title: 'Attendance Status Updated',
          message: `Your attendance status for ${attendance.courseId.courseCode} on ${new Date(attendance.date).toLocaleDateString()} has been updated to 'absent'.`,
          type: 'Warning',
          link: '/attendance',
          sourceType: 'attendance',
          sourceId: attendance.courseId._id,
          sourceModel: 'Course',
          createdBy: req.user.id
        });
      } catch (notificationError) {
        console.error('Attendance update notification error:', notificationError);
        // Continue even if notification fails
      }
    }

    console.log(`✏️ Attendance updated: ${attendance.studentId.firstName} ${attendance.studentId.fatherName} for ${attendance.courseId.courseCode} on ${attendance.date.toLocaleDateString()}`);
    console.log(`   👤 Updated by: ${req.user.firstName} ${req.user.fatherName}`);
    console.log(`   📊 Status: ${status}`);

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: {
        attendance: {
          _id: attendance._id,
          studentId: attendance.studentId._id,
          studentName: `${attendance.studentId.firstName} ${attendance.studentId.fatherName}`,
          courseId: attendance.courseId._id,
          courseCode: attendance.courseId.courseCode,
          date: attendance.date,
          status,
          notes: attendance.notes,
          updatedBy: req.user.id,
          lastUpdated: attendance.lastUpdated,
          schedule: attendance.classScheduleId ? {
            dayOfWeek: attendance.classScheduleId.dayOfWeek,
            time: `${attendance.classScheduleId.startTime}-${attendance.classScheduleId.endTime}`,
            room: attendance.classScheduleId.roomNumber
          } : null
        }
      }
    });

  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update attendance',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get instructor's courses for attendance
// @route   GET /api/attendance/instructor/courses
// @access  Private (Instructor only)
export const getInstructorCourses = async (req, res) => {
  try {
    // Get current academic year and semester
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const currentSemester = currentMonth < 6 ? 1 : 2; // Assuming semester 1 is Jan-Jun, semester 2 is Jul-Dec
    const academicYear = `${currentYear}-${currentYear + 1}`;

    // Get courses the instructor is scheduled to teach
    const schedules = await ClassSchedule.find({
      instructorId: req.user.id,
      academicYear,
      semester: currentSemester,
      isActive: true
    }).populate('courseId', 'courseCode courseName department year semester');

    if (schedules.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No courses found for attendance marking',
        data: {
          courses: []
        }
      });
    }

    // Extract unique courses from schedules
    const uniqueCourses = [];
    const courseMap = {};

    schedules.forEach(schedule => {
      const courseId = schedule.courseId._id.toString();
      if (!courseMap[courseId]) {
        courseMap[courseId] = {
          _id: schedule.courseId._id,
          courseCode: schedule.courseId.courseCode,
          courseName: schedule.courseId.courseName,
          department: schedule.courseId.department,
          year: schedule.courseId.year,
          semester: schedule.courseId.semester,
          schedules: []
        };
        uniqueCourses.push(courseMap[courseId]);
      }

      courseMap[courseId].schedules.push({
        _id: schedule._id,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        roomNumber: schedule.roomNumber
      });
    });

    // Get student counts for each course
    for (const course of uniqueCourses) {
      const registrations = await Registration.countDocuments({
        'courses.courseId': course._id,
        status: { $ne: 'cancelled' }
      });

      course.studentCount = registrations;
    }

    res.status(200).json({
      success: true,
      message: 'Instructor courses retrieved successfully',
      data: {
        courses: uniqueCourses,
        academicYear,
        currentSemester
      }
    });

  } catch (err) {
    console.error('Get instructor courses error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve instructor courses',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// @desc    Get students for attendance marking
// @route   GET /api/attendance/students/:courseId
// @access  Private (Instructor only)
export const getStudentsForAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { date } = req.query;

    // Validate course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if instructor is assigned to this course via schedule
    const isAssigned = await ClassSchedule.exists({
      courseId,
      instructorId: req.user.id,
      isActive: true
    });

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to teach this course'
      });
    }

    // Format date (default to today)
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    // Check if date is valid
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Get day of week for the attendance date
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = daysOfWeek[attendanceDate.getDay()];

    // Check if there's a class scheduled for this day
    const schedule = await ClassSchedule.findOne({
      courseId,
      instructorId: req.user.id,
      dayOfWeek,
      isActive: true
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: `No class scheduled for ${dayOfWeek}. You can only mark attendance for scheduled classes.`
      });
    }

    // Get registered students
    const registrations = await Registration.find({
      'courses.courseId': courseId,
      status: { $ne: 'cancelled' }
    }).populate('studentId', 'firstName fatherName grandfatherName studentId');

    if (registrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students registered for this course'
      });
    }

    // Get existing attendance records for this date
    const existingAttendance = await Attendance.find({
      courseId,
      date: {
        $gte: attendanceDate,
        $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    // Create a map of student IDs to attendance status
    const attendanceMap = {};
    existingAttendance.forEach(record => {
      attendanceMap[record.studentId.toString()] = {
        status: record.status,
        notes: record.notes,
        attendanceId: record._id
      };
    });

    // Prepare student list with attendance status
    const students = registrations.map(reg => {
      const studentId = reg.studentId._id.toString();
      return {
        _id: studentId,
        name: `${reg.studentId.firstName} ${reg.studentId.fatherName} ${reg.studentId.grandfatherName}`,
        studentId: reg.studentId.studentId,
        attendance: attendanceMap[studentId] || {
          status: 'not_marked',
          notes: '',
          attendanceId: null
        }
      };
    });

    res.status(200).json({
      success: true,
      message: 'Students retrieved successfully',
      data: {
        course: {
          _id: course._id,
          courseCode: course.courseCode,
          courseName: course.courseName
        },
        schedule: {
          _id: schedule._id,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          roomNumber: schedule.roomNumber
        },
        date: attendanceDate,
        students,
        attendanceMarked: existingAttendance.length > 0,
        totalStudents: students.length,
        markedCount: existingAttendance.length
      }
    });

  } catch (error) {
    console.error('Get students for attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve students',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get department attendance overview
// @route   GET /api/attendance/department/overview
// @access  Private (Department Head only)
export const getDepartmentAttendanceOverview = async (req, res) => {
  try {
    const { department } = req.query;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department parameter is required'
      });
    }

    // Get all courses for this department
    const courses = await Course.find({ department });

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No courses found for this department'
      });
    }

    // Get class schedules for all courses
    const courseIds = courses.map(course => course._id);
    const schedules = await ClassSchedule.find({
      courseId: { $in: courseIds },
      isActive: true
    }).populate('courseId', 'courseCode courseName');

    // Group schedules by course
    const schedulesByCourse = {};
    schedules.forEach(schedule => {
      const courseId = schedule.courseId._id.toString();
      if (!schedulesByCourse[courseId]) {
        schedulesByCourse[courseId] = [];
      }
      schedulesByCourse[courseId].push({
        _id: schedule._id,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        roomNumber: schedule.roomNumber
      });
    });

    // Get attendance records for all courses
    const attendanceRecords = await Attendance.find({
      courseId: { $in: courseIds }
    });

    // Group by course
    const courseAttendance = {};

    for (const course of courses) {
      const courseId = course._id.toString();
      const records = attendanceRecords.filter(record =>
        record.courseId.toString() === courseId
      );

      // Get unique dates for this course
      const uniqueDates = [...new Set(records.map(record =>
        record.date.toISOString().split('T')[0]
      ))];

      // Get unique students for this course
      const uniqueStudents = [...new Set(records.map(record =>
        record.studentId.toString()
      ))];

      // Calculate attendance percentages
      const presentCount = records.filter(record => record.status === 'present').length;
      const excusedCount = records.filter(record => record.status === 'excused').length;
      const absentCount = records.filter(record => record.status === 'absent').length;
      const totalRecords = records.length;

      const attendancePercentage = totalRecords > 0 ?
        ((presentCount + excusedCount) / totalRecords) * 100 : 0;

      courseAttendance[courseId] = {
        courseCode: course.courseCode,
        courseName: course.courseName,
        year: course.year,
        semester: course.semester,
        classSessions: uniqueDates.length,
        studentCount: uniqueStudents.length,
        attendancePercentage: Math.round(attendancePercentage * 10) / 10,
        presentCount,
        excusedCount,
        absentCount,
        atRiskCount: 0, // Will be calculated below
        schedules: schedulesByCourse[courseId] || []
      };
    }

    // Calculate at-risk students (below 75% attendance)
    for (const courseId in courseAttendance) {
      const course = courseAttendance[courseId];

      if (course.classSessions > 0 && course.studentCount > 0) {
        // Get all students for this course
        const registrations = await Registration.find({
          'courses.courseId': courseId,
          status: { $ne: 'cancelled' }
        });

        let atRiskCount = 0;

        for (const reg of registrations) {
          const studentId = reg.studentId.toString();
          const eligibility = await Attendance.checkFinalExamEligibility(studentId, courseId);

          if (!eligibility.eligible) {
            atRiskCount++;
          }
        }

        course.atRiskCount = atRiskCount;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Department attendance overview retrieved successfully',
      data: {
        department,
        courses: Object.values(courseAttendance),
        summary: {
          totalCourses: courses.length,
          totalSchedules: schedules.length,
          averageAttendance: Object.values(courseAttendance).reduce((sum, course) =>
            sum + course.attendancePercentage, 0) / courses.length,
          totalAtRiskStudents: Object.values(courseAttendance).reduce((sum, course) =>
            sum + course.atRiskCount, 0)
        }
      }
    });

  } catch (error) {
    console.error('Get department attendance overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department attendance overview',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get at-risk students report
// @route   GET /api/attendance/at-risk
// @access  Private (Department Head, Registrar)
export const getAtRiskStudentsReport = async (req, res) => {
  try {
    const { department, threshold = 75 } = req.query;

    // Validate department
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department parameter is required'
      });
    }

    // Get all courses for this department
    const courses = await Course.find({ department });

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No courses found for this department'
      });
    }

    // Get class schedules for all courses
    const courseIds = courses.map(course => course._id);
    const schedules = await ClassSchedule.find({
      courseId: { $in: courseIds },
      isActive: true
    }).populate('courseId', 'courseCode courseName');

    // Group schedules by course
    const schedulesByCourse = {};
    schedules.forEach(schedule => {
      const courseId = schedule.courseId._id.toString();
      if (!schedulesByCourse[courseId]) {
        schedulesByCourse[courseId] = [];
      }
      schedulesByCourse[courseId].push({
        _id: schedule._id,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        roomNumber: schedule.roomNumber
      });
    });

    const atRiskStudents = [];

    // Check each course
    for (const course of courses) {
      // Get registered students
      const registrations = await Registration.find({
        'courses.courseId': course._id,
        status: { $ne: 'cancelled' }
      }).populate('studentId', 'firstName fatherName grandfatherName studentId email');

      // Check each student
      for (const reg of registrations) {
        const studentId = reg.studentId._id;
        const eligibility = await Attendance.checkFinalExamEligibility(
          studentId,
          course._id,
          threshold
        );

        if (!eligibility.eligible) {
          atRiskStudents.push({
            student: {
              _id: studentId,
              name: `${reg.studentId.firstName} ${reg.studentId.fatherName} ${reg.studentId.grandfatherName}`,
              studentId: reg.studentId.studentId,
              email: reg.studentId.email
            },
            course: {
              _id: course._id,
              courseCode: course.courseCode,
              courseName: course.courseName
            },
            attendance: {
              percentage: eligibility.percentage,
              deficit: eligibility.deficit,
              totalClasses: eligibility.totalClasses,
              present: eligibility.present,
              absent: eligibility.absent,
              excused: eligibility.excused
            },
            schedules: schedulesByCourse[course._id.toString()] || []
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'At-risk students report retrieved successfully',
      data: {
        department,
        threshold,
        atRiskStudents,
        summary: {
          totalAtRisk: atRiskStudents.length,
          uniqueStudents: [...new Set(atRiskStudents.map(item => item.student._id.toString()))].length,
          byCourse: atRiskStudents.reduce((acc, item) => {
            const courseId = item.course._id.toString();
            acc[courseId] = (acc[courseId] || 0) + 1;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error('Get at-risk students report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve at-risk students report',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};