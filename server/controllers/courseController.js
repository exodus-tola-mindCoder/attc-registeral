import Course from '../models/Course.model.js';


// @desc    Add or update courses for a department/year/semester
// @route   POST /api/depthead/courses
// @access  Private (Department Head only)
export const addCourses = async (req, res) => {
  try {
    const { courses, department, year, semester } = req.body;

    // Validation
    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Courses array is required and must not be empty'
      });
    }

    if (!department || !year || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Department, year, and semester are required'
      });
    }

    // Validate department
    const validDepartments = ['Freshman', 'Electrical', 'Manufacturing', 'Automotive'];
    if (!validDepartments.includes(department)) {
      return res.status(400).json({
        success: false,
        message: `Invalid department. Must be one of: ${validDepartments.join(', ')}`
      });
    }

    // Validate year and semester
    if (year < 1 || year > 5) {
      return res.status(400).json({
        success: false,
        message: 'Year must be between 1-5'
      });
    }

    if (![1, 2].includes(semester)) {
      return res.status(400).json({
        success: false,
        message: 'Semester must be 1 or 2'
      });
    }

    const addedCourses = [];
    const errors = [];

    // Process each course
    for (let i = 0; i < courses.length; i++) {
      const courseData = courses[i];

      try {
        // Validate course data
        if (!courseData.courseCode || !courseData.courseName || !courseData.credit) {
          errors.push(`Course ${i + 1}: Missing required fields (courseCode, courseName, credit)`);
          continue;
        }

        // Check if course already exists
        const existingCourse = await Course.findOne({
          courseCode: courseData.courseCode.toUpperCase(),
          department,
          year,
          semester
        });

        if (existingCourse) {
          // Update existing course
          existingCourse.courseName = courseData.courseName;
          existingCourse.credit = courseData.credit;
          existingCourse.description = courseData.description || '';
          existingCourse.prerequisites = courseData.prerequisites || [];

          await existingCourse.save();
          addedCourses.push(existingCourse);
        } else {
          // Create new course
          const newCourse = new Course({
            courseCode: courseData.courseCode.toUpperCase(),
            courseName: courseData.courseName,
            credit: courseData.credit,
            department,
            year,
            semester,
            createdBy: req.user.id,
            description: courseData.description || '',
            prerequisites: courseData.prerequisites || []
          });

          await newCourse.save();
          addedCourses.push(newCourse);
        }
      } catch (error) {
        if (error.code === 11000) {
          errors.push(`Course ${i + 1}: Course code ${courseData.courseCode} already exists for this semester`);
        } else {
          errors.push(`Course ${i + 1}: ${error.message}`);
        }
      }
    }

    // Calculate total credits
    const totalCredits = addedCourses.reduce((sum, course) => sum + course.credit, 0);

    console.log(`✅ Courses processed for ${department} - Year ${year}, Semester ${semester}:`);
    console.log(`   📚 Added/Updated: ${addedCourses.length} courses`);
    console.log(`   📊 Total Credits: ${totalCredits}`);
    console.log(`   ❌ Errors: ${errors.length}`);

    res.status(201).json({
      success: true,
      message: `Successfully processed ${addedCourses.length} courses for ${department} - Year ${year}, Semester ${semester}`,
      data: {
        courses: addedCourses,
        summary: {
          added: addedCourses.length,
          totalCredits,
          department,
          year,
          semester,
          errors: errors.length
        },
        errors
      }
    });

  } catch (error) {
    console.error('Add courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add courses',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get courses for a specific department/year/semester
// @route   GET /api/depthead/courses
// @access  Private (Department Head only)
export const getCourses = async (req, res) => {
  try {
    const { department, year, semester } = req.query;

    // Validation
    if (!department || !year || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Department, year, and semester query parameters are required'
      });
    }

    const courses = await Course.getCoursesForSemester(
      department,
      parseInt(year),
      parseInt(semester)
    );
    console.log('Queried courses:', courses);
    const totalCredits = courses.reduce((sum, course) => sum + course.credit, 0);

    res.status(200).json({
      success: true,
      message: `Courses retrieved for ${department} - Year ${year}, Semester ${semester}`,
      data: {
        courses,
        summary: {
          courseCount: courses.length,
          totalCredits,
          department,
          year: parseInt(year),
          semester: parseInt(semester)
        }
      }
    });

  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve courses',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Update a specific course
// @route   PUT /api/depthead/courses/:courseId
// @access  Private (Department Head only)
export const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { courseCode, courseName, credit, description, prerequisites } = req.body;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Update course fields
    if (courseCode) course.courseCode = courseCode.toUpperCase();
    if (courseName) course.courseName = courseName;
    if (credit !== undefined) course.credit = credit;
    if (description !== undefined) course.description = description;
    if (prerequisites !== undefined) course.prerequisites = prerequisites;

    await course.save();

    console.log(`✅ Course updated: ${course.courseCode} - ${course.courseName}`);

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: {
        course
      }
    });

  } catch (error) {
    console.error('Update course error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Course code already exists for this semester'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update course',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Delete a specific course
// @route   DELETE /api/depthead/courses/:courseId
// @access  Private (Department Head only)
export const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if course can be deleted
    const canDelete = await course.canBeDeleted();

    if (!canDelete) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete course. Students are already registered for this course.'
      });
    }

    await Course.findByIdAndDelete(courseId);

    console.log(`🗑️ Course deleted: ${course.courseCode} - ${course.courseName}`);

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });

  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Bulk replace courses for a semester
