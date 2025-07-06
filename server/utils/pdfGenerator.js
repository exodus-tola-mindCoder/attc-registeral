import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Ensure uploads directory exists
const uploadsDir = 'uploads/registration-slips';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const generateRegistrationSlip = async (registration, student) => {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      // Generate filename
      const filename = `registration-slip-${registration.registrationNumber}.pdf`;
      const filepath = path.join(uploadsDir, filename);

      // Pipe PDF to file
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20)
        .font('Helvetica-Bold')
        .text('ATTC', { align: 'center' })
        .fontSize(16)
        .text('COURSE REGISTRATION SLIP', { align: 'center' })
        .moveDown(2);

      // Registration Information
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text('REGISTRATION INFORMATION', { underline: true })
        .moveDown(0.5);

      doc.font('Helvetica')
        .text(`Registration Number: ${registration.registrationNumber}`)
        .text(`Registration Date: ${new Date(registration.registrationDate).toLocaleDateString()}`)
        .text(`Academic Year: ${registration.academicYear}`)
        .text(`Status: ${registration.status.toUpperCase()}`)
        .moveDown(1);

      // Student Information
      doc.font('Helvetica-Bold')
        .text('STUDENT INFORMATION', { underline: true })
        .moveDown(0.5);

      doc.font('Helvetica')
        .text(`Name: ${student.firstName} ${student.fatherName} ${student.grandfatherName}`)
        .text(`Student ID: ${student.studentId}`)
        .text(`Email: ${student.email}`)
        .text(`Department: ${registration.department}`)
        .text(`Year: ${registration.year}`)
        .text(`Semester: ${registration.semester}`)
        .moveDown(1);

      // Course Information
      doc.font('Helvetica-Bold')
        .text('REGISTERED COURSES', { underline: true })
        .moveDown(0.5);

      // Table headers
      const tableTop = doc.y;
      const tableLeft = 50;
      const colWidths = [80, 250, 60, 100];
      let currentY = tableTop;

      // Draw table header
      doc.font('Helvetica-Bold')
        .fontSize(10);

      doc.text('Course Code', tableLeft, currentY, { width: colWidths[0] });
      doc.text('Course Name', tableLeft + colWidths[0], currentY, { width: colWidths[1] });
      doc.text('Credits', tableLeft + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
      doc.text('Reg. Date', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });

      currentY += 20;

      // Draw header line
      doc.moveTo(tableLeft, currentY - 5)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), currentY - 5)
        .stroke();

      // Course rows
      doc.font('Helvetica')
        .fontSize(9);

      registration.courses.forEach((course, index) => {
        if (currentY > 700) { // Start new page if needed
          doc.addPage();
          currentY = 50;
        }

        doc.text(course.courseCode, tableLeft, currentY, { width: colWidths[0] });
        doc.text(course.courseName, tableLeft + colWidths[0], currentY, { width: colWidths[1] });
        doc.text(course.credit.toString(), tableLeft + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
        doc.text(new Date(course.registrationDate).toLocaleDateString(),
          tableLeft + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });

        currentY += 15;
      });

      // Draw bottom line
      doc.moveTo(tableLeft, currentY)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), currentY)
        .stroke();

      currentY += 20;

      // Summary
      doc.font('Helvetica-Bold')
        .fontSize(12)
        .text(`Total Courses: ${registration.courses.length}`, tableLeft, currentY)
        .text(`Total Credits: ${registration.totalCredits}`, tableLeft + 200, currentY)
        .moveDown(2);

      // Footer
      doc.fontSize(10)
        .font('Helvetica')
        .text('This is an official registration document. Keep it for your records.', { align: 'center' })
        .moveDown(1)
        .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' })
        .text('ATTC  Academic Management System', { align: 'center' });

      // Add page border
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke();

      // Finalize PDF
      doc.end();

      // Handle stream events
      stream.on('finish', () => {
        console.log(`📄 Registration slip generated: ${filename}`);
        resolve(filepath);
      });

      stream.on('error', (error) => {
        console.error('PDF generation error:', error);
        reject(error);
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      reject(error);
    }
  });
};

// Utility function to clean up old registration slips
export const cleanupOldSlips = async (daysOld = 30) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;

    for (const file of files) {
      const filepath = path.join(uploadsDir, file);
      const stats = fs.statSync(filepath);

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filepath);
        deletedCount++;
      }
    }

    console.log(`🧹 Cleaned up ${deletedCount} old registration slips`);
    return deletedCount;

  } catch (error) {
    console.error('Cleanup error:', error);
    return 0;
  }
};