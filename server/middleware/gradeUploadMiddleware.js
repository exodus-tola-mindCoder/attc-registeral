import multer from 'multer';

// Use memory storage for better security and automatic cleanup
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check file mimetype for Excel files
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.originalname.endsWith('.xlsx') ||
    file.originalname.endsWith('.xls')) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
  }
};

// Configure multer with limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only allow 1 file
  }
});

export default upload;
