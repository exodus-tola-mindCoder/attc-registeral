import React, { useState, useEffect } from 'react';
import { UserPlus, Eye, EyeOff, Loader2, Clock, Upload, FileText, X } from 'lucide-react';
import { AuthResponse } from '../types';

interface SignupFormProps {
  onSuccess: () => void;
  onError: (message: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const API_BASE = 'http://localhost:5000/api';

const SignupForm: React.FC<SignupFormProps> = ({ onSuccess, onError, loading, setLoading }) => {
  const [signupForm, setSignupForm] = useState({
    firstName: '',
    fatherName: '',
    grandfatherName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email generation states
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [emailTimer, setEmailTimer] = useState(0);
  const [emailCopied, setEmailCopied] = useState(false);

  // File upload states
  const [uploadedFiles, setUploadedFiles] = useState({
    grade11Transcript: null as File | null,
    grade12Transcript: null as File | null,
    entranceExamResult: null as File | null
  });

  // Email popup timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (showEmailPopup && emailTimer > 0) {
      interval = setInterval(() => {
        setEmailTimer(prev => {
          if (prev <= 1) {
            setShowEmailPopup(false);
            setGeneratedEmail('');
            setEmailCopied(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showEmailPopup, emailTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateInstitutionalEmail = async () => {
    if (!signupForm.firstName || !signupForm.fatherName) {
      onError('Please enter first name and father name first');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/generate-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: signupForm.firstName,
          fatherName: signupForm.fatherName
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.data?.email) {
        setGeneratedEmail(data.data.email);
        setShowEmailPopup(true);
        setEmailTimer(120); // 2 minutes
        setEmailCopied(false);
      } else {
        onError(data.message || 'Failed to generate email');
      }
    } catch (err) {
      onError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const copyEmailToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedEmail);
      setEmailCopied(true);
      setSignupForm(prev => ({ ...prev, email: generatedEmail }));
    } catch (err) {
      onError('Failed to copy email to clipboard');
    }
  };

  const handleFileUpload = (fileType: keyof typeof uploadedFiles, file: File | null) => {
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        onError('Only PDF files are allowed');
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        onError('File size must be less than 10MB');
        return;
      }
    }

    setUploadedFiles(prev => ({
      ...prev,
      [fileType]: file
    }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate all files are uploaded
    if (!uploadedFiles.grade11Transcript || !uploadedFiles.grade12Transcript || !uploadedFiles.entranceExamResult) {
      onError('Please upload all three required PDF documents');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('firstName', signupForm.firstName);
      formData.append('fatherName', signupForm.fatherName);
      formData.append('grandfatherName', signupForm.grandfatherName);
      formData.append('email', signupForm.email);
      formData.append('password', signupForm.password);
      formData.append('confirmPassword', signupForm.confirmPassword);

      // Append files
      formData.append('grade11Transcript', uploadedFiles.grade11Transcript);
      formData.append('grade12Transcript', uploadedFiles.grade12Transcript);
      formData.append('entranceExamResult', uploadedFiles.entranceExamResult);

      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        body: formData,
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        onSuccess();
        setSignupForm({
          firstName: '',
          fatherName: '',
          grandfatherName: '',
          email: '',
          password: '',
          confirmPassword: ''
        });
        setUploadedFiles({
          grade11Transcript: null,
          grade12Transcript: null,
          entranceExamResult: null
        });
      } else {
        onError(data.message || 'Registration failed');
      }
    } catch (err) {
      onError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Email Generation Popup */}
      {showEmailPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Your Institutional Email</h3>
              <div className="flex items-center space-x-2 text-red-600">
                <Clock className="h-4 w-4" />
                <span className="font-mono text-sm">{formatTime(emailTimer)}</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-md mb-4">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Generated Email:</strong>
              </p>
              <div className="flex items-center space-x-2">
                <code className="bg-white px-3 py-2 rounded border text-blue-900 font-mono text-sm flex-1">
                  {generatedEmail}
                </code>
                <button
                  onClick={copyEmailToClipboard}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors duration-200 ${emailCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  {emailCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> This popup will close automatically in {formatTime(emailTimer)}.
                Please copy your email now and paste it in the registration form.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name
            </label>
            <input
              type="text"
              required
              value={signupForm.firstName}
              onChange={(e) => setSignupForm({ ...signupForm, firstName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Father's Name
            </label>
            <input
              type="text"
              required
              value={signupForm.fatherName}
              onChange={(e) => setSignupForm({ ...signupForm, fatherName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Doe"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Grandfather's Name
          </label>
          <input
            type="text"
            required
            value={signupForm.grandfatherName}
            onChange={(e) => setSignupForm({ ...signupForm, grandfatherName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Smith"
          />
        </div>

        {/* Email Generation */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Institutional Email
            </label>
            <button
              type="button"
              onClick={generateInstitutionalEmail}
              disabled={loading || !signupForm.firstName || !signupForm.fatherName}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-xs transition-colors duration-200"
            >
              Generate Email
            </button>
          </div>
          <input
            type="email"
            required
            value={signupForm.email}
            onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Generated email will appear here"
            readOnly
          />
          <p className="text-xs text-gray-500 mt-1">
            Click "Generate Email" after entering your first and father's name
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={signupForm.password}
                onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Min. 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={signupForm.confirmPassword}
                onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* File Uploads */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Required Documents (PDF only, max 10MB each)
          </h3>

          {/* Grade 11 Transcript */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grade 11 Transcript
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileUpload('grade11Transcript', e.target.files?.[0] || null)}
                className="hidden"
                id="grade11"
              />
              <label
                htmlFor="grade11"
                className="flex-1 flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-400 transition-colors duration-200"
              >
                <Upload className="h-4 w-4 mr-2 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {uploadedFiles.grade11Transcript ? uploadedFiles.grade11Transcript.name : 'Choose PDF file'}
                </span>
              </label>
              {uploadedFiles.grade11Transcript && (
                <button
                  type="button"
                  onClick={() => handleFileUpload('grade11Transcript', null)}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Grade 12 Transcript */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grade 12 Transcript
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileUpload('grade12Transcript', e.target.files?.[0] || null)}
                className="hidden"
                id="grade12"
              />
              <label
                htmlFor="grade12"
                className="flex-1 flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-400 transition-colors duration-200"
              >
                <Upload className="h-4 w-4 mr-2 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {uploadedFiles.grade12Transcript ? uploadedFiles.grade12Transcript.name : 'Choose PDF file'}
                </span>
              </label>
              {uploadedFiles.grade12Transcript && (
                <button
                  type="button"
                  onClick={() => handleFileUpload('grade12Transcript', null)}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Entrance Exam Result */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              University Entrance Exam Result
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileUpload('entranceExamResult', e.target.files?.[0] || null)}
                className="hidden"
                id="entrance"
              />
              <label
                htmlFor="entrance"
                className="flex-1 flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-400 transition-colors duration-200"
              >
                <Upload className="h-4 w-4 mr-2 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {uploadedFiles.entranceExamResult ? uploadedFiles.entranceExamResult.name : 'Choose PDF file'}
                </span>
              </label>
              {uploadedFiles.entranceExamResult && (
                <button
                  type="button"
                  onClick={() => handleFileUpload('entranceExamResult', null)}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          <span>{loading ? 'Registering...' : 'Register as Freshman'}</span>
        </button>
      </form>
    </>
  );
};

export default SignupForm;