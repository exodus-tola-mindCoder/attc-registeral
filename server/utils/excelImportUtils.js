import ExcelJS from 'exceljs';
import User from '../models/User.model.js';

// Validate Excel file structure
export const validateExcelStructure = (worksheet) => {
  const requiredColumns = [
    'firstName',
    'fatherName', 
    'grandfatherName',
    'department',
    'year',
    'semester',
    'studentId'
  ];

  const headerRow = worksheet.getRow(1);
  const headers = [];
  
  headerRow.eachCell((cell, colNumber) => {
    headers.push(cell.value?.toString().toLowerCase().replace(/\s+/g, ''));
  });

  const missingColumns = requiredColumns.filter(col => 
    !headers.some(header => header.includes(col.toLowerCase()))
  );

  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  return headers;
};

// Parse Excel row to student data
export const parseStudentRow = (row, headers) => {
  const studentData = {};
  
  row.eachCell((cell, colNumber) => {
    const header = headers[colNumber - 1];
    const value = cell.value?.toString().trim();
    
    if (!value || value === '') return;

    // Map Excel columns to schema fields
    if (header.includes('firstname') || header.includes('first_name')) {
      studentData.firstName = value;
    } else if (header.includes('fathername') || header.includes('father_name')) {
      studentData.fatherName = value;
    } else if (header.includes('grandfathername') || header.includes('grandfather_name')) {
      studentData.grandfatherName = value;
    } else if (header.includes('department')) {
      studentData.department = value;
    } else if (header.includes('year')) {
      studentData.currentYear = parseInt(value);
    } else if (header.includes('semester')) {
      studentData.currentSemester = parseInt(value);
    } else if (header.includes('studentid') || header.includes('student_id')) {
      studentData.studentId = value;
    } else if (header.includes('note') || header.includes('notes')) {
      studentData.notes = value;
    }
  });

  return studentData;
};

// Validate student data
export const validateStudentData = (studentData, rowNumber) => {
  const errors = [];

  // Required fields validation
  if (!studentData.firstName) {
    errors.push(`Row ${rowNumber}: First name is required`);
  }
  if (!studentData.fatherName) {
    errors.push(`Row ${rowNumber}: Father name is required`);
  }
  if (!studentData.grandfatherName) {
    errors.push(`Row ${rowNumber}: Grandfather name is required`);
  }
  if (!studentData.studentId) {
    errors.push(`Row ${rowNumber}: Student ID is required`);
  }

  // Department validation
  const validDepartments = ['Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'];
  if (!studentData.department || !validDepartments.includes(studentData.department)) {
    errors.push(`Row ${rowNumber}: Invalid department. Must be one of: ${validDepartments.join(', ')}`);
  }

  // Year validation
  if (!studentData.currentYear || studentData.currentYear < 2 || studentData.currentYear > 5) {
    errors.push(`Row ${rowNumber}: Invalid year. Must be between 2-5 for senior students`);
  }

  // Semester validation
  if (!studentData.currentSemester || ![1, 2].includes(studentData.currentSemester)) {
    errors.push(`Row ${rowNumber}: Invalid semester. Must be 1 or 2`);
  }

  // Name format validation
  const nameRegex = /^[a-zA-Z\s]+$/;
  if (studentData.firstName && !nameRegex.test(studentData.firstName)) {
    errors.push(`Row ${rowNumber}: First name can only contain letters and spaces`);
  }
  if (studentData.fatherName && !nameRegex.test(studentData.fatherName)) {
    errors.push(`Row ${rowNumber}: Father name can only contain letters and spaces`);
  }
  if (studentData.grandfatherName && !nameRegex.test(studentData.grandfatherName)) {
    errors.push(`Row ${rowNumber}: Grandfather name can only contain letters and spaces`);
  }

  return errors;
};

// Process Excel file and import students
export const processExcelImport = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.getWorksheet(1); // First worksheet
  
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  // Validate structure
  const headers = validateExcelStructure(worksheet);
  
  const results = {
    totalRows: 0,
    processed: 0,
    imported: 0,
    duplicates: 0,
    errors: []
  };

  const studentsToImport = [];
  const tempPasswords = new Map(); // Store temp passwords for reporting

  // Process each row (skip header row)
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    
    // Skip empty rows
    if (row.hasValues) {
      results.totalRows++;
      
      try {
        const studentData = parseStudentRow(row, headers);
        
        // Validate student data
        const validationErrors = validateStudentData(studentData, rowNumber);
        if (validationErrors.length > 0) {
          results.errors.push(...validationErrors);
          continue;
        }

        // Check for duplicate student ID
        const existingStudent = await User.findOne({ studentId: studentData.studentId });
        if (existingStudent) {
          results.duplicates++;
          results.errors.push(`Row ${rowNumber}: Student ID ${studentData.studentId} already exists`);
          continue;
        }

        // Generate institutional email
        const email = await User.generateInstitutionalEmail(
          studentData.firstName, 
          studentData.fatherName
        );

        // Generate temporary password
        const tempPassword = User.generateTempPassword();
        tempPasswords.set(studentData.studentId, tempPassword);

        // Prepare student document
        const studentDoc = {
          ...studentData,
          email,
          password: tempPassword,
          role: 'student',
          mustChangePassword: true,
          enrollmentYear: new Date().getFullYear() - (studentData.currentYear - 1),
          importedAt: new Date(),
          status: 'active'
        };

        studentsToImport.push(studentDoc);
        results.processed++;

      } catch (error) {
        results.errors.push(`Row ${rowNumber}: ${error.message}`);
      }
    }
  }

  // Bulk insert students
  if (studentsToImport.length > 0) {
    try {
      const insertedStudents = await User.insertMany(studentsToImport, { ordered: false });
      results.imported = insertedStudents.length;
      
      // Add temp passwords to results for admin reference
      results.tempPasswords = Array.from(tempPasswords.entries()).map(([studentId, password]) => ({
        studentId,
        tempPassword: password
      }));
      
    } catch (error) {
      // Handle partial inserts
      if (error.writeErrors) {
        results.imported = studentsToImport.length - error.writeErrors.length;
        error.writeErrors.forEach(writeError => {
          results.errors.push(`Insert error: ${writeError.errmsg}`);
        });
      } else {
        throw error;
      }
    }
  }

  return results;
};