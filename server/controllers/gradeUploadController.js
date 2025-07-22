import ExcelJS from 'exceljs';
import Grade from '../models/Grade.model.js';
import User from '../models/User.model.js';
import Course from '../models/Course.model.js';
import Registration from '../models/Registration.model.js';
import { createNotification } from '../utils/notificationUtils.js';

// Helper: Validate grade values
function isValidGrade(val) {
  return typeof val === 'number' && !isNaN(val) && val >= 0 && val <= 100;
}

// Helper: Validate required fields
function validateRequiredFields(row, rowNumber) {
  const errors = [];

  if (!row.studentId) {
    errors.push(`Row ${rowNumber}: Missing student ID`);
  }

  if (!row.courseId) {
    errors.push(`Row ${rowNumber}: Missing course ID`);
  }

  if (row.midtermMark === undefined || row.midtermMark === null) {
    errors.push(`Row ${rowNumber}: Missing midterm mark`);
  } else if (!isValidGrade(row.midtermMark) || row.midtermMark > 30) {
    errors.push(`Row ${rowNumber}: Invalid midterm mark (must be 0-30)`);
  }

  if (row.continuousMark === undefined || row.continuousMark === null) {
    errors.push(`Row ${rowNumber}: Missing continuous mark`);
  } else if (!isValidGrade(row.continuousMark) || row.continuousMark > 30) {
    errors.push(`Row ${rowNumber}: Invalid continuous mark (must be 0-30)`);
  }

  if (row.finalExamMark === undefined || row.finalExamMark === null) {
    errors.push(`Row ${rowNumber}: Missing final exam mark`);
  } else if (!isValidGrade(row.finalExamMark) || row.finalExamMark > 40) {
    errors.push(`Row ${rowNumber}: Invalid final exam mark (must be 0-40)`);
  }

  return errors;
}

// Helper: Calculate total mark
function calculateTotalMark(midterm, continuous, final) {
  return midterm + continuous + final;
}

// Helper: Find student by student ID
async function findStudentByStudentId(studentId) {
  return await User.findOne({
    studentId: studentId,
    role: 'student',
    status: 'active'
  });
}

// Helper: Find course by course ID
async function findCourseByCourseId(courseId) {
  return await Course.findById(courseId);
}

// Helper: Find registration for student and course
async function findRegistration(studentId, courseId, academicYear) {
  return await Registration.findOne({
    studentId: studentId,
    'courses.courseId': courseId,
    academicYear: academicYear
  });
}

/**
 * Upload grades from Excel file
 * @route POST /api/grades/upload
 * @access Private (Instructor only)
 */
