import React, { useState, useEffect } from 'react';
import { Star, Send, CheckCircle, AlertTriangle, Clock, BarChart3, Users, TrendingUp, Award } from 'lucide-react';
import { User } from '../types';

interface EvaluationQuestion {
  id: string;
  question: string;
  category: string;
}

interface EvaluationRequirement {
  gradeId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  department: string;
  instructorId: string;
  instructorName: string;
  isEvaluated: boolean;
  evaluationId?: string;
  submittedAt?: string;
  overallRating?: number;
}

interface EvaluationStatus {
  hasCompleted: boolean;
  totalRequired: number;
  completed: number;
  missing: number;
}

interface InstructorEvaluationProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const InstructorEvaluation: React.FC<InstructorEvaluationProps> = ({ user, token, onError, onSuccess }) => {
  const [evaluationRequirements, setEvaluationRequirements] = useState<EvaluationRequirement[]>([]);
  const [evaluationStatus, setEvaluationStatus] = useState<EvaluationStatus | null>(null);
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [instructorSummary, setInstructorSummary] = useState<any>(null);
  const [departmentStats, setDepartmentStats] = useState<any>(null);
  const [presidentReports, setPresidentReports] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'evaluate' | 'status' | 'instructor' | 'department' | 'reports'>('evaluate');

  // Evaluation form state
  const [selectedCourse, setSelectedCourse] = useState<EvaluationRequirement | null>(null);
  const [ratings, setRatings] = useState<{ [questionId: string]: number }>({});
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ratingLabels = {
    1: 'Strongly Disagree',
    2: 'Disagree',
    3: 'Neutral',
    4: 'Agree',
    5: 'Strongly Agree'
  };

  useEffect(() => {
    if (user.role === 'student') {
      fetchEvaluationStatus();
      fetchEvaluationQuestions();
      setActiveTab('status');
    } else if (user.role === 'instructor') {
      fetchInstructorEvaluations();
      setActiveTab('instructor');
    } else if (user.role === 'departmentHead') {
      fetchDepartmentEvaluations();
      setActiveTab('department');
    } else if (user.role === 'president') {
      fetchPresidentReports();
      setActiveTab('reports');
    }
  }, [user.role]);

