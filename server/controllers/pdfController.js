import PDFDocument from 'pdfkit';
import fs from 'fs';
import Registration from '../models/Registration.model.js';
import User from '../models/User.model.js';
import Grade from '../models/Grade.model.js';

// Ensure uploads directory exists
const uploadsDir = 'uploads/registration-slips';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// @desc    Generate and download registration slip PDF
// @route   GET /api/student/registration-slip/:registrationId
// @access  Private (Student only)
export const generateRegistrationSlipPDF = async (req, res) => {
  try {
    const { registrationId } = req.params;

    // Find registration and verify ownership
    const registration = await Registration.findOne({
      _id: registrationId,
      studentId: req.user.id
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found or access denied'
      });
    }

    // Get student details
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Generate PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Registration Slip - ${student.firstName} ${student.fatherName}`,
        Author: 'ATTC University',
        Subject: 'Course Registration Slip',
        Creator: 'ATTC Academic Management System'
      }
    });

    // Set response headers for PDF download
    const filename = `${student.firstName}_${student.fatherName}_${registration.year}_Semester${registration.semester}_Slip.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add university header
    doc.fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#1e40af')
      .text('ATTC UNIVERSITY', { align: 'center' })
      .fontSize(18)
      .fillColor('#374151')
      .text('COURSE REGISTRATION SLIP', { align: 'center' })
      .moveDown(2);

    // Add border
    doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
      .stroke('#e5e7eb');

    // Registration Information Section
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('REGISTRATION INFORMATION', 70, doc.y + 20)
      .moveDown(0.5);

    // Add underline
    doc.moveTo(70, doc.y)
      .lineTo(300, doc.y)
      .stroke('#3b82f6');

    doc.moveDown(0.5)
      .fontSize(11)
      .font('Helvetica');

    const regInfo = [
      ['Registration Number:', registration.registrationNumber],
      ['Registration Date:', new Date(registration.registrationDate).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })],
      ['Academic Year:', registration.academicYear],
      ['Status:', registration.status.toUpperCase()],
      ['Type:', registration.isRepeatSemester ? 'REPEAT SEMESTER' : 'REGULAR SEMESTER']
    ];

    regInfo.forEach(([label, value]) => {
      doc.fillColor('#374151')
        .text(label, 70, doc.y, { width: 150, continued: true })
        .fillColor('#1f2937')
        .font('Helvetica-Bold')
        .text(value, { width: 300 })
        .font('Helvetica')
        .moveDown(0.3);
    });

    doc.moveDown(1);

    // Student Information Section
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('STUDENT INFORMATION', 70, doc.y)
      .moveDown(0.5);

    // Add underline
    doc.moveTo(70, doc.y)
      .lineTo(300, doc.y)
      .stroke('#3b82f6');

    doc.moveDown(0.5)
      .fontSize(11)
      .font('Helvetica');

    const studentInfo = [
      ['Full Name:', `${student.firstName} ${student.fatherName} ${student.grandfatherName}`],
      ['Student ID:', student.studentId],
      ['Email:', student.email],
      ['Department:', registration.department],
      ['Academic Year:', `Year ${registration.year}`],
      ['Semester:', `Semester ${registration.semester}`],
      ['Enrollment Year:', student.enrollmentYear?.toString() || 'N/A']
    ];

    studentInfo.forEach(([label, value]) => {
      doc.fillColor('#374151')
        .text(label, 70, doc.y, { width: 150, continued: true })
        .fillColor('#1f2937')
        .font('Helvetica-Bold')
        .text(value, { width: 300 })
        .font('Helvetica')
        .moveDown(0.3);
    });

    doc.moveDown(1);

    // Courses Section
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('REGISTERED COURSES', 70, doc.y)
      .moveDown(0.5);

    // Add underline
    doc.moveTo(70, doc.y)
      .lineTo(500, doc.y)
      .stroke('#3b82f6');

    doc.moveDown(0.5);

    // Table headers
    const tableTop = doc.y;
    const tableLeft = 70;
    const colWidths = [80, 250, 60, 80, 80];
    let currentY = tableTop;

    // Header background
    doc.rect(tableLeft, currentY - 5, colWidths.reduce((a, b) => a + b, 0), 25)
      .fill('#f3f4f6');

    doc.fillColor('#1f2937')
      .fontSize(10)
      .font('Helvetica-Bold');

    const headers = ['Course Code', 'Course Name', 'Credits', 'Type', 'Reg. Date'];
    let currentX = tableLeft;

    headers.forEach((header, index) => {
      doc.text(header, currentX + 5, currentY, { width: colWidths[index] - 10 });
      currentX += colWidths[index];
    });

    currentY += 20;

    // Table border
    doc.rect(tableLeft, tableTop - 5, colWidths.reduce((a, b) => a + b, 0), 25)
      .stroke('#d1d5db');

    // Course rows
    doc.fontSize(9)
      .font('Helvetica');

    registration.courses.forEach((course, index) => {
      if (currentY > 700) { // Start new page if needed
        doc.addPage();
        currentY = 50;
      }

      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(tableLeft, currentY - 2, colWidths.reduce((a, b) => a + b, 0), 18)
          .fill('#f9fafb');
      }

      currentX = tableLeft;
      const rowData = [
        course.courseCode,
        course.courseName.length > 35 ? course.courseName.substring(0, 32) + '...' : course.courseName,
        course.credit.toString(),
        course.isRepeat ? 'REPEAT' : 'REGULAR',
        new Date(course.registrationDate).toLocaleDateString()
      ];

      rowData.forEach((data, colIndex) => {
        doc.fillColor('#374151')
          .text(data, currentX + 5, currentY, { width: colWidths[colIndex] - 10 });
        currentX += colWidths[colIndex];
      });

      // Row border
      doc.rect(tableLeft, currentY - 2, colWidths.reduce((a, b) => a + b, 0), 18)
        .stroke('#e5e7eb');

      currentY += 16;
    });

    currentY += 20;

    // Summary Section
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('REGISTRATION SUMMARY', tableLeft, currentY)
      .moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica');

    const summary = [
      ['Total Courses:', registration.courses.length.toString()],
      ['Total Credits:', registration.totalCredits.toString()],
      ['Repeat Courses:', registration.repeatCourseCount?.toString() || '0'],
      ['Registration Type:', registration.isRepeatSemester ? 'Repeat Semester' : 'Regular Semester']
    ];

    summary.forEach(([label, value]) => {
      doc.fillColor('#374151')
        .text(label, tableLeft, doc.y, { width: 150, continued: true })
        .fillColor('#1f2937')
        .font('Helvetica-Bold')
        .text(value, { width: 200 })
        .font('Helvetica')
        .moveDown(0.3);
    });

    doc.moveDown(2);

    // Important Notes
    doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#dc2626')
      .text('IMPORTANT NOTES:', tableLeft, doc.y)
      .moveDown(0.3);

    doc.fontSize(9)
      .font('Helvetica')
      .fillColor('#374151');

    const notes = [
      '• This is an official registration document. Keep it for your records.',
      '• Any changes to your registration must be approved by the registrar.',
      '• Course withdrawal deadlines apply as per university calendar.',
      '• Contact the registrar office for any registration-related queries.',
      '• This document is valid only for the specified academic term.'
    ];

    notes.forEach(note => {
      doc.text(note, tableLeft, doc.y, { width: 450 })
        .moveDown(0.2);
    });

    // Footer
    doc.fontSize(8)
      .fillColor('#6b7280')
      .text(`Generated on: ${new Date().toLocaleString()}`, tableLeft, doc.page.height - 100)
      .text('ATTC University Academic Management System', tableLeft, doc.page.height - 85)
      .text('This document was generated electronically and is valid without signature.', tableLeft, doc.page.height - 70);

    // Finalize PDF
    doc.end();

    console.log(`📄 Registration slip PDF generated: ${filename} for ${student.firstName} ${student.fatherName}`);

  } catch (error) {
    console.error('Generate registration slip PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate registration slip PDF',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Generate transcript PDF
// @route   GET /api/student/transcript-pdf
// @access  Private (Student only)
export const generateTranscriptPDF = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get all finalized grades
    const grades = await Grade.find({
      studentId: req.user.id,
      status: { $in: ['finalized', 'locked'] }
    })
      .populate('courseId', 'courseCode courseName credit')
      .sort({ academicYear: 1, semester: 1 });

    if (grades.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No finalized grades found for transcript generation'
      });
    }

    // Generate PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Official Transcript - ${student.firstName} ${student.fatherName}`,
        Author: 'ATTC University',
        Subject: 'Official Academic Transcript',
        Creator: 'ATTC Academic Management System'
      }
    });

    // Set response headers
    const filename = `${student.firstName}_${student.fatherName}_Official_Transcript.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header
    doc.fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#1e40af')
      .text('ATTC UNIVERSITY', { align: 'center' })
      .fontSize(18)
      .fillColor('#374151')
      .text('OFFICIAL ACADEMIC TRANSCRIPT', { align: 'center' })
      .moveDown(2);

    // Student Information
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text('STUDENT INFORMATION')
      .moveDown(0.5);

    const studentData = [
      ['Name:', `${student.firstName} ${student.fatherName} ${student.grandfatherName}`],
      ['Student ID:', student.studentId],
      ['Department:', student.department || 'Freshman'],
      ['Enrollment Year:', student.enrollmentYear?.toString() || 'N/A'],
      ['Current Status:', student.status?.toUpperCase() || 'ACTIVE']
    ];

    doc.fontSize(10).font('Helvetica');
    studentData.forEach(([label, value]) => {
      doc.text(`${label} ${value}`, { width: 500 }).moveDown(0.2);
    });

    doc.moveDown(1);

    // Group grades by academic year and semester
    const transcript = {};
    let cumulativeCredits = 0;
    let cumulativeGradePoints = 0;

    grades.forEach(grade => {
      const key = `${grade.academicYear}-S${grade.semester}`;

      if (!transcript[key]) {
        transcript[key] = {
          academicYear: grade.academicYear,
          semester: grade.semester,
          courses: [],
          semesterCredits: 0,
          semesterGradePoints: 0
        };
      }

      transcript[key].courses.push({
        courseCode: grade.courseId.courseCode,
        courseName: grade.courseId.courseName,
        credit: grade.courseId.credit,
        letterGrade: grade.letterGrade,
        gradePoints: grade.gradePoints,
        totalMark: grade.totalMark
      });

      transcript[key].semesterCredits += grade.courseId.credit;
      transcript[key].semesterGradePoints += (grade.gradePoints * grade.courseId.credit);

      cumulativeCredits += grade.courseId.credit;
      cumulativeGradePoints += (grade.gradePoints * grade.courseId.credit);
    });

    // Academic Record
    Object.values(transcript).forEach((semester) => {
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text(`${semester.academicYear} - Semester ${semester.semester}`)
        .moveDown(0.3);

      // Course table headers
      doc.fontSize(9)
        .text('Course Code', 70, doc.y, { width: 80 })
        .text('Course Name', 150, doc.y, { width: 200 })
        .text('Credits', 350, doc.y, { width: 50 })
        .text('Grade', 400, doc.y, { width: 40 })
        .text('Points', 440, doc.y, { width: 40 })
        .text('Mark', 480, doc.y, { width: 50 });

      doc.moveDown(0.3);

      // Course rows
      semester.courses.forEach((course) => {
        doc.text(course.courseCode, 70, doc.y, { width: 80 })
          .text(course.courseName.substring(0, 30), 150, doc.y, { width: 200 })
          .text(course.credit.toString(), 350, doc.y, { width: 50 })
          .text(course.letterGrade, 400, doc.y, { width: 40 })
          .text(course.gradePoints.toString(), 440, doc.y, { width: 40 })
          .text(course.totalMark.toString(), 480, doc.y, { width: 50 });
        doc.moveDown(0.3);
      });

      // Semester summary
      const semesterGPA = semester.semesterCredits > 0 ?
        Math.round((semester.semesterGradePoints / semester.semesterCredits) * 100) / 100 : 0;

      doc.font('Helvetica-Bold')
        .text(`Semester Credits: ${semester.semesterCredits}  |  Semester GPA: ${semesterGPA}`)
        .font('Helvetica')
        .moveDown(1);
    });

    // Final Summary
    const cgpa = cumulativeCredits > 0 ?
      Math.round((cumulativeGradePoints / cumulativeCredits) * 100) / 100 : 0;

    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text('ACADEMIC SUMMARY')
      .moveDown(0.5);

    doc.fontSize(10)
      .font('Helvetica')
      .text(`Total Credits Attempted: ${cumulativeCredits}`)
      .text(`Total Credits Earned: ${cumulativeCredits}`)
      .text(`Cumulative GPA (CGPA): ${cgpa}`)
      .text(`Academic Standing: ${student.probation ? 'PROBATION' : student.dismissed ? 'DISMISSED' : 'GOOD STANDING'}`)
      .moveDown(1);

    // Footer
    doc.fontSize(8)
      .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' })
      .text('This is an official document generated by ATTC University Academic Management System', { align: 'center' });

    doc.end();

    console.log(`📄 Transcript PDF generated: ${filename} for ${student.firstName} ${student.fatherName}`);

  } catch (error) {
    console.error('Generate transcript PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate transcript PDF',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};