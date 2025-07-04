import { processExcelImport } from '../utils/excelImportUtils.js';
import { cleanupExcelFile } from '../middleware/excelUploadMiddleware.js';
import fs from 'fs';

// @desc    Import senior students from Excel file
// @route   POST /api/admin/import-seniors
// @access  Private (IT Admin only)
export const importSeniorStudents = async (req, res) => {
  let filePath = null;

  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required for import'
      });
    }

    filePath = req.file.path;

    console.log(`📊 Starting Excel import from: ${req.file.originalname}`);
    console.log(`📁 File path: ${filePath}`);

    // Process the Excel file
    const importResults = await processExcelImport(filePath);

    // Clean up the uploaded file
    cleanupExcelFile(filePath);

    // Log import summary
    console.log(`✅ Import completed:`);
    console.log(`   📋 Total rows processed: ${importResults.totalRows}`);
    console.log(`   ✅ Successfully imported: ${importResults.imported}`);
    console.log(`   🔄 Duplicates skipped: ${importResults.duplicates}`);
    console.log(`   ❌ Errors encountered: ${importResults.errors.length}`);

    // Determine response status based on results
    const hasErrors = importResults.errors.length > 0;
    const hasImports = importResults.imported > 0;

    let status = 200;
    let message = '';

    if (hasImports && !hasErrors) {
      message = `Successfully imported ${importResults.imported} senior students`;
    } else if (hasImports && hasErrors) {
      status = 207; // Multi-status
      message = `Partially successful: ${importResults.imported} imported with ${importResults.errors.length} errors`;
    } else if (!hasImports && hasErrors) {
      status = 400;
      message = `Import failed: No students imported due to errors`;
    } else {
      status = 400;
      message = 'No valid student data found in the Excel file';
    }

    res.status(status).json({
      success: hasImports,
      message,
      data: {
        summary: {
          totalRows: importResults.totalRows,
          processed: importResults.processed,
          imported: importResults.imported,
          duplicates: importResults.duplicates,
          errorCount: importResults.errors.length
        },
        errors: importResults.errors,
        // Include temp passwords for admin reference (first 10 only for security)
        tempPasswords: importResults.tempPasswords?.slice(0, 10) || [],
        ...(importResults.tempPasswords?.length > 10 && {
          note: `Showing first 10 temporary passwords. Total: ${importResults.tempPasswords.length}`
        })
      }
    });

  } catch (error) {
    console.error('❌ Excel import error:', error);

    // Clean up file in case of error
    if (filePath) {
      cleanupExcelFile(filePath);
    }

    // Handle specific error types
    if (error.message.includes('Missing required columns')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Excel format: ' + error.message,
        expectedFormat: {
          requiredColumns: [
            'firstName',
            'fatherName',
            'grandfatherName',
            'department',
            'year',
            'semester',
            'studentId'
          ],
          optionalColumns: ['notes'],
          example: {
            firstName: 'John',
            fatherName: 'Doe',
            grandfatherName: 'Smith',
            department: 'Electrical',
            year: 2,
            semester: 1,
            studentId: 'ELE-2023-0001',
            notes: 'Transfer student'
          }
        }
      });
    }

    if (error.message.includes('No worksheet found')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Excel file: No worksheet found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Import failed due to server error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get import template
// @route   GET /api/admin/import-template
// @access  Private (IT Admin only)
export const getImportTemplate = async (req, res) => {
  try {
    const templateData = {
      instructions: [
        '1. Fill in all required columns for each student',
        '2. Department must be one of: Electrical, Manufacturing, Automotive, Construction, ICT',
        '3. Year must be between 2-5 (for senior students)',
        '4. Semester must be 1 or 2',
        '5. Student ID must be unique',
        '6. Names can only contain letters and spaces',
        '7. Save as .xlsx format before uploading'
      ],
      requiredColumns: [
        'firstName',
        'fatherName',
        'grandfatherName',
        'department',
        'year',
        'semester',
        'studentId'
      ],
      optionalColumns: [
        'notes'
      ],
      sampleData: [
        {
          firstName: 'John',
          fatherName: 'Doe',
          grandfatherName: 'Smith',
          department: 'Electrical',
          year: 2,
          semester: 1,
          studentId: 'ELE-2023-0001',
          notes: 'Transfer student'
        },
        {
          firstName: 'Jane',
          fatherName: 'Wilson',
          grandfatherName: 'Brown',
          department: 'Manufacturing',
          year: 3,
          semester: 2,
          studentId: 'MAN-2022-0015',
          notes: ''
        }
      ]
    };

    res.status(200).json({
      success: true,
      message: 'Import template information',
      data: templateData
    });

  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get import template',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};