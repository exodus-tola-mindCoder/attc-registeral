import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import User from '../models/User.model.js';
import Grade from '../models/Grade.model.js';
import AuditLog from '../models/AuditLog.model.js';

// Ensure uploads directory exists
const uploadsDir = 'uploads/transcripts';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// @desc    Generate and download official transcript PDF
// @route   GET /api/transcript/download
// @access  Private (Student only)
export const downloadTranscript = async (req, res) => {
  try {
    // Get student details
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
          semesterGradePoints: 0,
          semesterGPA: 0
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

    // Calculate semester GPAs
    Object.keys(transcript).forEach(key => {
      const semester = transcript[key];
      semester.semesterGPA = semester.semesterCredits > 0 ?
        Math.round((semester.semesterGradePoints / semester.semesterCredits) * 100) / 100 : 0;
    });

    const cgpa = cumulativeCredits > 0 ?
      Math.round((cumulativeGradePoints / cumulativeCredits) * 100) / 100 : 0;

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

    // Generate filename
    const filename = `${student.firstName}_${student.fatherName}_Official_Transcript.pdf`;
    const filepath = path.join(uploadsDir, filename);

    // Pipe PDF to file and response
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    doc.pipe(res);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Add university header with logo
    doc.fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#1e40af')
      .text('ATTC UNIVERSITY', { align: 'center' })
      .fontSize(18)
      .fillColor('#374151')
      .text('OFFICIAL ACADEMIC TRANSCRIPT', { align: 'center' })
      .moveDown(2);

    // Add border
    doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
      .stroke('#e5e7eb');

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
      ['Department:', student.department || 'Freshman'],
      ['Current Year:', `Year ${student.currentYear}`],
      ['Current Semester:', `Semester ${student.currentSemester}`],
      ['Enrollment Year:', student.enrollmentYear?.toString() || 'N/A'],
      ['Status:', student.status?.toUpperCase() || 'ACTIVE']
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

    // Academic Record Section
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('ACADEMIC RECORD', 70, doc.y)
      .moveDown(0.5);

    // Add underline
    doc.moveTo(70, doc.y)
      .lineTo(300, doc.y)
      .stroke('#3b82f6');

    doc.moveDown(1);

    // Semester-by-semester grades
    Object.values(transcript).forEach((semester, index) => {
      // Add page break if needed
      if (doc.y > 650 && index > 0) {
        doc.addPage();
      }

      doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text(`${semester.academicYear} - Semester ${semester.semester}`, 70, doc.y)
        .moveDown(0.5);

      // Table headers
      const tableTop = doc.y;
      const tableLeft = 70;
      const colWidths = [80, 220, 50, 60, 60];

      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#374151');

      // Header background
      doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), 20)
        .fill('#f3f4f6');

      // Header text
      doc.fillColor('#1f2937')
        .text('Course Code', tableLeft + 5, tableTop + 5, { width: colWidths[0] })
        .text('Course Name', tableLeft + colWidths[0] + 5, tableTop + 5, { width: colWidths[1] })
        .text('Credits', tableLeft + colWidths[0] + colWidths[1] + 5, tableTop + 5, { width: colWidths[2] })
        .text('Grade', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableTop + 5, { width: colWidths[3] })
        .text('Points', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, tableTop + 5, { width: colWidths[4] });

      // Course rows
      let currentY = tableTop + 20;

      semester.courses.forEach((course, i) => {
        // Alternate row colors
        if (i % 2 === 0) {
          doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b, 0), 20)
            .fill('#f9fafb');
        }

        doc.fillColor('#1f2937')
          .font('Helvetica')
          .fontSize(9)
          .text(course.courseCode, tableLeft + 5, currentY + 5, { width: colWidths[0] })
          .text(course.courseName.length > 35 ? course.courseName.substring(0, 32) + '...' : course.courseName,
            tableLeft + colWidths[0] + 5, currentY + 5, { width: colWidths[1] })
          .text(course.credit.toString(), tableLeft + colWidths[0] + colWidths[1] + 5, currentY + 5, { width: colWidths[2] })
          .text(course.letterGrade, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, currentY + 5, { width: colWidths[3] })
          .text(course.gradePoints.toString(), tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, currentY + 5, { width: colWidths[4] });

        currentY += 20;
      });

      // Table border
      doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), currentY - tableTop)
        .stroke('#d1d5db');

      // Semester summary
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text(`Semester Credits: ${semester.semesterCredits}`, tableLeft, currentY + 10, { continued: true })
        .text(`   Semester GPA: ${semester.semesterGPA.toFixed(2)}`, { align: 'right' })
        .moveDown(1.5);
    });

    // Summary Section
    if (doc.y > 650) {
      doc.addPage();
    }

    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('ACADEMIC SUMMARY', 70, doc.y)
      .moveDown(0.5);

    // Add underline
    doc.moveTo(70, doc.y)
      .lineTo(300, doc.y)
      .stroke('#3b82f6');

    doc.moveDown(0.5);

    // Summary table
    const summaryData = [
      ['Total Credits Attempted:', cumulativeCredits.toString()],
      ['Total Credits Earned:', cumulativeCredits.toString()], // Assuming all attempted are earned for now
      ['Cumulative GPA (CGPA):', cgpa.toFixed(2)],
      ['Academic Standing:', student.probation ? 'PROBATION' : student.dismissed ? 'DISMISSED' : 'GOOD STANDING']
    ];

    summaryData.forEach(([label, value]) => {
      doc.fontSize(11)
        .font('Helvetica')
        .fillColor('#374151')
        .text(label, 70, doc.y, { width: 200, continued: true })
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text(value)
        .moveDown(0.5);
    });

    // Official certification
    doc.moveDown(2)
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('CERTIFICATION', { align: 'center' })
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#374151')
      .text('This is to certify that this is the official transcript of the above-named student at ATTC University. Given under the seal of the university and the signature of the authorized officer.', { align: 'center' })
      .moveDown(2);

    // Signature line
    doc.moveTo(200, doc.y)
      .lineTo(400, doc.y)
      .stroke('#000000');

    doc.moveDown(0.5)
      .fontSize(10)
      .text('Registrar, ATTC University', { align: 'center' })
      .moveDown(0.5)
      .text(`Date of Issue: ${new Date().toLocaleDateString()}`, { align: 'center' });

    // Footer
    doc.fontSize(8)
      .fillColor('#6b7280')
      .text('This document is not valid if it has been altered in any way.', 70, doc.page.height - 100)
      .text('ATTC University Academic Management System', 70, doc.page.height - 85)
      .text(`Document ID: ${student.studentId}-${Date.now()}`, 70, doc.page.height - 70);

    // Add page numbers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
        .fillColor('#6b7280')
        .text(`Page ${i + 1} of ${pageCount}`, 70, doc.page.height - 50, { align: 'center' });
    }

    // Finalize PDF
    doc.end();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${student.firstName} ${student.fatherName}`,
      actorRole: 'student',
      action: 'DATA_EXPORT',
      targetId: student._id,
      targetModel: 'User',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'low',
      details: {
        documentType: 'Official Transcript',
        generatedAt: new Date(),
        totalCourses: grades.length,
        cgpa: cgpa
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`📄 Transcript PDF generated: ${filename} for ${student.firstName} ${student.fatherName}`);

  } catch (error) {
    console.error('Generate transcript error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate transcript',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Generate transcript for registrar (admin use)
// @route   GET /api/transcript/admin/:studentId
// @access  Private (Registrar only)
export const generateTranscriptForAdmin = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student details
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get all finalized grades
    const grades = await Grade.find({
      studentId: studentId,
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
          semesterGradePoints: 0,
          semesterGPA: 0
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

    // Calculate semester GPAs
    Object.keys(transcript).forEach(key => {
      const semester = transcript[key];
      semester.semesterGPA = semester.semesterCredits > 0 ?
        Math.round((semester.semesterGradePoints / semester.semesterCredits) * 100) / 100 : 0;
    });

    const cgpa = cumulativeCredits > 0 ?
      Math.round((cumulativeGradePoints / cumulativeCredits) * 100) / 100 : 0;

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

    // Generate filename
    const filename = `${student.firstName}_${student.fatherName}_Official_Transcript_Admin.pdf`;
    const filepath = path.join(uploadsDir, filename);

    // Pipe PDF to file and response
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    doc.pipe(res);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Add university header with logo
    doc.fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#1e40af')
      .text('ATTC UNIVERSITY', { align: 'center' })
      .fontSize(18)
      .fillColor('#374151')
      .text('OFFICIAL ACADEMIC TRANSCRIPT', { align: 'center' })
      .moveDown(0.5)
      .fontSize(12)
      .fillColor('#ef4444')
      .text('REGISTRAR COPY', { align: 'center' })
      .moveDown(1.5);

    // Add border
    doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
      .stroke('#e5e7eb');

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
      ['Department:', student.department || 'Freshman'],
      ['Current Year:', `Year ${student.currentYear}`],
      ['Current Semester:', `Semester ${student.currentSemester}`],
      ['Enrollment Year:', student.enrollmentYear?.toString() || 'N/A'],
      ['Status:', student.status?.toUpperCase() || 'ACTIVE']
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

    // Academic Record Section
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('ACADEMIC RECORD', 70, doc.y)
      .moveDown(0.5);

    // Add underline
    doc.moveTo(70, doc.y)
      .lineTo(300, doc.y)
      .stroke('#3b82f6');

    doc.moveDown(1);

    // Semester-by-semester grades
    Object.values(transcript).forEach((semester, index) => {
      // Add page break if needed
      if (doc.y > 650 && index > 0) {
        doc.addPage();
      }

      doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text(`${semester.academicYear} - Semester ${semester.semester}`, 70, doc.y)
        .moveDown(0.5);

      // Table headers
      const tableTop = doc.y;
      const tableLeft = 70;
      const colWidths = [80, 220, 50, 60, 60];

      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#374151');

      // Header background
      doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), 20)
        .fill('#f3f4f6');

      // Header text
      doc.fillColor('#1f2937')
        .text('Course Code', tableLeft + 5, tableTop + 5, { width: colWidths[0] })
        .text('Course Name', tableLeft + colWidths[0] + 5, tableTop + 5, { width: colWidths[1] })
        .text('Credits', tableLeft + colWidths[0] + colWidths[1] + 5, tableTop + 5, { width: colWidths[2] })
        .text('Grade', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableTop + 5, { width: colWidths[3] })
        .text('Points', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, tableTop + 5, { width: colWidths[4] });

      // Course rows
      let currentY = tableTop + 20;

      semester.courses.forEach((course, i) => {
        // Alternate row colors
        if (i % 2 === 0) {
          doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b, 0), 20)
            .fill('#f9fafb');
        }

        doc.fillColor('#1f2937')
          .font('Helvetica')
          .fontSize(9)
          .text(course.courseCode, tableLeft + 5, currentY + 5, { width: colWidths[0] })
          .text(course.courseName.length > 35 ? course.courseName.substring(0, 32) + '...' : course.courseName,
            tableLeft + colWidths[0] + 5, currentY + 5, { width: colWidths[1] })
          .text(course.credit.toString(), tableLeft + colWidths[0] + colWidths[1] + 5, currentY + 5, { width: colWidths[2] })
          .text(course.letterGrade, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, currentY + 5, { width: colWidths[3] })
          .text(course.gradePoints.toString(), tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, currentY + 5, { width: colWidths[4] });

        currentY += 20;
      });

      // Table border
      doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), currentY - tableTop)
        .stroke('#d1d5db');

      // Semester summary
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text(`Semester Credits: ${semester.semesterCredits}`, tableLeft, currentY + 10, { continued: true })
        .text(`   Semester GPA: ${semester.semesterGPA.toFixed(2)}`, { align: 'right' })
        .moveDown(1.5);
    });

    // Summary Section
    if (doc.y > 650) {
      doc.addPage();
    }

    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('ACADEMIC SUMMARY', 70, doc.y)
      .moveDown(0.5);

    // Add underline
    doc.moveTo(70, doc.y)
      .lineTo(300, doc.y)
      .stroke('#3b82f6');

    doc.moveDown(0.5);

    // Summary table
    const summaryData = [
      ['Total Credits Attempted:', cumulativeCredits.toString()],
      ['Total Credits Earned:', cumulativeCredits.toString()], // Assuming all attempted are earned for now
      ['Cumulative GPA (CGPA):', cgpa.toFixed(2)],
      ['Academic Standing:', student.probation ? 'PROBATION' : student.dismissed ? 'DISMISSED' : 'GOOD STANDING']
    ];

    summaryData.forEach(([label, value]) => {
      doc.fontSize(11)
        .font('Helvetica')
        .fillColor('#374151')
        .text(label, 70, doc.y, { width: 200, continued: true })
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text(value)
        .moveDown(0.5);
    });

    // Official certification
    doc.moveDown(2)
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('CERTIFICATION', { align: 'center' })
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#374151')
      .text('This is to certify that this is the official transcript of the above-named student at ATTC University. Given under the seal of the university and the signature of the authorized officer.', { align: 'center' })
      .moveDown(2);

    // Signature line
    doc.moveTo(200, doc.y)
      .lineTo(400, doc.y)
      .stroke('#000000');

    doc.moveDown(0.5)
      .fontSize(10)
      .text('Registrar, ATTC University', { align: 'center' })
      .moveDown(0.5)
      .text(`Date of Issue: ${new Date().toLocaleDateString()}`, { align: 'center' });

    // Admin watermark
    doc.fontSize(60)
      .fillColor('rgba(239, 68, 68, 0.1)')
      .text('REGISTRAR COPY', 100, 350, {
        align: 'center',
        oblique: true
      });

    // Footer
    doc.fontSize(8)
      .fillColor('#6b7280')
      .text('This document is not valid if it has been altered in any way.', 70, doc.page.height - 100)
      .text('ATTC University Academic Management System', 70, doc.page.height - 85)
      .text(`Document ID: ${student.studentId}-${Date.now()}-ADMIN`, 70, doc.page.height - 70);

    // Add page numbers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
        .fillColor('#6b7280')
        .text(`Page ${i + 1} of ${pageCount}`, 70, doc.page.height - 50, { align: 'center' });
    }

    // Finalize PDF
    doc.end();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'DATA_EXPORT',
      targetId: student._id,
      targetModel: 'User',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'low',
      details: {
        documentType: 'Official Transcript (Admin)',
        generatedAt: new Date(),
        totalCourses: grades.length,
        cgpa: cgpa,
        generatedBy: req.user.id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`📄 Admin Transcript PDF generated: ${filename} for ${student.firstName} ${student.fatherName} by ${req.user.firstName} ${req.user.fatherName}`);

  } catch (error) {
    console.error('Generate admin transcript error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate transcript',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};