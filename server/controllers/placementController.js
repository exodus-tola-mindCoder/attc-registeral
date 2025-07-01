import PlacementRequest from '../models/PlacementRequest.model.js';
import User from '../models/User.model.js';
import Grade from '../models/Grade.model.js';
import { createNotification } from '../utils/notificationUtils.js';

// @desc    Submit placement request by freshman student
// @route   POST /api/student/submit-placement
// @access  Private (Student only)
export const submitPlacementRequest = async (req, res) => {
  try {
    const {
      firstChoice,
      secondChoice,
      personalStatement,
      reasonForChoice,
      careerGoals
    } = req.body;

    // Validation
    if (!firstChoice || !personalStatement || !reasonForChoice) {
      return res.status(400).json({
        success: false,
        message: 'First choice, personal statement, and reason for choice are required'
      });
    }

    // Get student information
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student is eligible for placement
    if (student.currentYear !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Only freshman students can submit placement requests'
      });
    }

    if (student.currentSemester !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Placement requests can only be submitted in the second semester'
      });
    }

    // Check academic standing
    if (student.dismissed) {
      return res.status(400).json({
        success: false,
        message: 'Students with dismissed status cannot submit placement requests'
      });
    }

    // Get student's academic performance
    const cgpaInfo = await Grade.calculateStudentCGPA(student._id);

    // Check minimum CGPA requirement (1.5 for placement)
    if (cgpaInfo.cgpa < 1.5) {
      return res.status(400).json({
        success: false,
        message: `Minimum CGPA of 1.5 required for placement. Current CGPA: ${cgpaInfo.cgpa}`
      });
    }

    // Check if placement request already exists
    const existingRequest = await PlacementRequest.findOne({
      studentId: student._id
    });

    if (existingRequest) {
      // Update existing request if it can be modified
      if (!existingRequest.canBeModified()) {
        return res.status(400).json({
          success: false,
          message: `Placement request already exists with status: ${existingRequest.status}`
        });
      }

      existingRequest.firstChoice = firstChoice;
      existingRequest.secondChoice = secondChoice;
      existingRequest.personalStatement = personalStatement;
      existingRequest.reasonForChoice = reasonForChoice;
      existingRequest.careerGoals = careerGoals;
      existingRequest.currentCGPA = cgpaInfo.cgpa;
      existingRequest.totalCredits = cgpaInfo.totalCredits;
      existingRequest.status = 'submitted';
      existingRequest.submittedAt = new Date();

      await existingRequest.save();

      // Send notification to placement committee
      try {
        const committeeMembers = await User.find({
          role: 'placementCommittee',
          status: 'active'
        });

        if (committeeMembers.length > 0) {
          for (const member of committeeMembers) {
            await createNotification({
              recipientId: member._id,
              title: 'Updated Placement Request',
              message: `${student.firstName} ${student.fatherName} has updated their placement request for ${firstChoice} department.`,
              type: 'Info',
              link: '/placement/pending',
              sourceType: 'placement',
              sourceId: existingRequest._id,
              sourceModel: 'PlacementRequest',
              createdBy: student._id
            });
          }
        }
      } catch (notificationError) {
        console.error('Placement update notification error:', notificationError);
        // Continue even if notification fails
      }

      console.log(`📝 Placement request updated: ${student.firstName} ${student.fatherName} (${student.studentId})`);
      console.log(`   🎯 First Choice: ${firstChoice}, Second Choice: ${secondChoice || 'None'}`);
      console.log(`   📊 CGPA: ${cgpaInfo.cgpa}, Priority Score: ${existingRequest.priorityScore}`);

      return res.status(200).json({
        success: true,
        message: 'Placement request updated and submitted successfully',
        data: {
          placementRequest: existingRequest.getPlacementSummary()
        }
      });
    }

    // Create new placement request
    const placementRequest = new PlacementRequest({
      studentId: student._id,
      firstChoice,
      secondChoice,
      personalStatement,
      reasonForChoice,
      careerGoals,
      currentCGPA: cgpaInfo.cgpa,
      totalCredits: cgpaInfo.totalCredits,
      status: 'submitted',
      submittedAt: new Date()
    });

    await placementRequest.save();

    // Send notification to placement committee
    try {
      const committeeMembers = await User.find({
        role: 'placementCommittee',
        status: 'active'
      });

      const departmentHeads = await User.find({
        role: 'departmentHead',
        department: firstChoice,
        status: 'active'
      });

      const recipients = [...committeeMembers, ...departmentHeads];

      if (recipients.length > 0) {
        for (const recipient of recipients) {
          await createNotification({
            recipientId: recipient._id,
            title: 'New Placement Request',
            message: `${student.firstName} ${student.fatherName} has submitted a placement request for ${firstChoice} department.`,
            type: 'Info',
            link: '/placement/pending',
            sourceType: 'placement',
            sourceId: placementRequest._id,
            sourceModel: 'PlacementRequest',
            createdBy: student._id
          });
        }
      }
    } catch (notificationError) {
      console.error('Placement notification error:', notificationError);
      // Continue even if notification fails
    }

    console.log(`📝 Placement request submitted: ${student.firstName} ${student.fatherName} (${student.studentId})`);
    console.log(`   🎯 First Choice: ${firstChoice}, Second Choice: ${secondChoice || 'None'}`);
    console.log(`   📊 CGPA: ${cgpaInfo.cgpa}, Priority Score: ${placementRequest.priorityScore}`);

    res.status(201).json({
      success: true,
      message: 'Placement request submitted successfully',
      data: {
        placementRequest: placementRequest.getPlacementSummary()
      }
    });

  } catch (error) {
    console.error('Submit placement request error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Placement request already exists for this academic year'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit placement request',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get student's placement request status
// @route   GET /api/student/placement-status
// @access  Private (Student only)
export const getPlacementStatus = async (req, res) => {
  try {
    const placementRequest = await PlacementRequest.findOne({
      studentId: req.user.id
    }).populate('reviewedBy.memberId', 'firstName fatherName role');

    if (!placementRequest) {
      return res.status(404).json({
        success: false,
        message: 'No placement request found',
        data: {
          hasRequest: false,
          canSubmit: true
        }
      });
    }

    // Check department capacity for approved department
    let departmentCapacity = null;
    if (placementRequest.approvedDepartment) {
      departmentCapacity = await PlacementRequest.checkDepartmentCapacity(
        placementRequest.approvedDepartment,
        placementRequest.academicYear
      );
    }

    res.status(200).json({
      success: true,
      message: 'Placement request status retrieved successfully',
      data: {
        hasRequest: true,
        placementRequest,
        departmentCapacity,
        canModify: placementRequest.canBeModified()
      }
    });

  } catch (error) {
    console.error('Get placement status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve placement status',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get pending placement requests for committee review
// @route   GET /api/committee/pending-placements
// @access  Private (Committee members only)
export const getPendingPlacements = async (req, res) => {
  try {
    const { department, sortBy = 'priority' } = req.query;

    let query = { status: 'submitted' };

    if (department) {
      query.$or = [
        { firstChoice: department },
        { secondChoice: department }
      ];
    }

    let sortOptions = {};
    switch (sortBy) {
      case 'priority':
        sortOptions = { priorityScore: -1, submittedAt: 1 };
        break;
      case 'cgpa':
        sortOptions = { currentCGPA: -1, submittedAt: 1 };
        break;
      case 'date':
        sortOptions = { submittedAt: 1 };
        break;
      default:
        sortOptions = { priorityScore: -1, submittedAt: 1 };
    }

    const pendingPlacements = await PlacementRequest.find(query)
      .populate('studentId', 'firstName fatherName grandfatherName studentId email')
      .sort(sortOptions);

    // Get department capacity information
    const departments = ['Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'];
    const departmentCapacities = await Promise.all(
      departments.map(dept => PlacementRequest.checkDepartmentCapacity(dept, new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)))
    );

    res.status(200).json({
      success: true,
      message: 'Pending placement requests retrieved successfully',
      data: {
        pendingPlacements,
        departmentCapacities,
        summary: {
          total: pendingPlacements.length,
          byDepartment: pendingPlacements.reduce((acc, req) => {
            acc[req.firstChoice] = (acc[req.firstChoice] || 0) + 1;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error('Get pending placements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending placements',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Review placement request (approve/reject)
// @route   PUT /api/committee/review-placement/:requestId
// @access  Private (Committee members only)
export const reviewPlacementRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments, approvedDepartment } = req.body;

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be either "approve" or "reject"'
      });
    }

    const placementRequest = await PlacementRequest.findById(requestId)
      .populate('studentId', 'firstName fatherName grandfatherName studentId');

    if (!placementRequest) {
      return res.status(404).json({
        success: false,
        message: 'Placement request not found'
      });
    }

    if (!placementRequest.canBeReviewed()) {
      return res.status(400).json({
        success: false,
        message: `Placement request cannot be reviewed. Current status: ${placementRequest.status}`
      });
    }

    if (decision === 'approve') {
      // Validate approved department
      if (!approvedDepartment) {
        return res.status(400).json({
          success: false,
          message: 'Approved department is required for approval'
        });
      }

      // Check department capacity
      const capacityCheck = await PlacementRequest.checkDepartmentCapacity(
        approvedDepartment,
        placementRequest.academicYear
      );

      if (capacityCheck.isFull) {
        return res.status(400).json({
          success: false,
          message: `Department ${approvedDepartment} is at full capacity (${capacityCheck.capacity})`
        });
      }

      placementRequest.status = 'approved';
      placementRequest.approvedDepartment = approvedDepartment;
      placementRequest.decidedAt = new Date();

      // Update student's department
      await User.findByIdAndUpdate(placementRequest.studentId._id, {
        department: approvedDepartment,
        currentYear: 2, // Promote to second year
        currentSemester: 1 // Start with first semester of second year
      });

      console.log(`✅ Placement approved: ${placementRequest.studentId.firstName} ${placementRequest.studentId.fatherName} → ${approvedDepartment}`);

    } else {
      placementRequest.status = 'rejected';
      placementRequest.rejectionReason = comments || 'No reason provided';
      placementRequest.decidedAt = new Date();

      console.log(`❌ Placement rejected: ${placementRequest.studentId.firstName} ${placementRequest.studentId.fatherName}`);
    }

    // Add committee review
    placementRequest.reviewedBy.push({
      memberId: req.user.id,
      role: req.user.role,
      decision,
      comments: comments || '',
      reviewedAt: new Date()
    });

    placementRequest.committeeComments = comments || '';
    placementRequest.reviewedAt = new Date();

    await placementRequest.save();

    // Send notification to student
    try {
      let title, message, type;

      if (decision === 'approve') {
        title = 'Department Placement Approved';
        message = `Congratulations! Your placement request has been approved for the ${approvedDepartment} department. You will be enrolled in Year 2, Semester 1 courses for the next academic term.`;
        type = 'Info';
      } else {
        title = 'Department Placement Rejected';
        message = `Your placement request has been rejected. Reason: ${comments || 'No reason provided'}. Please contact the academic affairs office for more information.`;
        type = 'Warning';
      }

      await createNotification({
        recipientId: placementRequest.studentId._id,
        title,
        message,
        type,
        link: '/placement/status',
        sourceType: 'placement',
        sourceId: placementRequest._id,
        sourceModel: 'PlacementRequest',
        createdBy: req.user.id
      });
    } catch (notificationError) {
      console.error('Placement decision notification error:', notificationError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: `Placement request ${decision}d successfully`,
      data: {
        placementRequest: placementRequest.getPlacementSummary()
      }
    });

  } catch (error) {
    console.error('Review placement request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review placement request',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get placement statistics and reports
// @route   GET /api/admin/placement-stats
// @access  Private (Admin/Registrar only)
export const getPlacementStats = async (req, res) => {
  try {
    const { academicYear } = req.query;

    // Get placement statistics
    const stats = await PlacementRequest.getPlacementStats(academicYear);

    // Get department capacities
    const departments = ['Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'];
    const currentAcademicYear = academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    const departmentCapacities = await Promise.all(
      departments.map(dept => PlacementRequest.checkDepartmentCapacity(dept, currentAcademicYear))
    );

    // Get overall statistics
    const overallStats = await PlacementRequest.aggregate([
      ...(academicYear ? [{ $match: { academicYear } }] : []),
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          averageCGPA: { $avg: '$currentCGPA' },
          averagePriorityScore: { $avg: '$priorityScore' }
        }
      }
    ]);

    // Get placement timeline
    const placementTimeline = await PlacementRequest.aggregate([
      ...(academicYear ? [{ $match: { academicYear } }] : []),
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$submittedAt"
            }
          },
          submissions: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.status(200).json({
      success: true,
      message: 'Placement statistics retrieved successfully',
      data: {
        departmentStats: stats,
        departmentCapacities,
        overallStats,
        placementTimeline,
        academicYear: currentAcademicYear
      }
    });

  } catch (error) {
    console.error('Get placement stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve placement statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Bulk approve placements (for efficient processing)
// @route   POST /api/committee/bulk-approve-placements
// @access  Private (Committee members only)
export const bulkApprovePlacements = async (req, res) => {
  try {
    const { approvals } = req.body; // Array of { requestId, approvedDepartment, comments }

    if (!approvals || !Array.isArray(approvals) || approvals.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Approvals array is required and must not be empty'
      });
    }

    const results = {
      approved: 0,
      failed: 0,
      errors: []
    };

    for (const approval of approvals) {
      try {
        const { requestId, approvedDepartment, comments } = approval;

        const placementRequest = await PlacementRequest.findById(requestId)
          .populate('studentId', 'firstName fatherName grandfatherName studentId');

        if (!placementRequest) {
          results.errors.push(`Request ${requestId}: Not found`);
          results.failed++;
          continue;
        }

        if (!placementRequest.canBeReviewed()) {
          results.errors.push(`Request ${requestId}: Cannot be reviewed (status: ${placementRequest.status})`);
          results.failed++;
          continue;
        }

        // Check department capacity
        const capacityCheck = await PlacementRequest.checkDepartmentCapacity(
          approvedDepartment,
          placementRequest.academicYear
        );

        if (capacityCheck.isFull) {
          results.errors.push(`Request ${requestId}: Department ${approvedDepartment} is at full capacity`);
          results.failed++;
          continue;
        }

        // Approve placement
        placementRequest.status = 'approved';
        placementRequest.approvedDepartment = approvedDepartment;
        placementRequest.committeeComments = comments || '';
        placementRequest.decidedAt = new Date();
        placementRequest.reviewedAt = new Date();

        placementRequest.reviewedBy.push({
          memberId: req.user.id,
          role: req.user.role,
          decision: 'approve',
          comments: comments || '',
          reviewedAt: new Date()
        });

        await placementRequest.save();

        // Update student's department
        await User.findByIdAndUpdate(placementRequest.studentId._id, {
          department: approvedDepartment,
          currentYear: 2,
          currentSemester: 1
        });

        // Send notification to student
        try {
          await createNotification({
            recipientId: placementRequest.studentId._id,
            title: 'Department Placement Approved',
            message: `Congratulations! Your placement request has been approved for the ${approvedDepartment} department. You will be enrolled in Year 2, Semester 1 courses for the next academic term.`,
            type: 'Info',
            link: '/placement/status',
            sourceType: 'placement',
            sourceId: placementRequest._id,
            sourceModel: 'PlacementRequest',
            createdBy: req.user.id
          });
        } catch (notificationError) {
          console.error('Bulk placement notification error:', notificationError);
          // Continue even if notification fails
        }

        results.approved++;

        console.log(`✅ Bulk approval: ${placementRequest.studentId.firstName} ${placementRequest.studentId.fatherName} → ${approvedDepartment}`);

      } catch (error) {
        results.errors.push(`Request ${approval.requestId}: ${error.message}`);
        results.failed++;
      }
    }

    console.log(`📊 Bulk placement approval completed: ${results.approved} approved, ${results.failed} failed`);

    res.status(200).json({
      success: true,
      message: `Bulk approval completed: ${results.approved} approved, ${results.failed} failed`,
      data: results
    });

  } catch (error) {
    console.error('Bulk approve placements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk approvals',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};