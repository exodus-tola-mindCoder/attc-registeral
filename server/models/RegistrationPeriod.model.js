import mongoose from 'mongoose';

const registrationPeriodSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['signup', 'courseRegistration'],
    required: [true, 'Period type is required']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required']
  },
  semester: {
    type: Number,
    enum: [1, 2],
    required: [true, 'Semester is required']
  },
  department: {
    type: String,
    enum: ['Freshman', 'Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT', 'All'],
    default: 'All'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Compound index for unique period type per academic year/semester/department
registrationPeriodSchema.index({
  type: 1,
  academicYear: 1,
  semester: 1,
  department: 1
}, {
  unique: true,
  name: 'unique_registration_period'
});

// Static method to check if registration is open
registrationPeriodSchema.statics.isRegistrationOpen = async function (type, department = 'All') {
  const now = new Date();

  // First check for department-specific period
  let period = await this.findOne({
    type,
    department,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  });

  // If no department-specific period, check for 'All' departments
  if (!period && department !== 'All') {
    period = await this.findOne({
      type,
      department: 'All',
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });
  }

  return !!period;
};

// Static method to get active registration periods
registrationPeriodSchema.statics.getActivePeriods = async function () {
  return this.find({
    isActive: true
  }).sort({ endDate: 1 });
};

// Static method to get period details
registrationPeriodSchema.statics.getPeriodDetails = async function (type, department = 'All') {
  const now = new Date();

  // First check for department-specific period
  let period = await this.findOne({
    type,
    department,
    isActive: true
  });

  // If no department-specific period, check for 'All' departments
  if (!period && department !== 'All') {
    period = await this.findOne({
      type,
      department: 'All',
      isActive: true
    });
  }

  if (!period) {
    return {
      isOpen: false,
      message: 'Registration period not found'
    };
  }

  const isOpen = now >= period.startDate && now <= period.endDate;

  let message;
  if (isOpen) {
    const daysLeft = Math.ceil((period.endDate - now) / (1000 * 60 * 60 * 24));
    message = `Registration is open. Closes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`;
  } else if (now < period.startDate) {
    const daysUntil = Math.ceil((period.startDate - now) / (1000 * 60 * 60 * 24));
    message = `Registration opens in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`;
  } else {
    message = 'Registration period has ended.';
  }

  return {
    isOpen,
    message,
    period
  };
};

const RegistrationPeriod = mongoose.model('RegistrationPeriod', registrationPeriodSchema);

export default RegistrationPeriod;