import User from '../models/User.model.js';
import AuditLog from '../models/AuditLog.model.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { createNotification } from '../utils/notificationUtils.js';

// Ensure uploads directory exists
const uploadsDir = 'uploads/student-ids';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// @desc    Generate student ID card
// @route   GET /api/student-id/generate/:studentId
// @access  Private (Student, IT Admin, Registrar)
export const generateStudentID = async (req, res) => {
  try {
    const { studentId } = req.params;

    // If student is requesting their own ID
    const targetStudentId = req.user.role === 'student' ? req.user.id : studentId;

    // Security check - students can only generate their own ID
    if (req.user.role === 'student' && targetStudentId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only generate your own student ID'
      });
    }

    const student = await User.findById(targetStudentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Generate QR code
    const verificationUrl = `${process.env.CLIENT_URL || 'https://attc.edu.et'}/verify/${student.studentId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);
    const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

    // Generate PDF
    const doc = new PDFDocument({
      size: [242.6, 153], // 85.6mm x 54mm (standard ID card size)
      margin: 10,
      info: {
        Title: `Student ID - ${student.firstName} ${student.fatherName}`,
        Author: 'ATTC University',
        Subject: 'Student Identification Card',
        Keywords: 'student, id, card, identification',
        Creator: 'ATTC Academic Management System'
      }
    });

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${student.firstName}_${student.fatherName}_ID_${timestamp}.pdf`;
    const filepath = path.join(uploadsDir, filename);

    // Pipe PDF to file and response
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    doc.pipe(res);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Add border
    doc.rect(0, 0, doc.page.width, doc.page.height).stroke('#1e40af');

    // Add college logo at the top
    doc.circle(doc.page.width / 2, 25, 15)
      .fillAndStroke('#1e40af', '#1e40af');

    doc.fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('ATTC', doc.page.width / 2 - 12, 21);

    // University name
    doc.moveDown(0.5)
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#1e40af')
      .text('ATTC UNIVERSITY', { align: 'center' })
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#374151')
      .text('Student Identification Card', { align: 'center' })
      .moveDown(0.5);

    // Student photo placeholder (left side)
    // In a real implementation, you would use the student's actual photo
    doc.rect(15, 50, 60, 75)
      .stroke('#d1d5db');

    if (student.photoUrl) {
      try {
        // If student has uploaded a photo, use it
        doc.image(student.photoUrl, 15, 50, { width: 60, height: 75 });
      } catch (error) {
        // If there's an error loading the image, use placeholder text
        doc.fontSize(8)
          .text('PHOTO', 35, 80);
      }
    } else {
      // Placeholder text if no photo
      doc.fontSize(8)
        .text('PHOTO', 35, 80);
    }

    // Student information (right side)
    doc.fontSize(8)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('Name:', 85, 50)
      .font('Helvetica')
      .text(`${student.firstName} ${student.fatherName} ${student.grandfatherName}`, 85, 60, { width: 140 })

      .font('Helvetica-Bold')
      .text('ID Number:', 85, 75)
      .font('Helvetica')
      .text(student.studentId, 85, 85)

      .font('Helvetica-Bold')
      .text('Department:', 85, 95)
      .font('Helvetica')
      .text(student.department || 'Freshman', 85, 105)

      .font('Helvetica-Bold')
      .text('Academic Year:', 85, 115)
      .font('Helvetica')
      .text(`Year ${student.currentYear}, Semester ${student.currentSemester}`, 85, 125);

    // QR code (bottom right)
    doc.image(qrCodeBuffer, 170, 85, { width: 50, height: 50 });

    // Issue date and expiry date
    const issueDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 4); // Valid for 4 years

    doc.fontSize(6)
      .fillColor('#6b7280')
      .text(`Issue Date: ${issueDate.toLocaleDateString()}`, 15, 135)
      .text(`Valid Until: ${expiryDate.toLocaleDateString()}`, 15, 143);

    // Update student record with ID card information
    student.idCardIssuedAt = issueDate;
    student.idCardStatus = 'Active';
    await student.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'STUDENT_ID_GENERATED',
      targetId: student._id,
      targetModel: 'User',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'low',
      details: {
        studentId: student.studentId,
        issueDate: issueDate.toISOString(),
        expiryDate: expiryDate.toISOString()
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Finalize PDF
    doc.end();

    console.log(`📇 Student ID generated: ${filename} for ${student.firstName} ${student.fatherName}`);

  } catch (error) {
    console.error('Generate student ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate student ID',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Bulk generate student IDs
// @route   POST /api/student-id/bulk-generate
// @access  Private (IT Admin, Registrar)
export const bulkGenerateStudentIDs = async (req, res) => {
  try {
    const { department, year, semester } = req.body;

    // Build query
    const query = { role: 'student' };

    if (department) query.department = department;
    if (year) query.currentYear = parseInt(year);
    if (semester) query.currentSemester = parseInt(semester);

    // Find students
    const students = await User.find(query);

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found matching the criteria'
      });
    }

    // Create a zip file to store all PDFs
    const archiver = require('archiver');
    const zipFilename = `student_ids_${department || 'all'}_${Date.now()}.zip`;
    const zipFilepath = path.join(uploadsDir, zipFilename);
    const output = fs.createWriteStream(zipFilepath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });

    // Listen for all archive data to be written
    output.on('close', function () {
      console.log(`📦 Archive created: ${zipFilepath} (${archive.pointer()} bytes)`);

      // Send the zip file
      res.download(zipFilepath, zipFilename, (err) => {
        if (err) {
          console.error('Error sending zip file:', err);
        }

        // Delete the zip file after sending
        fs.unlink(zipFilepath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting zip file:', unlinkErr);
        });
      });
    });

    archive.on('error', function (err) {
      console.error('Archive error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to create archive of student IDs'
      });
    });

    // Pipe archive data to the output file
    archive.pipe(output);

    // Generate IDs for each student
    for (const student of students) {
      // Generate QR code
      const verificationUrl = `${process.env.CLIENT_URL || 'https://attc.edu.et'}/verify/${student.studentId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);
      const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

      // Generate PDF
      const doc = new PDFDocument({
        size: [242.6, 153], // 85.6mm x 54mm (standard ID card size)
        margin: 10
      });

      // Generate filename
      const filename = `${student.firstName}_${student.fatherName}_ID.pdf`;
      const filepath = path.join(uploadsDir, filename);

      // Pipe PDF to file
      const pdfStream = fs.createWriteStream(filepath);
      doc.pipe(pdfStream);

      // Add border
      doc.rect(0, 0, doc.page.width, doc.page.height).stroke('#1e40af');

      // Add college logo at the top
      doc.circle(doc.page.width / 2, 25, 15)
        .fillAndStroke('#1e40af', '#1e40af');

      doc.fillColor('white')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('ATTC', doc.page.width / 2 - 12, 21);

      // University name
      doc.moveDown(0.5)
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e40af')
        .text('ATTC UNIVERSITY', { align: 'center' })
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#374151')
        .text('Student Identification Card', { align: 'center' })
        .moveDown(0.5);

      // Student photo placeholder (left side)
      doc.rect(15, 50, 60, 75)
        .stroke('#d1d5db');

      if (student.photoUrl) {
        try {
          // If student has uploaded a photo, use it
          doc.image(student.photoUrl, 15, 50, { width: 60, height: 75 });
        } catch (error) {
          // If there's an error loading the image, use placeholder text
          doc.fontSize(8)
            .text('PHOTO', 35, 80);
        }
      } else {
        // Placeholder text if no photo
        doc.fontSize(8)
          .text('PHOTO', 35, 80);
      }

      // Student information (right side)
      doc.fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text('Name:', 85, 50)
        .font('Helvetica')
        .text(`${student.firstName} ${student.fatherName} ${student.grandfatherName}`, 85, 60, { width: 140 })

        .font('Helvetica-Bold')
        .text('ID Number:', 85, 75)
        .font('Helvetica')
        .text(student.studentId, 85, 85)

        .font('Helvetica-Bold')
        .text('Department:', 85, 95)
        .font('Helvetica')
        .text(student.department || 'Freshman', 85, 105)

        .font('Helvetica-Bold')
        .text('Academic Year:', 85, 115)
        .font('Helvetica')
        .text(`Year ${student.currentYear}, Semester ${student.currentSemester}`, 85, 125);

      // QR code (bottom right)
      doc.image(qrCodeBuffer, 170, 85, { width: 50, height: 50 });

      // Issue date and expiry date
      const issueDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 4); // Valid for 4 years

      doc.fontSize(6)
        .fillColor('#6b7280')
        .text(`Issue Date: ${issueDate.toLocaleDateString()}`, 15, 135)
        .text(`Valid Until: ${expiryDate.toLocaleDateString()}`, 15, 143);

      // Finalize PDF
      doc.end();

      // Wait for PDF to be created
      await new Promise((resolve) => {
        pdfStream.on('finish', () => {
          // Add PDF to archive
          archive.file(filepath, { name: filename });

          // Update student record
          student.idCardIssuedAt = issueDate;
          student.idCardStatus = 'Active';
          student.save();

          // Delete the individual PDF file
          fs.unlink(filepath, (err) => {
            if (err) console.error('Error deleting PDF file:', err);
          });

          resolve();
        });
      });
    }

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'BULK_STUDENT_ID_GENERATED',
      category: 'data_modification',
      severity: 'medium',
      details: {
        department,
        year,
        semester,
        studentCount: students.length
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Finalize the archive
    archive.finalize();

  } catch (error) {
    console.error('Bulk generate student IDs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk generate student IDs',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Upload student photo
// @route   POST /api/student-id/upload-photo
// @access  Private (Student only)
export const uploadStudentPhoto = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Photo is required'
      });
    }

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Update student with photo
    student.photoUrl = req.file.path;
    await student.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${student.firstName} ${student.fatherName}`,
      actorRole: 'student',
      action: 'STUDENT_PHOTO_UPLOADED',
      targetId: student._id,
      targetModel: 'User',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'low',
      details: {
        photoPath: req.file.path
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        photoUrl: student.photoUrl
      }
    });

  } catch (error) {
    console.error('Upload student photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload photo',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Deactivate student ID
// @route   PUT /api/student-id/deactivate/:studentId
// @access  Private (IT Admin, Registrar)
export const deactivateStudentID = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { reason } = req.body;

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Update student ID status
    student.idCardStatus = 'Inactive';
    await student.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'STUDENT_ID_DEACTIVATED',
      targetId: student._id,
      targetModel: 'User',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        reason
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send notification to student
    try {
      await createNotification({
        recipientId: student._id,
        title: 'Student ID Deactivated',
        message: `Your student ID has been deactivated. Reason: ${reason || 'No reason provided'}. Please contact the registrar office.`,
        type: 'Warning',
        link: '/profile',
        sourceType: 'system',
        sourceId: student._id,
        sourceModel: 'User',
        createdBy: req.user.id
      });
    } catch (notificationError) {
      console.error('ID deactivation notification error:', notificationError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Student ID deactivated successfully',
      data: {
        studentId: student._id,
        studentName: `${student.firstName} ${student.fatherName}`,
        idCardStatus: student.idCardStatus
      }
    });

  } catch (error) {
    console.error('Deactivate student ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate student ID',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Verify student ID
// @route   GET /api/verify/:studentIdNumber
// @access  Public
export const verifyStudentID = async (req, res) => {
  try {
    const { studentIdNumber } = req.params;

    const student = await User.findOne({ studentId: studentIdNumber });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student ID not found'
      });
    }

    // Return basic verification information
    res.status(200).json({
      success: true,
      message: 'Student ID verified successfully',
      data: {
        name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
        studentId: student.studentId,
        department: student.department || 'Freshman',
        status: student.status,
        isActive: student.idCardStatus === 'Active',
        isGraduated: student.isGraduated || false
      }
    });

  } catch (error) {
    console.error('Verify student ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify student ID',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get student ID status
// @route   GET /api/student-id/status
// @access  Private (Student only)
export const getStudentIDStatus = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Student ID status retrieved successfully',
      data: {
        studentId: student.studentId,
        idCardStatus: student.idCardStatus || 'Not Generated',
        idCardIssuedAt: student.idCardIssuedAt,
        photoUrl: student.photoUrl,
        hasPhoto: !!student.photoUrl
      }
    });

  } catch (error) {
    console.error('Get student ID status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student ID status',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};