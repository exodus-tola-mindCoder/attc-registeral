# ATTC Registration & Academic Management System

A comprehensive MERN stack academic management system with role-based access control, featuring complete student lifecycle management from registration to graduation.

## 🎯 System Overview
workflow: 
- **Freshman self-registration** with institutional email generation
- **Senior student bulk import** via Excel
- **Course management** by department heads
- **One-click semester registration** for students
- **Complete grade management workflow** (Instructor → Dept Head → Registrar)
- **Academic standing tracking** (Probation/Dismissal)
- **Department placement system** for freshman students
- **Anonymous instructor evaluation** system
- **PDF/Excel export tools** for official documents
- **Comprehensive IT administration** with system health monitoring
- **Official transcript generation** for students and registrar
- **Attendance tracking system** with final exam eligibility checking

## 🏗️ Architecture
### Backend (Node.js/Express)
```
server/
├── config/
│   └── database.js              # MongoDB connection
├── controllers/
│   ├── authController.js        # Authentication & user management
│   ├── courseController.js      # Course management (Dept Heads)
│   ├── registrationController.js # Student registration
│   ├── enhancedRegistrationController.js # Enhanced registration with prerequisites
│   ├── gradeController.js       # Grade management workflow
│   ├── placementController.js   # Department placement system
│   ├── evaluationController.js  # Instructor evaluation system
│   ├── pdfController.js         # PDF generation (registration slips)
│   ├── transcriptController.js  # Transcript generation
│   ├── excelExportController.js # Excel export tools
│   ├── importController.js      # Excel import for senior students
│   ├── itAdminController.js     # IT administration & system health
│   └── attendanceController.js  # Attendance tracking system
├── middleware/
│   ├── verifyToken.js           # JWT authentication
│   ├── checkRole.js             # Role-based access control
│   ├── fileUploadMiddleware.js  # PDF upload handling
│   └── excelUploadMiddleware.js # Excel upload handling
├── models/
│   ├── User.js                  # User accounts (students, staff)
│   ├── Course.js                # Course definitions
│   ├── Registration.js          # Student registrations
│   ├── Grade.js                 # Grade records with workflow
│   ├── PlacementRequest.js      # Department placement requests
│   ├── Evaluation.js            # Instructor evaluations
│   ├── AuditLog.js              # System audit logging
│   └── Attendance.js            # Attendance tracking
├── routes/
│   ├── authRoutes.js            # Authentication endpoints
│   ├── courseRoutes.js          # Course management endpoints
│   ├── studentRoutes.js         # Student registration endpoints
│   ├── gradeRoutes.js           # Grade management endpoints
│   ├── placementRoutes.js       # Placement system endpoints
│   ├── evaluationRoutes.js      # Evaluation system endpoints
│   ├── pdfRoutes.js             # PDF generation endpoints
│   ├── transcriptRoutes.js      # Transcript generation endpoints
│   ├── excelRoutes.js           # Excel export endpoints
│   ├── adminRoutes.js           # Data import endpoints
│   ├── itAdminRoutes.js         # IT administration endpoints
│   └── attendanceRoutes.js      # Attendance tracking endpoints
└── utils/
    ├── gradeUtils.js            # Grade calculation & academic standing
    ├── pdfGenerator.js          # PDF generation utilities
    ├── excelImportUtils.js      # Excel import processing
    └── auditLogger.js           # Audit logging utilities
    
```


### Frontend (React/TypeScript)
```
src/
├── components/
├── types/
│   └── index.ts                 # TypeScript type definitions
└── App.tsx                      # Main application component
```

## 🔐 Security Features

### Authentication & Authorization
- **JWT-based authentication** with secure token management
- **Role-based access control (RBAC)** with 6 distinct roles:
  - `student` - Course registration, grade viewing, evaluations
  - `instructor` - Grade submission, evaluation viewing, attendance tracking
  - `departmentHead` - Course management, grade approval, placement review
  - `registrar` - Grade finalization, placement review, data export
  - `itAdmin` - User management, system administration
  - `president` - Executive reporting and analytics
- **Password security** with bcrypt hashing (12 salt rounds)
- **Temporary password generation** for imported users
- **Mandatory password change** for new accounts


### Prerequisites
- Node.js 18+ and npm
- MongoDB Atlas account
- Environment variables configuration

### Environment Setup
```bash
# Clone repository
git clone <repository-url>
cd Registeral

# Install dependencies
npm install


# Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### Required Environment Variables
```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/attc-db

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_EXPIRE=24h

# Server Configuration
PORT=5000
NODE_ENV=production
CLIENT_URL=http://localhost:5173

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

### Database Setup
The system will automatically create all required collections and indexes on first run. No manual database setup required.