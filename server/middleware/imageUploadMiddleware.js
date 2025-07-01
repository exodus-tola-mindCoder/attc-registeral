import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = 'uploads/student-photos';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage for image files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and student ID
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const sanitizedOriginalName = path.basename(file.originalname, fileExtension)
      .replace(/[^a-zA-Z0-9]/g, '_');

    cb(null, `student-photo-${req.user.id}-${uniqueSuffix}${fileExtension}`);
  }
});

// File filter to accept only image files
const fileFilter = (req, file, cb) => {
  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    return cb(new Error('Only image files (.jpg, .jpeg, .png) are allowed'), false);
  }

  // Check MIME type
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Only image files are allowed'), false);
  }

  cb(null, true);
};

// Configure multer for image upload
const uploadImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
    files: 1 // Only one file at a time
  },
  fileFilter: fileFilter
});

// Middleware for handling single image file upload
export const uploadImageFile = uploadImage.single('photo');

// Error handling middleware for image upload
export const handleImageUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Only "photo" field is allowed.'
      });
    }
  }

  if (error.message.includes('Only image files')) {
    return res.status(400).json({
      success: false,
      message: 'Only image files (.jpg, .jpeg, .png) are allowed.'
    });
  }

  // Pass other errors to the global error handler
  next(error);
};

// Utility function to clean up uploaded image file
export const cleanupImageFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Error deleting image file:', filePath, err);
    }
  }
};