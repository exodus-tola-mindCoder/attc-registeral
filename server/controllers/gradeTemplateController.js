import ExcelJS from 'exceljs';
import Student from '../models/Student.model.js';
import Course from '../models/Course.model.js';

// GET /api/grades/template/:courseId
export const downloadGradeTemplate = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    // Find enrolled students for this course (adjust query as needed)
    const students = await Student.find({ courses: courseId });
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Grades');
    sheet.addRow(['StudentID', 'Midterm', 'Continuous', 'Final']);
    students.forEach(s => {
      sheet.addRow([s.studentId, '', '', '']);
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=grade_template_${course.code || courseId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate template', error: err.message });
  }
};