export const uploadGrades = async (req, res) => {
  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const { courseId, academicYear, semester } = req.body;
  const instructorId = req.user.id;

  // Validate required body parameters
  if (!courseId || !academicYear || !semester) {
    return res.status(400).json({
      success: false,
      message: 'Course ID, Academic Year, and Semester are required'
    });
  }

  try {
    // Validate course exists and instructor has access
    const course = await findCourseByCourseId(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Parse Excel file from memory buffer
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    const grades = [];
    const errors = [];
    const processedRows = [];
    let rowNumber = 0;

    // Process each row in the Excel file
    worksheet.eachRow((row, rowIndex) => {
      rowNumber = rowIndex;

      // Skip header row
      if (rowIndex === 1) return;

      // Extract values from row
      const values = row.values;
      if (!values || values.length < 5) {
        errors.push(`Row ${rowIndex}: Insufficient data columns`);
        return;
      }

      // Map Excel columns to grade data
      const gradeData = {
        studentId: values[1]?.toString().trim(),
        courseId: values[2]?.toString().trim(),
        midtermMark: parseFloat(values[3]) || 0,
        continuousMark: parseFloat(values[4]) || 0,
        finalExamMark: parseFloat(values[5]) || 0
      };

      // Validate required fields
      const validationErrors = validateRequiredFields(gradeData, rowIndex);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        return;
      }

      // Calculate total mark
      gradeData.totalMark = calculateTotalMark(
        gradeData.midtermMark,
        gradeData.continuousMark,
        gradeData.finalExamMark
      );

      processedRows.push({
        ...gradeData,
        rowIndex
      });
    });

    // Validate all students exist
    const studentIds = [...new Set(processedRows.map(row => row.studentId))];
    const students = await User.find({
      studentId: { $in: studentIds },
      role: 'student',
      status: 'active'
    });

    const validStudentIds = new Set(students.map(s => s.studentId));
    const studentMap = new Map(students.map(s => [s.studentId, s]));

    // Filter out invalid students
    const validRows = processedRows.filter(row => {
      if (!validStudentIds.has(row.studentId)) {
        errors.push(`Row ${row.rowIndex}: Student with ID '${row.studentId}' not found or inactive`);
        return false;
      }
      return true;
    });

    // Validate all courses exist
    const courseIds = [...new Set(validRows.map(row => row.courseId))];
    const courses = await Course.find({ _id: { $in: courseIds } });
    const validCourseIds = new Set(courses.map(c => c._id.toString()));
    const courseMap = new Map(courses.map(c => [c._id.toString(), c]));

    // Filter out invalid courses
    const finalValidRows = validRows.filter(row => {
      if (!validCourseIds.has(row.courseId)) {
        errors.push(`Row ${row.rowIndex}: Course with ID '${row.courseId}' not found`);
        return false;
      }
      return true;
    });

    // Process grades in batches for better performance
    const batchSize = 50;
    let successCount = 0;
    let updateCount = 0;
    let createCount = 0;

    for (let i = 0; i < finalValidRows.length; i += batchSize) {
      const batch = finalValidRows.slice(i, i + batchSize);

      for (const row of batch) {
        try {
          const student = studentMap.get(row.studentId);
          const course = courseMap.get(row.courseId);

          // Find existing grade or create new one
          let grade = await Grade.findOne({
            studentId: student._id,
            courseId: course._id,
            academicYear: academicYear
          });

          if (grade) {
            // Update existing grade if it can be modified
            if (!grade.canBeModified()) {
              errors.push(`Row ${row.rowIndex}: Grade cannot be modified. Current status: ${grade.status}`);
              continue;
            }

            // Update grade
            grade.midtermMark = row.midtermMark;
            grade.continuousMark = row.continuousMark;
            grade.finalExamMark = row.finalExamMark;
            grade.totalMark = row.totalMark;
            grade.status = 'draft';
            grade.isApprovedByDeptHead = false;
            grade.isApprovedByRegistrar = false;
            grade.instructorComments = `Updated via Excel upload on ${new Date().toISOString()}`;

            await grade.save();
            updateCount++;
          } else {
            // Create new grade
            grade = new Grade({
              studentId: student._id,
              courseId: course._id,
              instructorId: instructorId,
              academicYear: academicYear,
              semester: parseInt(semester),
              year: course.year,
              department: course.department,
              midtermMark: row.midtermMark,
              continuousMark: row.continuousMark,
              finalExamMark: row.finalExamMark,
              totalMark: row.totalMark,
              status: 'draft',
              isApprovedByDeptHead: false,
              isApprovedByRegistrar: false,
              instructorComments: `Created via Excel upload on ${new Date().toISOString()}`
            });

            await grade.save();
            createCount++;
          }

          successCount++;
          grades.push({
            studentId: row.studentId,
            studentName: `${student.firstName} ${student.fatherName}`,
            courseCode: course.courseCode,
            courseName: course.courseName,
            midtermMark: row.midtermMark,
            continuousMark: row.continuousMark,
            finalExamMark: row.finalExamMark,
            totalMark: row.totalMark
          });

        } catch (error) {
          errors.push(`Row ${row.rowIndex}: Database error - ${error.message}`);
        }
      }
    }

    // Create notification for department head if grades were uploaded
    if (successCount > 0) {
      try {
        await createNotification({
          recipientId: course.instructorId, // Assuming course has instructorId
          type: 'grade_upload',
          title: 'Grades Uploaded',
          message: `${successCount} grades have been uploaded for ${course.courseCode} - ${course.courseName}`,
          data: {
            courseId: course._id,
            academicYear,
            semester,
            uploadedCount: successCount
          }
        });
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
      }
    }

    // Return response
    res.json({
      success: true,
      message: `Successfully processed ${successCount} grades`,
      data: {
        totalProcessed: processedRows.length,
        successCount,
        updateCount,
        createCount,
        grades: grades.slice(0, 10), // Return first 10 for preview
        errors: errors.slice(0, 20) // Return first 20 errors
      },
      summary: {
        totalRows: rowNumber - 1, // Exclude header
        validRows: finalValidRows.length,
        successRate: finalValidRows.length > 0 ? (successCount / finalValidRows.length * 100).toFixed(1) : 0
      }
    });

  } catch (error) {
    console.error('Grade upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process Excel file',
      error: error.message
    });
  }
};

/**
 * Download Excel template for grade upload
 * @route GET /api/grades/template/:courseId
 * @access Private (Instructor only)
 */
export const downloadTemplate = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { academicYear, semester } = req.query;

    // Validate course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get registered students for this course
    const registrations = await Registration.find({
      'courses.courseId': courseId,
      academicYear: academicYear || new Date().getFullYear().toString()
    }).populate('studentId', 'studentId firstName fatherName grandfatherName');

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Grades Template');

    // Add headers
    worksheet.columns = [
      { header: 'Row', key: 'row', width: 5 },
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Course ID', key: 'courseId', width: 15 },
      { header: 'Midterm Mark (0-30)', key: 'midtermMark', width: 20 },
      { header: 'Continuous Mark (0-30)', key: 'continuousMark', width: 20 },
      { header: 'Final Exam Mark (0-40)', key: 'finalExamMark', width: 20 },
      { header: 'Total Mark (Auto-calculated)', key: 'totalMark', width: 25 },
      { header: 'Student Name', key: 'studentName', width: 30 }
    ];

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add student data
    registrations.forEach((registration, index) => {
      const student = registration.studentId;
      worksheet.addRow({
        row: index + 2,
        studentId: student.studentId,
        courseId: courseId,
        midtermMark: '',
        continuousMark: '',
        finalExamMark: '',
        totalMark: '',
        studentName: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`
      });
    });

    // Add instructions
    worksheet.addRow([]);
    worksheet.addRow(['Instructions:']);
    worksheet.addRow(['1. Fill in the midterm, continuous, and final exam marks']);
    worksheet.addRow(['2. Total mark will be calculated automatically']);
    worksheet.addRow(['3. Do not modify the Student ID or Course ID columns']);
    worksheet.addRow(['4. Save as .xlsx format before uploading']);

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="grades_template_${course.courseCode}_${academicYear || 'current'}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
      error: error.message
    });
  }
};

/**
 * Get upload history for instructor
 * @route GET /api/grades/upload-history
 * @access Private (Instructor only)
 */
export const getUploadHistory = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const grades = await Grade.find({ instructorId })
      .populate('studentId', 'studentId firstName fatherName')
      .populate('courseId', 'courseCode courseName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Grade.countDocuments({ instructorId });

    res.json({
      success: true,
      data: {
        grades,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Upload history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upload history',
      error: error.message
    });
  }
};