  const fetchEvaluationStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/evaluations/student/evaluation-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setEvaluationRequirements(data.data.evaluationRequirements || []);
        setEvaluationStatus(data.data.completionStatus);
      }
    } catch (err) {
      console.error('Failed to fetch evaluation status');
    }
  };

  const fetchEvaluationQuestions = async () => {
    try {
      const response = await fetch(`${API_BASE}/evaluations/student/evaluation-questions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setQuestions(data.data.questions || []);
      }
    } catch (err) {
      console.error('Failed to fetch evaluation questions');
    }
  };

  const fetchInstructorEvaluations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/evaluations/instructor/evaluations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setInstructorSummary(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch instructor evaluations');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentEvaluations = async () => {
    setLoading(true);
    try {
      // Assuming department head manages their own department
      const department = user.department || 'Freshman';
      const response = await fetch(`${API_BASE}/evaluations/depthead/evaluations?department=${department}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setDepartmentStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch department evaluations');
    } finally {
      setLoading(false);
    }
  };

  const fetchPresidentReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/evaluations/president/evaluations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPresidentReports(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch president reports');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEvaluation = (course: EvaluationRequirement) => {
    setSelectedCourse(course);
    setRatings({});
    setComments('');
    setActiveTab('evaluate');
  };

  const handleRatingChange = (questionId: string, rating: number) => {
    setRatings(prev => ({
      ...prev,
      [questionId]: rating
    }));
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCourse) return;

    // Validate all questions are answered
    const unansweredQuestions = questions.filter(q => !ratings[q.id]);
    if (unansweredQuestions.length > 0) {
      onError(`Please answer all questions. Missing: ${unansweredQuestions.length} question(s)`);
      return;
    }

    setSubmitting(true);

    try {
      const ratingsArray = questions.map(question => ({
        questionId: question.id,
        score: ratings[question.id]
      }));

      const response = await fetch(`${API_BASE}/evaluations/student/submit-evaluation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructorId: selectedCourse.instructorId,
          courseId: selectedCourse.courseId,
          registrationId: selectedCourse.gradeId, // Using gradeId as registration reference
          ratings: ratingsArray,
          comments
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Evaluation submitted successfully!');
        setSelectedCourse(null);
        setRatings({});
        setComments('');
        fetchEvaluationStatus();
        setActiveTab('status');
      } else {
        onError(data.message || 'Failed to submit evaluation');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (isCompleted: boolean) => {
    return isCompleted ? 'text-green-600 bg-green-50 border-green-200' : 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  const getStatusIcon = (isCompleted: boolean) => {
    return isCompleted ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />;
  };

  const renderStarRating = (questionId: string, currentRating: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRatingChange(questionId, star)}
            className={`p-1 transition-colors duration-200 ${star <= currentRating
                ? 'text-yellow-400 hover:text-yellow-500'
                : 'text-gray-300 hover:text-gray-400'
              }`}
          >
            <Star className="h-6 w-6 fill-current" />
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-600">
          {currentRating > 0 ? ratingLabels[currentRating as keyof typeof ratingLabels] : 'Not rated'}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Instructor Evaluation Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Star className="h-6 w-6 text-yellow-600" />
          <h2 className="text-xl font-semibold text-gray-900">Instructor Evaluation</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto">
          {user.role === 'student' && (
            <>
              <button
                onClick={() => setActiveTab('status')}
                className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'status'
                    ? 'bg-white text-yellow-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Evaluation Status
              </button>
              {selectedCourse && (
                <button
                  onClick={() => setActiveTab('evaluate')}
                  className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'evaluate'
                      ? 'bg-white text-yellow-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Submit Evaluation
                </button>
              )}
            </>
          )}

          {user.role === 'instructor' && (
            <button
              onClick={() => setActiveTab('instructor')}
              className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'instructor'
                  ? 'bg-white text-yellow-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              My Evaluations
            </button>
          )}

          {user.role === 'departmentHead' && (
            <button
              onClick={() => setActiveTab('department')}
              className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'department'
                  ? 'bg-white text-yellow-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Department Stats
            </button>
          )}

          {user.role === 'president' && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'reports'
                  ? 'bg-white text-yellow-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Institution Reports
            </button>
          )}
        </div>

        {/* Evaluation Status Tab */}
        {activeTab === 'status' && user.role === 'student' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Evaluation Requirements</h3>
              {evaluationStatus && (
                <div className={`px-4 py-2 rounded-lg border ${evaluationStatus.hasCompleted
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  }`}>
                  <div className="flex items-center space-x-2">
                    {evaluationStatus.hasCompleted ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                    <span className="font-medium">
                      {evaluationStatus.hasCompleted
                        ? 'All evaluations completed!'
                        : `${evaluationStatus.missing} evaluation(s) pending`
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!evaluationStatus?.hasCompleted && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Action Required</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      You must complete all instructor evaluations before you can register for the next semester.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {evaluationRequirements.length > 0 ? (
              <div className="space-y-4">
                {evaluationRequirements.map((requirement) => (
                  <div key={requirement.gradeId} className={`border rounded-lg p-4 ${getStatusColor(requirement.isEvaluated)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusIcon(requirement.isEvaluated)}
                          <h4 className="font-medium">
                            {requirement.courseCode} - {requirement.courseName}
                          </h4>
                        </div>
                        <p className="text-sm">
                          <strong>Instructor:</strong> {requirement.instructorName}
                        </p>
                        <p className="text-sm">
                          <strong>Department:</strong> {requirement.department}
                        </p>
                        {requirement.isEvaluated && requirement.submittedAt && (
                          <p className="text-sm">
                            <strong>Submitted:</strong> {new Date(requirement.submittedAt).toLocaleDateString()}
                            {requirement.overallRating && (
                              <span className="ml-2">
                                <strong>Rating:</strong> {requirement.overallRating}/5
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {!requirement.isEvaluated && (
                        <button
                          onClick={() => handleStartEvaluation(requirement)}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
                        >
                          <Star className="h-4 w-4" />
                          <span>Evaluate</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No evaluations required</h3>
                <p className="text-gray-600">
                  You have no instructor evaluations to complete at this time.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Submit Evaluation Tab */}
        {activeTab === 'evaluate' && selectedCourse && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-900 mb-2">
                Evaluating: {selectedCourse.courseCode} - {selectedCourse.courseName}
              </h3>
              <p className="text-sm text-blue-700">
                <strong>Instructor:</strong> {selectedCourse.instructorName}
              </p>
              <p className="text-sm text-blue-700">
                <strong>Department:</strong> {selectedCourse.department}
              </p>
            </div>

            <form onSubmit={handleSubmitEvaluation} className="space-y-6">
              <div className="space-y-6">
                <h4 className="text-md font-medium text-gray-900">
                  Please rate the following aspects of your instructor's performance:
                </h4>

                {questions.map((question, index) => (
                  <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="mb-3">
                      <h5 className="font-medium text-gray-900 mb-1">
                        {index + 1}. {question.question}
                      </h5>
                      <p className="text-xs text-gray-600">Category: {question.category}</p>
                    </div>
                    {renderStarRating(question.id, ratings[question.id] || 0)}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Comments (Optional)
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  rows={4}
                  maxLength={500}
                  placeholder="Share any additional feedback about this instructor..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {comments.length}/500 characters
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h5 className="font-medium text-yellow-800 mb-2">Important Notes:</h5>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Your evaluation is completely anonymous</li>
                  <li>• You cannot edit your evaluation after submission</li>
                  <li>• All questions must be answered to submit</li>
                  <li>• Your feedback helps improve teaching quality</li>
                </ul>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={submitting || Object.keys(ratings).length !== questions.length}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>{submitting ? 'Submitting...' : 'Submit Evaluation'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourse(null);
                    setActiveTab('status');
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-md transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Instructor Summary Tab */}
        {activeTab === 'instructor' && user.role === 'instructor' && instructorSummary && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">My Evaluation Summary</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Total Evaluations</p>
                    <p className="text-2xl font-bold text-blue-900">{instructorSummary.summary.totalEvaluations}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Star className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Average Rating</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {instructorSummary.summary.averageOverallRating}/5
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Performance</p>
                    <p className="text-lg font-bold text-green-900">
                      {instructorSummary.summary.averageOverallRating >= 4.5 ? 'Excellent' :
                        instructorSummary.summary.averageOverallRating >= 4.0 ? 'Very Good' :
                          instructorSummary.summary.averageOverallRating >= 3.5 ? 'Good' :
                            instructorSummary.summary.averageOverallRating >= 3.0 ? 'Satisfactory' : 'Needs Improvement'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Question-wise breakdown */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-4">Question-wise Performance</h4>
              <div className="space-y-3">
                {instructorSummary.questionSummary?.map((question: any) => (
                  <div key={question.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 flex-1">{question.question}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{question.averageScore}/5</span>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-yellow-500 h-2 rounded-full"
                          style={{ width: `${(question.averageScore / 5) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating distribution */}
            {instructorSummary.summary.ratingDistribution && (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-4">Rating Distribution</h4>
                <div className="grid grid-cols-5 gap-4">
                  {[5, 4, 3, 2, 1].map(rating => (
                    <div key={rating} className="text-center">
                      <div className="text-sm font-medium text-gray-700">{rating} Star</div>
                      <div className="text-lg font-bold text-gray-900">
                        {instructorSummary.summary.ratingDistribution[rating] || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Department Stats Tab */}
        {activeTab === 'department' && user.role === 'departmentHead' && departmentStats && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Department Evaluation Statistics</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Total Evaluations</p>
                    <p className="text-2xl font-bold text-blue-900">{departmentStats.overallStats.totalEvaluations}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Average Rating</p>
                    <p className="text-2xl font-bold text-green-900">{departmentStats.overallStats.averageRating}/5</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-purple-600">Instructors</p>
                    <p className="text-2xl font-bold text-purple-900">{departmentStats.overallStats.uniqueInstructors}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Courses</p>
                    <p className="text-2xl font-bold text-yellow-900">{departmentStats.overallStats.uniqueCourses}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructor performance table */}
            {departmentStats.departmentStats?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">Instructor Performance</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Instructor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Evaluations
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Average Rating
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Courses
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {departmentStats.departmentStats.map((instructor: any) => (
                        <tr key={instructor._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {instructor.instructorName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {instructor.totalEvaluations}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm text-gray-900 mr-2">
                                {instructor.averageRating}/5
                              </span>
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${instructor.averageRating >= 4.5 ? 'bg-green-500' :
                                      instructor.averageRating >= 4.0 ? 'bg-blue-500' :
                                        instructor.averageRating >= 3.5 ? 'bg-yellow-500' :
                                          instructor.averageRating >= 3.0 ? 'bg-orange-500' : 'bg-red-500'
                                    }`}
                                  style={{ width: `${(instructor.averageRating / 5) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {instructor.courses?.length || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* President Reports Tab */}
        {activeTab === 'reports' && user.role === 'president' && presidentReports && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Institution-wide Evaluation Reports</h3>

            {/* Overall summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Total Evaluations</p>
                    <p className="text-2xl font-bold text-blue-900">{presidentReports.overallSummary.totalEvaluations}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Average Rating</p>
                    <p className="text-2xl font-bold text-green-900">{presidentReports.overallSummary.averageRating}/5</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-purple-600">Total Instructors</p>
                    <p className="text-2xl font-bold text-purple-900">{presidentReports.overallSummary.totalInstructors}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Departments</p>
                    <p className="text-2xl font-bold text-yellow-900">{presidentReports.overallSummary.totalDepartments}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Department comparison */}
            {presidentReports.departmentStats?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">Department Performance Comparison</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Evaluations
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Average Rating
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Instructors
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {presidentReports.departmentStats.map((dept: any) => (
                        <tr key={dept._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {dept._id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {dept.totalEvaluations}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm text-gray-900 mr-2">
                                {dept.averageRating}/5
                              </span>
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${dept.averageRating >= 4.5 ? 'bg-green-500' :
                                      dept.averageRating >= 4.0 ? 'bg-blue-500' :
                                        dept.averageRating >= 3.5 ? 'bg-yellow-500' :
                                          dept.averageRating >= 3.0 ? 'bg-orange-500' : 'bg-red-500'
                                    }`}
                                  style={{ width: `${(dept.averageRating / 5) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {dept.uniqueInstructors?.length || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top and bottom performers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top performers */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h4 className="font-medium text-green-900 mb-4">Top Performing Instructors</h4>
                <div className="space-y-3">
                  {presidentReports.instructorPerformance?.topPerformers?.slice(0, 5).map((instructor: any, index: number) => (
                    <div key={instructor._id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-green-700">#{index + 1}</span>
                        <span className="text-sm text-green-900">{instructor.instructorName}</span>
                      </div>
                      <span className="text-sm font-medium text-green-700">
                        {instructor.averageRating}/5 ({instructor.totalEvaluations} evals)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom performers */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h4 className="font-medium text-red-900 mb-4">Needs Improvement</h4>
                <div className="space-y-3">
                  {presidentReports.instructorPerformance?.bottomPerformers?.slice(0, 5).map((instructor: any, index: number) => (
                    <div key={instructor._id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-red-700">#{index + 1}</span>
                        <span className="text-sm text-red-900">{instructor.instructorName}</span>
                      </div>
                      <span className="text-sm font-medium text-red-700">
                        {instructor.averageRating}/5 ({instructor.totalEvaluations} evals)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorEvaluation;