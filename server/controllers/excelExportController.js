import ExcelJS from 'exceljs';
import Grade from '../models/Grade.model.js';
import User from '../models/User.model.js';
import Registration from '../models/Registration.model.js';
import Evaluation from '../models/Evaluation.model.js';

// @desc    Export final grades to Excel
// @route   GET /api/registrar/export-grades
// @access  Private (Registrar only)
export const exportGrades = async (req, res) => {
  try {
    const { academicYear, semester, department } = req.query;

    // Build query
    const matchQuery = { status: { $in: ['finalized', 'locked'] } };
    if (academicYear) matchQuery.academicYear = academicYear;
    if (semester) matchQuery.semester = parseInt(semester);
    if (department) matchQuery.department = department;

    // Get grades with populated data
    const grades = await Grade.find(matchQuery)
      .populate('studentId', 'firstName fatherName grandfatherName studentId email department')
      .populate('courseId', 'courseCode courseName credit')
      .populate('instructorId', 'firstName fatherName')
      .sort({ department: 1, academicYear: 1, semester: 1, 'studentId.studentId': 1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ATTC University';
    workbook.created = new Date();

    // Main grades sheet
    const worksheet = workbook.addWorksheet('Final Grades');

    // Set column widths
    worksheet.columns = [
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Student Name', key: 'studentName', width: 30 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Course Code', key: 'courseCode', width: 12 },
      { header: 'Course Name', key: 'courseName', width: 35 },
      { header: 'Credits', key: 'credits', width: 8 },
      { header: 'Instructor', key: 'instructor', width: 25 },
      { header: 'Academic Year', key: 'academicYear', width: 12 },
      { header: 'Semester', key: 'semester', width: 10 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Midterm', key: 'midterm', width: 10 },
      { header: 'Continuous', key: 'continuous', width: 10 },
      { header: 'Final Exam', key: 'finalExam', width: 10 },
      { header: 'Total Mark', key: 'totalMark', width: 10 },
      { header: 'Letter Grade', key: 'letterGrade', width: 12 },
      { header: 'Grade Points', key: 'gradePoints', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Finalized Date', key: 'finalizedDate', width: 15 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data rows
    grades.forEach(grade => {
      worksheet.addRow({
        studentId: grade.studentId.studentId,
        studentName: `${grade.studentId.firstName} ${grade.studentId.fatherName} ${grade.studentId.grandfatherName}`,
        email: grade.studentId.email,
        department: grade.studentId.department || grade.department,
        courseCode: grade.courseId.courseCode,
        courseName: grade.courseId.courseName,
        credits: grade.courseId.credit,
        instructor: `${grade.instructorId.firstName} ${grade.instructorId.fatherName}`,
        academicYear: grade.academicYear,
        semester: grade.semester,
        year: grade.year,
        midterm: grade.midtermMark,
        continuous: grade.continuousMark,
        finalExam: grade.finalExamMark,
        totalMark: grade.totalMark,
        letterGrade: grade.letterGrade,
        gradePoints: grade.gradePoints,
        status: grade.status,
        finalizedDate: grade.finalizedAt ? new Date(grade.finalizedAt).toLocaleDateString() : ''
      });
    });

    // Add borders and formatting
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        if (rowNumber > 1) {
          // Color code based on grade
          if (cell.col === 16) { // Letter grade column
            const grade = cell.value;
            if (['A+', 'A'].includes(grade)) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
            } else if (['A-', 'B+', 'B'].includes(grade)) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
            } else if (['B-', 'C+', 'C'].includes(grade)) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            } else if (grade === 'D') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
            } else if (['F', 'NG'].includes(grade)) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
              cell.font = { color: { argb: 'FFFFFFFF' } };
            }
          }
        }
      });
    });

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Grade Summary');

    // Grade distribution
    const gradeDistribution = {};
    grades.forEach(grade => {
      gradeDistribution[grade.letterGrade] = (gradeDistribution[grade.letterGrade] || 0) + 1;
    });

    summarySheet.addRow(['Grade Distribution']);
    summarySheet.addRow(['Grade', 'Count', 'Percentage']);

    Object.entries(gradeDistribution).forEach(([grade, count]) => {
      const percentage = ((count / grades.length) * 100).toFixed(1);
      summarySheet.addRow([grade, count, `${percentage}%`]);
    });

    summarySheet.addRow([]);
    summarySheet.addRow(['Total Students:', grades.length]);
    summarySheet.addRow(['Export Date:', new Date().toLocaleDateString()]);
    summarySheet.addRow(['Exported By:', req.user.firstName + ' ' + req.user.fatherName]);

    // Set response headers
    const filename = `Final_Grades_${academicYear || 'All'}_${semester || 'All'}_${department || 'All'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

    console.log(`📊 Grades exported to Excel: ${filename} by ${req.user.firstName} ${req.user.fatherName}`);

  } catch (error) {
    console.error('Export grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export grades',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Export probation list to Excel
// @route   GET /api/registrar/export-probation
// @access  Private (Registrar only)
export const exportProbationList = async (req, res) => {
  try {
    const { academicYear } = req.query;

    // Get students on probation
    const probationStudents = await User.find({
      role: 'student',
      probation: true,
      status: 'active'
    }).sort({ department: 1, studentId: 1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Probation List');

    // Set columns
    worksheet.columns = [
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Full Name', key: 'fullName', width: 35 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Current Year', key: 'currentYear', width: 12 },
      { header: 'Current Semester', key: 'currentSemester', width: 15 },
      { header: 'Last CGPA', key: 'lastCGPA', width: 12 },
      { header: 'Total Credits', key: 'totalCredits', width: 12 },
      { header: 'Enrollment Year', key: 'enrollmentYear', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Last Updated', key: 'lastUpdated', width: 15 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFBBF24' }
    };

    // Add data
    probationStudents.forEach(student => {
      worksheet.addRow({
        studentId: student.studentId,
        fullName: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
        email: student.email,
        department: student.department || 'Freshman',
        currentYear: student.currentYear,
        currentSemester: student.currentSemester,
        lastCGPA: student.lastCGPA?.toFixed(2) || '0.00',
        totalCredits: student.totalCreditsEarned || 0,
        enrollmentYear: student.enrollmentYear,
        status: student.status.toUpperCase(),
        lastUpdated: student.academicStandingLastUpdated ?
          new Date(student.academicStandingLastUpdated).toLocaleDateString() : ''
      });
    });

    // Add borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Summary
    worksheet.addRow([]);
    worksheet.addRow(['SUMMARY']);
    worksheet.addRow(['Total Students on Probation:', probationStudents.length]);
    worksheet.addRow(['Export Date:', new Date().toLocaleDateString()]);
    worksheet.addRow(['Exported By:', req.user.firstName + ' ' + req.user.fatherName]);

    const filename = `Probation_List_${academicYear || new Date().getFullYear()}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`📊 Probation list exported: ${filename} by ${req.user.firstName} ${req.user.fatherName}`);

  } catch (error) {
    console.error('Export probation list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export probation list',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Export dismissed students list to Excel
// @route   GET /api/registrar/export-dismissed
// @access  Private (Registrar only)
export const exportDismissedList = async (req, res) => {
  try {
    const { academicYear } = req.query;

    // Get dismissed students
    const dismissedStudents = await User.find({
      role: 'student',
      dismissed: true
    }).sort({ department: 1, studentId: 1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Dismissed Students');

    // Set columns
    worksheet.columns = [
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Full Name', key: 'fullName', width: 35 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Last Year', key: 'lastYear', width: 12 },
      { header: 'Last Semester', key: 'lastSemester', width: 15 },
      { header: 'Final CGPA', key: 'finalCGPA', width: 12 },
      { header: 'Total Credits', key: 'totalCredits', width: 12 },
      { header: 'Enrollment Year', key: 'enrollmentYear', width: 15 },
      { header: 'Current Status', key: 'status', width: 12 },
      { header: 'Dismissal Date', key: 'dismissalDate', width: 15 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEF4444' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data
    dismissedStudents.forEach(student => {
      worksheet.addRow({
        studentId: student.studentId,
        fullName: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
        email: student.email,
        department: student.department || 'Freshman',
        lastYear: student.currentYear,
        lastSemester: student.currentSemester,
        finalCGPA: student.lastCGPA?.toFixed(2) || '0.00',
        totalCredits: student.totalCreditsEarned || 0,
        enrollmentYear: student.enrollmentYear,
        status: student.status.toUpperCase(),
        dismissalDate: student.academicStandingLastUpdated ?
          new Date(student.academicStandingLastUpdated).toLocaleDateString() : ''
      });
    });

    // Add borders and highlight dismissed students
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        if (rowNumber > 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
        }
      });
    });

    // Summary
    worksheet.addRow([]);
    worksheet.addRow(['SUMMARY']);
    worksheet.addRow(['Total Dismissed Students:', dismissedStudents.length]);
    worksheet.addRow(['Export Date:', new Date().toLocaleDateString()]);
    worksheet.addRow(['Exported By:', req.user.firstName + ' ' + req.user.fatherName]);

    const filename = `Dismissed_Students_${academicYear || new Date().getFullYear()}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`📊 Dismissed students list exported: ${filename} by ${req.user.firstName} ${req.user.fatherName}`);

  } catch (error) {
    console.error('Export dismissed list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export dismissed students list',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Export evaluation reports to Excel
// @route   GET /api/registrar/export-evaluations
// @access  Private (Registrar only)
export const exportEvaluationReports = async (req, res) => {
  try {
    const { academicYear, department } = req.query;

    // Build query
    const matchQuery = {};
    if (academicYear) matchQuery.academicYear = academicYear;
    if (department) matchQuery.department = department;

    // Get evaluations with populated data
    const evaluations = await Evaluation.find(matchQuery)
      .populate('instructorId', 'firstName fatherName department')
      .populate('courseId', 'courseCode courseName credit')
      .sort({ department: 1, 'instructorId.firstName': 1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Detailed evaluations sheet
    const detailSheet = workbook.addWorksheet('Evaluation Details');

    detailSheet.columns = [
      { header: 'Instructor Name', key: 'instructorName', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Course Code', key: 'courseCode', width: 12 },
      { header: 'Course Name', key: 'courseName', width: 30 },
      { header: 'Academic Year', key: 'academicYear', width: 12 },
      { header: 'Semester', key: 'semester', width: 10 },
      { header: 'Overall Rating', key: 'overallRating', width: 12 },
      { header: 'Submitted Date', key: 'submittedDate', width: 15 },
      { header: 'Anonymous Hash', key: 'anonymousHash', width: 20 }
    ];

    // Style header
    detailSheet.getRow(1).font = { bold: true };
    detailSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8B5CF6' }
    };
    detailSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add evaluation data
    evaluations.forEach(evaluation => {
      detailSheet.addRow({
        instructorName: `${evaluation.instructorId.firstName} ${evaluation.instructorId.fatherName}`,
        department: evaluation.department,
        courseCode: evaluation.courseId.courseCode,
        courseName: evaluation.courseId.courseName,
        academicYear: evaluation.academicYear,
        semester: evaluation.semester,
        overallRating: evaluation.overallRating,
        submittedDate: new Date(evaluation.submittedAt).toLocaleDateString(),
        anonymousHash: evaluation.anonymousHash
      });
    });

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Evaluation Summary');

    // Calculate instructor averages
    const instructorStats = {};
    evaluations.forEach(evaluation => {
      const key = evaluation.instructorId._id.toString();
      if (!instructorStats[key]) {
        instructorStats[key] = {
          name: `${evaluation.instructorId.firstName} ${evaluation.instructorId.fatherName}`,
          department: evaluation.department,
          totalEvaluations: 0,
          totalRating: 0,
          courses: new Set()
        };
      }
      instructorStats[key].totalEvaluations++;
      instructorStats[key].totalRating += evaluation.overallRating;
      instructorStats[key].courses.add(evaluation.courseId.courseCode);
    });

    summarySheet.columns = [
      { header: 'Instructor Name', key: 'instructorName', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Total Evaluations', key: 'totalEvaluations', width: 15 },
      { header: 'Average Rating', key: 'averageRating', width: 12 },
      { header: 'Courses Taught', key: 'coursesTaught', width: 12 },
      { header: 'Performance Level', key: 'performanceLevel', width: 15 }
    ];

    // Style summary header
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF10B981' }
    };
    summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add summary data
    Object.values(instructorStats).forEach((stats) => {
      const averageRating = stats.totalRating / stats.totalEvaluations;
      const performanceLevel =
        averageRating >= 4.5 ? 'Excellent' :
          averageRating >= 4.0 ? 'Very Good' :
            averageRating >= 3.5 ? 'Good' :
              averageRating >= 3.0 ? 'Satisfactory' : 'Needs Improvement';

      summarySheet.addRow({
        instructorName: stats.name,
        department: stats.department,
        totalEvaluations: stats.totalEvaluations,
        averageRating: averageRating.toFixed(2),
        coursesTaught: stats.courses.size,
        performanceLevel
      });
    });

    // Add borders to both sheets
    [detailSheet, summarySheet].forEach(sheet => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
    });

    const filename = `Evaluation_Reports_${academicYear || 'All'}_${department || 'All'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`📊 Evaluation reports exported: ${filename} by ${req.user.firstName} ${req.user.fatherName}`);

  } catch (error) {
    console.error('Export evaluation reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export evaluation reports',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Export comprehensive academic report
// @route   GET /api/registrar/export-academic-report
// @access  Private (Registrar only)
export const exportAcademicReport = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const currentAcademicYear = academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ATTC University';
    workbook.created = new Date();

    // Student Overview Sheet
    const studentSheet = workbook.addWorksheet('Student Overview');

    const students = await User.find({ role: 'student' })
      .sort({ department: 1, currentYear: 1, studentId: 1 });

    studentSheet.columns = [
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Full Name', key: 'fullName', width: 35 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Semester', key: 'semester', width: 10 },
      { header: 'CGPA', key: 'cgpa', width: 10 },
      { header: 'Credits', key: 'credits', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Academic Standing', key: 'standing', width: 15 }
    ];

    students.forEach(student => {
      const standing = student.dismissed ? 'DISMISSED' :
        student.probation ? 'PROBATION' : 'GOOD STANDING';

      studentSheet.addRow({
        studentId: student.studentId,
        fullName: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
        email: student.email,
        department: student.department || 'Freshman',
        year: student.currentYear,
        semester: student.currentSemester,
        cgpa: student.lastCGPA?.toFixed(2) || '0.00',
        credits: student.totalCreditsEarned || 0,
        status: student.status.toUpperCase(),
        standing
      });
    });

    // Registration Statistics Sheet
    const regSheet = workbook.addWorksheet('Registration Stats');

    const registrations = await Registration.aggregate([
      { $match: { academicYear: currentAcademicYear } },
      {
        $group: {
          _id: {
            department: '$department',
            year: '$year',
            semester: '$semester'
          },
          totalRegistrations: { $sum: 1 },
          totalCredits: { $sum: '$totalCredits' },
          averageCredits: { $avg: '$totalCredits' }
        }
      },
      { $sort: { '_id.department': 1, '_id.year': 1, '_id.semester': 1 } }
    ]);

    regSheet.columns = [
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Semester', key: 'semester', width: 10 },
      { header: 'Total Registrations', key: 'totalRegistrations', width: 18 },
      { header: 'Total Credits', key: 'totalCredits', width: 12 },
      { header: 'Average Credits', key: 'averageCredits', width: 15 }
    ];

    registrations.forEach(reg => {
      regSheet.addRow({
        department: reg._id.department,
        year: reg._id.year,
        semester: reg._id.semester,
        totalRegistrations: reg.totalRegistrations,
        totalCredits: reg.totalCredits,
        averageCredits: Math.round(reg.averageCredits * 100) / 100
      });
    });

    // Style all sheets
    [studentSheet, regSheet].forEach(sheet => {
      // Style headers
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      };
      sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      // Add borders
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
    });

    const filename = `Academic_Report_${currentAcademicYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`📊 Academic report exported: ${filename} by ${req.user.firstName} ${req.user.fatherName}`);

  } catch (error) {
    console.error('Export academic report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export academic report',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};