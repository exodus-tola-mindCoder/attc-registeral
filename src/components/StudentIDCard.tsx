import React, { useState, useEffect } from 'react';
import {
  CreditCard, Upload, Download, RefreshCw,
  Camera, User as UserIcon, Loader2, CheckCircle,
  AlertTriangle, X
} from 'lucide-react';
import { User } from '../types';

interface StudentIDCardProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface IDCardStatus {
  studentId: string;
  idCardStatus: string;
  idCardIssuedAt: string | null;
  photoUrl: string | null;
  hasPhoto: boolean;
}

const API_BASE = 'http://localhost:5000/api';

const StudentIDCard: React.FC<StudentIDCardProps> = ({ user, token, onError, onSuccess }) => {
  const [idCardStatus, setIdCardStatus] = useState<IDCardStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [generatingID, setGeneratingID] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchIDCardStatus();
  }, []);

  const fetchIDCardStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/student-id/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setIdCardStatus(data.data);

        // If there's a photo URL, set it as preview
        if (data.data.photoUrl) {
          setPhotoPreview(`${API_BASE}/${data.data.photoUrl}`);
        }
      } else {
        onError(data.message || 'Failed to fetch ID card status');
      }
    } catch (err) {
      console.error('Failed to fetch ID card status');
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      onError('Please upload a valid image file (JPG, JPEG, PNG)');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      onError('Image size must be less than 5MB');
      return;
    }

    setPhotoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) {
      onError('Please select a photo to upload');
      return;
    }

    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('photo', photoFile);

      const response = await fetch(`${API_BASE}/student-id/upload-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Photo uploaded successfully!');
        fetchIDCardStatus();
      } else {
        onError(data.message || 'Failed to upload photo');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleGenerateID = async () => {
    setGeneratingID(true);

    try {
      const response = await fetch(`${API_BASE}/student-id/generate/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate ID card');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${user.firstName}_${user.fatherName}_ID_Card.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onSuccess('ID card generated and downloaded successfully!');
      fetchIDCardStatus();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to generate ID card');
    } finally {
      setGeneratingID(false);
    }
  };

  const handleCancelUpload = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <CreditCard className="h-6 w-6 text-indigo-600" />
        <h2 className="text-xl font-semibold text-gray-900">Student ID Card</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ID Card Status */}
          {idCardStatus && (
            <div className={`border rounded-lg p-4 ${idCardStatus.idCardStatus === 'Active' ? 'bg-green-50 border-green-200' :
              idCardStatus.idCardStatus === 'Inactive' ? 'bg-red-50 border-red-200' :
                'bg-yellow-50 border-yellow-200'
              }`}>
              <div className="flex items-center space-x-3">
                {idCardStatus.idCardStatus === 'Active' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : idCardStatus.idCardStatus === 'Inactive' ? (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                ) : (
                  <CreditCard className="h-5 w-5 text-yellow-600" />
                )}
                <div>
                  <h3 className="font-medium text-gray-900">
                    ID Card Status: {idCardStatus.idCardStatus}
                  </h3>
                  {idCardStatus.idCardIssuedAt && (
                    <p className="text-sm text-gray-600">
                      Issued on: {new Date(idCardStatus.idCardIssuedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ID Card Preview & Photo Upload - FLEX ROW */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* ID Card Preview */}
            <div className="flex-1 border border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center bg-white shadow-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">ID Card Preview</h3>
              <div className="relative rounded-xl shadow-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-500 to-blue-300 border-4 border-white" style={{ width: '340px', height: '210px' }}>
                {/* Decorative top wave */}
                <svg className="absolute top-0 left-0 w-full h-10" viewBox="0 0 340 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 40 Q85 0 170 40 T340 40 V0 H0 V40Z" fill="#fff" fillOpacity="0.25" />
                </svg>
                <div className="flex flex-row items-center h-full relative z-10">
                  {/* Photo area */}
                  <div className="w-28 h-36 ml-4 mt-6 mb-6 rounded-lg overflow-hidden border-4 border-white shadow-md bg-gray-100 flex items-center justify-center">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Student"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-12 w-12 text-gray-400" />
                    )}
                  </div>
                  {/* Info area */}
                  <div className="flex-1 flex flex-col justify-between h-full pl-4 pr-4 py-6">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="bg-white text-indigo-700 font-bold text-xs px-2 py-1 rounded shadow">ATTC</span>
                        <span className="text-xs text-white bg-indigo-800 rounded px-2 py-0.5 font-semibold tracking-widest">STUDENT</span>
                      </div>
                      <div className="mt-2 text-lg font-bold text-white drop-shadow-sm">{user.firstName} {user.fatherName}</div>
                      <div className="text-xs text-indigo-100 mt-1 font-mono">ID: <span className="font-semibold">{user.studentId}</span></div>
                      <div className="text-xs text-indigo-100 mt-1">Dept: <span className="font-semibold">{user.department || 'Freshman'}</span></div>
                      <div className="text-xs text-indigo-100 mt-1">Year {user.currentYear}, Sem {user.currentSemester}</div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-[10px] text-indigo-50">
                        Issue: {idCardStatus?.idCardIssuedAt ?
                          new Date(idCardStatus.idCardIssuedAt).toLocaleDateString() :
                          new Date().toLocaleDateString()}
                      </div>
                      {/* Simulated QR code area */}
                      <div className="w-10 h-10 bg-white rounded flex items-center justify-center shadow-inner">
                        <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="1" y="1" width="26" height="26" rx="4" fill="#e0e7ef" stroke="#6366f1" strokeWidth="2" />
                          <rect x="4" y="4" width="5" height="5" rx="1" fill="#6366f1" />
                          <rect x="19" y="4" width="5" height="5" rx="1" fill="#6366f1" />
                          <rect x="4" y="19" width="5" height="5" rx="1" fill="#6366f1" />
                          <rect x="12" y="12" width="4" height="4" rx="1" fill="#6366f1" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Decorative bottom wave */}
                <svg className="absolute bottom-0 left-0 w-full h-8" viewBox="0 0 340 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 0 Q85 32 170 0 T340 0 V32 H0 V0Z" fill="#fff" fillOpacity="0.18" />
                </svg>
                {/* Card border shine */}
                <div className="absolute inset-0 pointer-events-none rounded-xl border-2 border-white border-opacity-40" style={{ boxShadow: '0 2px 16px 0 rgba(49, 130, 206, 0.15)' }} />
              </div>
            </div>
            {/* Photo Upload */}
            <div className="flex-1 border border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center bg-white shadow-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upload ID Photo</h3>
              {photoFile ? (
                <div className="space-y-4 w-full flex flex-col items-center">
                  <div className="relative w-40 h-48 border border-gray-300 rounded-md overflow-hidden">
                    <img
                      src={photoPreview || ''}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={handleCancelUpload}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors duration-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleUploadPhoto}
                    disabled={uploadingPhoto}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4 w-full flex flex-col items-center">
                  <div className="w-40 h-48 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center">
                    <Camera className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 text-center px-2">
                      Upload a passport-style photo for your ID card
                    </p>
                  </div>
                  <div className="flex justify-center w-full">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handlePhotoChange}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center space-x-2 cursor-pointer w-full justify-center"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Select Photo</span>
                    </label>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    <p>Photo requirements:</p>
                    <ul className="list-disc list-inside">
                      <li>Clear, front-facing headshot</li>
                      <li>Plain background</li>
                      <li>JPG, JPEG, or PNG format</li>
                      <li>Maximum size: 5MB</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Generate ID Card */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Generate ID Card</h3>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {idCardStatus?.idCardStatus === 'Active'
                  ? 'Your ID card is active. You can download it again if needed.'
                  : idCardStatus?.idCardStatus === 'Inactive'
                    ? 'Your ID card is inactive. Please contact the registrar office.'
                    : 'Generate your official student ID card as a downloadable PDF.'}
              </p>

              <button
                onClick={handleGenerateID}
                disabled={generatingID}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {generatingID ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {generatingID
                    ? 'Generating...'
                    : idCardStatus?.idCardStatus === 'Active'
                      ? 'Download ID Card'
                      : 'Generate ID Card'}
                </span>
              </button>
            </div>
          </div>

          {/* ID Card Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Important Information:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Your student ID card is your official university identification</li>
              <li>• The QR code on your ID can be scanned for verification</li>
              <li>• Keep your ID card safe and report if lost or stolen</li>
              <li>• Your ID card is required for exams and campus facilities</li>
              <li>• For any issues with your ID card, contact the registrar office</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentIDCard;