import express from 'express'
import dotenv from 'dotenv';
import cors from 'cors';

const app = express();
// middleware
app.use(express.json());

import connectDB from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import testRoutes from './routes/testRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import enhancedStudentRoutes from './routes/enhancedStudentRoutes.js';
import gradeRoutes from './routes/gradeRoutes.js';
import placementRoutes from './routes/placementRoutes.js';
import evaluationRoutes from './routes/evaluationRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import excelRoutes from './routes/excelRoutes.js';
import itAdminRoutes from './routes/itAdminRoutes.js';
import transcriptRoutes from './routes/transcriptRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import graduationRoutes from './routes/graduationRoutes.js';
import studentIDRoutes from './routes/studentIDRoutes.js';
import registrationPeriodRoutes from './routes/registrationPeriodRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/depthead', courseRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/student', enhancedStudentRoutes);
app.use('/api/grades', gradeRoutes); 
app.use('/api/placement', placementRoutes); 
app.use('/api/evaluations', evaluationRoutes); 
app.use('/api/pdf', pdfRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/itadmin', itAdminRoutes);
app.use('/api/transcript', transcriptRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/schedule', scheduleRoutes); 
app.use('/api/notifications', notificationRoutes); 
app.use('/api/graduation', graduationRoutes);
app.use('/api/student-id', studentIDRoutes);
app.use('./api/verify', studentIDRoutes);
app.use('/api/registration-period', registrationPeriodRoutes);
// create a server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  connectDB();
});