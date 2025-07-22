import { body, validationResult } from 'express-validator';

const validDepartments = ['Freshman', 'Electrical', 'Manufacturing', 'Automotive'];

export const validateAddCourses = [
  body('department')
    .exists().withMessage('Department is required')
    .isString().withMessage('Department must be a string')
    .isIn(validDepartments).withMessage(`Department must be one of: ${validDepartments.join(', ')}`),
  body('year')
    .exists().withMessage('Year is required')
    .isInt({ min: 1, max: 5 }).withMessage('Year must be an integer between 1 and 5'),
  body('semester')
    .exists().withMessage('Semester is required')
    .isInt({ min: 1, max: 2 }).withMessage('Semester must be 1 or 2'),
  body('courses')
    .exists().withMessage('Courses array is required')
    .isArray({ min: 1 }).withMessage('Courses must be a non-empty array'),
  body('courses.*.courseCode')
    .exists().withMessage('Course code is required')
    .isString().withMessage('Course code must be a string')
    .matches(/^[A-Z]{2,4}\s\d{4}$/).withMessage('Course code must be in format: ABCD 1234'),
  body('courses.*.courseName')
    .exists().withMessage('Course name is required')
    .isString().withMessage('Course name must be a string')
    .isLength({ max: 200 }).withMessage('Course name cannot exceed 200 characters'),
  body('courses.*.credit')
    .exists().withMessage('Credit is required')
    .isInt({ min: 1, max: 6 }).withMessage('Credit must be an integer between 1 and 6'),
  body('courses.*.description')
    .optional()
    .isString().withMessage('Description must be a string')
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  body('courses.*.prerequisites')
    .optional()
    .isArray().withMessage('Prerequisites must be an array of strings'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
]; 