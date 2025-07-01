import dotenv from 'dotenv';

dotenv.config();

const FILE_SIZE_LIMIT = parseInt(process.env.MAX_FILE_SIZE, 10) || 1048576; // Default 1MB

export function handleUploadErrors(err, req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File size should not exceed ${FILE_SIZE_LIMIT} bytes.`,
    });
  }
  next(err);
}