// @route   POST /api/depthead/courses/bulk-replace
// @access  Private (Department Head only)
export const bulkReplaceCourses = async (req, res) => {
  try {
    const { department, year, semester, courses } = req.body;

    // Validation
    if (!department || !year || !semester || !courses || !Array.isArray(courses)) {
      return res.status(400).json({
        success: false,
        message: 'Department, year, semester, and courses array are required'
      });
    }

    // Check if any students are registered for this semester
    const Registration = (await import('../models/Registration.model.js')).default;
    const existingRegistrations = await Registration.countDocuments({
      department,
      year,
      semester,
      status: { $ne: 'cancelled' }
    });

    if (existingRegistrations > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot replace courses. ${existingRegistrations} students are already registered for this semester.`
      });
    }

    // Delete existing courses for this semester
    await Course.deleteMany({
      department,
      year,
      semester
    });

    // Add new courses
    const newCourses = [];
    const errors = [];

    for (let i = 0; i < courses.length; i++) {
      const courseData = courses[i];

      try {
        const newCourse = new Course({
          courseCode: courseData.courseCode.toUpperCase(),
          courseName: courseData.courseName,
          credit: courseData.credit,
          department,
          year,
          semester,
          createdBy: req.user.id,
          description: courseData.description || '',
          prerequisites: courseData.prerequisites || []
        });

        await newCourse.save();
        newCourses.push(newCourse);
      } catch (error) {
        errors.push(`Course ${i + 1}: ${error.message}`);
      }
    }

    const totalCredits = newCourses.reduce((sum, course) => sum + course.credit, 0);

    console.log(`🔄 Bulk replace completed for ${department} - Year ${year}, Semester ${semester}:`);
    console.log(`   📚 New courses: ${newCourses.length}`);
    console.log(`   📊 Total Credits: ${totalCredits}`);

    res.status(200).json({
      success: true,
      message: `Successfully replaced courses for ${department} - Year ${year}, Semester ${semester}`,
      data: {
        courses: newCourses,
        summary: {
          replaced: newCourses.length,
          totalCredits,
          department,
          year,
          semester,
          errors: errors.length
        },
        errors
      }
    });

  } catch (error) {
    console.error('Bulk replace courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to replace courses',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get all departments with course statistics
// @route   GET /api/depthead/departments-stats
// @access  Private (Department Head only)
export const getDepartmentStats = async (req, res) => {
  try {
    const stats = await Course.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: {
            department: '$department',
            year: '$year',
            semester: '$semester'
          },
          courseCount: { $sum: 1 },
          totalCredits: { $sum: '$credit' },
          courses: {
            $push: {
              courseCode: '$courseCode',
              courseName: '$courseName',
              credit: '$credit'
            }
          }
        }
      },
      {
        $sort: {
          '_id.department': 1,
          '_id.year': 1,
          '_id.semester': 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'Department statistics retrieved successfully',
      data: {
        stats
      }
    });

  } catch (error) {
    console.error('Get department stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};