import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Ensure uploads directory exists
const defaultUploadsDir = 'uploads/transcripts';
if (!fs.existsSync(defaultUploadsDir)) {
  fs.mkdirSync(defaultUploadsDir, { recursive: true });
}

// Configure multer storage
const getStorage = (uploadsDir = defaultUploadsDir) => multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginalName}`);
  }
});

// File filter to accept only PDFs
const fileFilter = (req, file, cb) => {
  // Check file extension
  const allowedExtensions = ['.pdf'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    return cb(new Error('Only PDF files are allowed'), false);
  }

  // Check MIME type
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed'), false);
  }

  cb(null, true);
};

// Configure multer
const FILE_SIZE_LIMIT = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024; // Default 10MB
const upload = multer({
  storage: getStorage(),
  limits: {
    fileSize: FILE_SIZE_LIMIT,
    files: 3 // Maximum 3 files
  },
  fileFilter: fileFilter
});

// Generic PDF upload middleware for custom fields
export function uploadPDFFiles(fields, options = {}) {
  const uploadsDir = options.uploadsDir || defaultUploadsDir;
  const storage = getStorage(uploadsDir);
  const fileSize = options.fileSize || FILE_SIZE_LIMIT;
  return multer({
    storage,
    limits: {
      fileSize,
      files: options.maxFiles || 3
    },
    fileFilter
  }).fields(fields);
}

// Middleware for handling freshman transcript uploads
export const uploadTranscripts = upload.fields([
  { name: 'grade11Transcript', maxCount: 1 },
  { name: 'grade12Transcript', maxCount: 1 },
  { name: 'entranceExamResult', maxCount: 1 }
]);

// Error handling middleware for multer
export const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB per file.'
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 3 files allowed.'
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Only grade11Transcript, grade12Transcript, and entranceExamResult are allowed.'
      });
    }
  }

  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only PDF files are allowed. Please upload valid PDF documents.'
    });
  }

  // Pass other errors to the global error handler
  next(error);
};

// Utility function to clean up uploaded files in case of error
export const cleanupUploadedFiles = (files) => {
  if (!files) return;

  Object.values(files).forEach(fileArray => {
    if (Array.isArray(fileArray)) {
      fileArray.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error deleting file:', file.path, err);
        }
      });
    }
  });
};