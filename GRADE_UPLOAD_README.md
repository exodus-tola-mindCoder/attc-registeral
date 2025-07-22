# Excel Grade Upload Feature

## Overview

This feature allows instructors to upload student grades in bulk using Excel files. The system provides a secure, validated, and user-friendly way to manage grades for multiple students at once.

## Features

- ✅ **Excel Template Download**: Pre-filled templates with student information
- ✅ **Bulk Grade Upload**: Upload grades for multiple students at once
- ✅ **Real-time Validation**: Validate grades, student IDs, and course IDs
- ✅ **Progress Tracking**: Visual progress bar during upload
- ✅ **Error Handling**: Detailed error reporting for failed uploads
- ✅ **Success Feedback**: Summary of uploaded grades with statistics
- ✅ **Security**: Authentication and role-based access control
- ✅ **Memory Storage**: Secure file handling without disk storage

## API Endpoints

### 1. Upload Grades
```
POST /api/grades/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Form Data:**
- `file`: Excel file (.xlsx or .xls)
- `courseId`: Course ID
- `academicYear`: Academic year (e.g., "2024")
- `semester`: Semester number (1 or 2)

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed 25 grades",
  "data": {
    "totalProcessed": 25,
    "successCount": 23,
    "updateCount": 5,
    "createCount": 18,
    "grades": [...],
    "errors": [...]
  },
  "summary": {
    "totalRows": 25,
    "validRows": 23,
    "successRate": 92.0
  }
}
```

### 2. Download Template
```
GET /api/grades/template/:courseId?academicYear=2024&semester=1
Authorization: Bearer <token>
```

**Response:** Excel file download

### 3. Upload History
```
GET /api/grades/upload-history?page=1&limit=10
Authorization: Bearer <token>
```

## Excel File Format

The Excel file should have the following columns:

| Column | Header | Description | Validation |
|--------|--------|-------------|------------|
| A | Row | Row number | Auto-generated |
| B | Student ID | Student's unique ID | Must exist in database |
| C | Course ID | Course's unique ID | Must exist in database |
| D | Midterm Mark (0-30) | Midterm exam score | 0-30 points |
| E | Continuous Mark (0-30) | Continuous assessment | 0-30 points |
| F | Final Exam Mark (0-40) | Final exam score | 0-40 points |
| G | Total Mark (Auto-calculated) | Total score | Auto-calculated |
| H | Student Name | Student's full name | Display only |

## Grade Validation Rules

- **Midterm Mark**: 0-30 points
- **Continuous Mark**: 0-30 points  
- **Final Exam Mark**: 0-40 points
- **Total Mark**: Automatically calculated (Midterm + Continuous + Final)
- **Student ID**: Must exist and be active in the system
- **Course ID**: Must exist in the system

## React Component Usage

```tsx
import GradeUploadForm from './components/GradeUploadForm';

// Basic usage
<GradeUploadForm 
  courseId="course_id_here"
  courseCode="CS101"
  courseName="Introduction to Computer Science"
  academicYear="2024"
  semester={1}
/>

// With default values
<GradeUploadForm 
  courseId="course_id_here"
  courseCode="CS101"
  courseName="Introduction to Computer Science"
/>
```

## Integration Example

```tsx
import React, { useState } from 'react';
import GradeUploadForm from './components/GradeUploadForm';

const InstructorDashboard = () => {
  const [selectedCourse, setSelectedCourse] = useState(null);

  return (
    <div>
      <h1>Grade Management</h1>
      
      {/* Course Selection */}
      <select onChange={(e) => setSelectedCourse(e.target.value)}>
        <option value="">Select a course</option>
        <option value="course1">CS101 - Introduction to Computer Science</option>
        <option value="course2">MATH101 - Calculus I</option>
      </select>

      {/* Grade Upload Form */}
      {selectedCourse && (
        <GradeUploadForm
          courseId={selectedCourse}
          courseCode="CS101"
          courseName="Introduction to Computer Science"
          academicYear="2024"
          semester={1}
        />
      )}
    </div>
  );
};
```

## Security Features

1. **Authentication Required**: All endpoints require valid JWT token
2. **Role-Based Access**: Only instructors can upload grades
3. **File Validation**: Only Excel files (.xlsx, .xls) accepted
4. **File Size Limit**: Maximum 5MB per file
5. **Memory Storage**: Files processed in memory, not saved to disk
6. **Input Validation**: All data validated before database operations

## Error Handling

The system provides detailed error messages for:

- Invalid file format
- Missing required fields
- Invalid grade values
- Non-existent students
- Non-existent courses
- Database errors
- File size exceeded

## Database Schema Updates

The Grade model has been updated to include approval flags:

```javascript
// New fields added to Grade schema
isApprovedByDeptHead: {
  type: Boolean,
  default: false
},
isApprovedByRegistrar: {
  type: Boolean,
  default: false
}
```

## File Structure

```
server/
├── controllers/
│   └── gradeUploadController.js    # Main upload logic
├── middleware/
│   └── gradeUploadMiddleware.js    # File upload middleware
├── routes/
│   └── gradeUploadRoutes.js        # API routes
└── models/
    └── Grade.model.js              # Updated schema

src/
└── components/
    ├── GradeUploadForm.tsx         # Main React component
    └── GradeManagement.tsx         # Integration example
```

## Installation & Setup

1. **Dependencies**: Ensure these packages are installed:
   ```bash
   npm install exceljs multer
   ```

2. **Server Integration**: The routes are automatically mounted in `server.js`

3. **Frontend Integration**: Import and use the `GradeUploadForm` component

## Testing

1. **Download Template**: Test template download for a course
2. **Fill Template**: Add sample grades to the template
3. **Upload File**: Test the upload functionality
4. **Verify Results**: Check the database for uploaded grades
5. **Error Testing**: Test with invalid files and data

## Troubleshooting

### Common Issues

1. **"No file uploaded"**: Ensure file input is properly configured
2. **"Invalid file type"**: Check file extension and MIME type
3. **"Student not found"**: Verify student IDs exist in the database
4. **"Course not found"**: Verify course ID exists in the database
5. **"Upload failed"**: Check server logs for detailed error messages

### Debug Mode

Enable debug logging by setting:
```javascript
console.log('Upload details:', {
  file: req.file,
  body: req.body,
  user: req.user
});
```

## Performance Considerations

- **Batch Processing**: Grades are processed in batches of 50
- **Memory Usage**: Files are processed in memory (max 5MB)
- **Database Optimization**: Uses efficient queries and indexing
- **Progress Tracking**: Real-time upload progress feedback

## Future Enhancements

- [ ] Support for multiple file formats
- [ ] Grade import from other systems
- [ ] Bulk grade approval workflow
- [ ] Grade history and audit trail
- [ ] Advanced validation rules
- [ ] Email notifications for uploads 