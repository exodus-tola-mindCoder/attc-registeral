import express from 'express';
import dotenv from 'dotenv';

const app = express();
// middleware
app.use(express.json());

import connectDB from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import enhancedStudentRoutes from './routes/enhancedStudentRoutes.js';
import gradeRoutes from './routes/gradeRoutes.js';
import placementRoutes from './routes/placementRoutes.js';
import evaluationRoutes from './routes/evaluationRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/depthead', courseRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/student', enhancedStudentRoutes);
app.use('/api/grades', gradeRoutes); 
app.use('/api/placement', placementRoutes); 
app.use('/api/evaluations', evaluationRoutes); 
// create a server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  connectDB();
});