import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables
dotenv.config();

// Get directory name (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attc-db';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Import User model or create a simplified version if not available
let User;
try {
  User = mongoose.model('User');
} catch (error) {
  // Define User schema if model doesn't exist
  const userSchema = new mongoose.Schema({
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    fatherName: {
      type: String,
      required: [true, 'Father name is required'],
      trim: true,
      maxlength: [50, 'Father name cannot exceed 50 characters']
    },
    grandfatherName: {
      type: String,
      required: [true, 'Grandfather name is required'],
      trim: true,
      maxlength: [50, 'Grandfather name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false
    },
    role: {
      type: String,
      enum: ['student', 'instructor', 'departmentHead', 'registrar', 'itAdmin', 'president', 'placementCommittee', 'graduationCommittee'],
      default: 'student'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'graduated'],
      default: 'active'
    }
  }, {
    timestamps: true
  });

  // Pre-save middleware to hash password
  userSchema.pre('save', async function (next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
      return next();
    }

    try {
      // Hash password with salt rounds of 12
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (error) {
      next(error);
    }
  });

  User = mongoose.model('User', userSchema);
}

// Admin user data
const adminData = {
  firstName: 'Admin',
  fatherName: 'System',
  grandfatherName: 'ATTC',
  email: 'admin@attc.edu.et',
  password: 'admin123', // This will be hashed by the pre-save middleware
  role: 'itAdmin',
  status: 'active'
};

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });

    if (existingAdmin) {
      console.log('⚠️ Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }
    console.log('🔐 Creating admin user...');
    // Create new admin user
    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Admin user created successfully:');
    console.log(`   👤 Name: ${admin.firstName} ${admin.fatherName}`);
    console.log(`   📧 Email: ${admin.email}`);
    console.log(`   🔑 Password: ${adminData.password} (please change after first login)`);
    console.log(`   🛡️ Role: ${admin.role}`);

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('📊 MongoDB connection closed');
  }
}

// Run the function
createAdmin();