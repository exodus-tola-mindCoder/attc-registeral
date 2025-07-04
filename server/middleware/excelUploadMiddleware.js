import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = 'uploads/excel';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage for Excel files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `import-${uniqueSuffix}-${sanitizedOriginalName}`);
  }
});

// File filter to accept only Excel files
const fileFilter = (req, file, cb) => {
  // Check file extension
  const allowedExtensions = ['.xlsx', '.xls'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    return cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
  }

  // Check MIME type
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Only Excel files are allowed'), false);
  }

  cb(null, true);
};

// Configure multer for Excel upload
const uploadExcel = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for Excel files
    files: 1 // Only one file at a time
  },
  fileFilter: fileFilter
});

// Middleware for handling single Excel file upload
export const uploadExcelFile = uploadExcel.single('excelFile');

// Error handling middleware for Excel upload
export const handleExcelUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 50MB.'
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Only "excelFile" field is allowed.'
      });
    }
  }

  if (error.message.includes('Only Excel files')) {
    return res.status(400).json({
      success: false,
      message: 'Only Excel files (.xlsx, .xls) are allowed.'
    });
  }

  // Pass other errors to the global error handler
  next(error);
};

// Utility function to clean up uploaded Excel file
export const cleanupExcelFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Error deleting Excel file:', filePath, err);
    }
  }
};