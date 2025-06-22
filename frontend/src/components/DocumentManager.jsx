import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon,
  TrashIcon,
  CloudArrowUpIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { documentAPI } from '../services/api';
import { formatFileSize, formatDate } from '../utils/helpers';
import LoadingSpinner from './LoadingSpinner';

const DocumentManager = () => {
  const navigate = useNavigate();
  // IMPORTANT: Initialize as empty array, not null/undefined
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await documentAPI.getAll();
      console.log('📋 API Response:', response.data); // Debug log

      // Handle different response structures
      let documentsData;
      if (Array.isArray(response.data)) {
        // Direct array response
        documentsData = response.data;
      } else if (response.data && Array.isArray(response.data.documents)) {
        // Nested array response
        documentsData = response.data.documents;
      } else if (response.data && typeof response.data === 'object') {
        // Object response - convert to array or handle appropriately
        console.warn('⚠️ Unexpected response format:', response.data);
        documentsData = [];
      } else {
        // Fallback
        documentsData = [];
      }

      setDocuments(documentsData);
      console.log('✅ Documents loaded:', documentsData.length);

    } catch (error) {
      console.error('❌ Error fetching documents:', error);
      setError('Failed to load documents');
      setDocuments([]); // Ensure it's always an array
      toast.error('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, TXT, and DOCX files are allowed');
      return;
    }

    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('document', selectedFile);

    try {
      const response = await documentAPI.upload(formData);
      toast.success('Document uploaded and processed successfully!');
      setSelectedFile(null);

      // Refresh documents list
      await fetchDocuments();

      // Reset file input
      const fileInput = document.getElementById('document-upload');
      if (fileInput) fileInput.value = '';

    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to upload document';
      toast.error(errorMessage);
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      await documentAPI.delete(id);
      toast.success('Document deleted successfully!');

      // Update documents state by filtering out the deleted document
      setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== id));

    } catch (error) {
      toast.error('Failed to delete document');
      console.error('Delete error:', error);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    const fileInput = document.getElementById('document-upload');
    if (fileInput) fileInput.value = '';
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner message="Loading documents..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Documents</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDocuments}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Document Manager</h1>
              <p className="text-gray-600 mt-1">Upload and manage documents for AI assistance</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {/* SAFE: Check if documents is array before accessing length */}
            {Array.isArray(documents) ? documents.length : 0} document{documents.length !== 1 ? 's' : ''} uploaded
          </div>
        </div>

        {/* Upload Section */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload New Document</h2>

          {/* Drag and Drop Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-700">
                Drop your document here, or{' '}
                <label htmlFor="document-upload" className="text-primary-600 hover:text-primary-700 cursor-pointer">
                  browse
                </label>
              </p>
              <p className="text-sm text-gray-500">
                Supports PDF, TXT, and DOCX files up to 10MB
              </p>
            </div>
            <input
              id="document-upload"
              type="file"
              onChange={handleFileInputChange}
              accept=".pdf,.txt,.docx"
              className="hidden"
            />
          </div>

          {/* Selected File Display */}
          {selectedFile && (
            <div className="mt-4 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DocumentTextIcon className="w-6 h-6 text-primary-600" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearSelectedFile}
                    className="btn-secondary text-sm py-1 px-3"
                  >
                    Remove
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="btn-primary text-sm py-1 px-4 flex items-center space-x-2"
                  >
                    {uploading ? (
                      <>
                        <div className="spinner w-4 h-4 border-2 border-white border-t-transparent"></div>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <CloudArrowUpIcon className="w-4 h-4" />
                        <span>Upload</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Documents List */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Uploaded Documents</h2>
            {Array.isArray(documents) && documents.length > 0 && (
              <button
                onClick={fetchDocuments}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Refresh
              </button>
            )}
          </div>

          {/* SAFE: Check if documents is array and has length */}
          {!Array.isArray(documents) || documents.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded</h3>
              <p className="text-gray-500 mb-4">
                Upload your first document to enable AI assistance in chat rooms
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* SAFE: Only map if documents is confirmed to be an array */}
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <DocumentTextIcon className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{doc.filename}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span>Uploaded {formatDate(doc.uploadedAt)}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>•</span>
                        <span>{doc.chunksCount} chunks processed</span>
                        <span>•</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          doc.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : doc.status === 'processing'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(doc.id, doc.filename)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete document"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">How it works</h3>
              <p className="text-sm text-blue-700 mt-1">
                Upload documents to enable AI assistance in chat rooms. When you ask questions with a "?"
                in your message, the AI will search through your uploaded documents to provide relevant answers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
