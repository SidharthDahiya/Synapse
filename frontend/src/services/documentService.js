import { documentAPI } from './api';

class DocumentService {
  constructor() {
    this.supportedTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No file selected');
      return errors;
    }

    if (!this.supportedTypes.includes(file.type)) {
      errors.push('File type not supported. Please upload PDF, TXT, or DOCX files.');
    }

    if (file.size > this.maxFileSize) {
      errors.push(`File size exceeds ${this.formatFileSize(this.maxFileSize)} limit.`);
    }

    if (file.size === 0) {
      errors.push('File appears to be empty.');
    }

    return errors;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileIcon(fileType) {
    switch (fileType) {
      case '.pdf':
        return '📄';
      case '.docx':
        return '📝';
      case '.txt':
        return '📃';
      default:
        return '📎';
    }
  }

  async uploadDocument(file, onProgress) {
    const validationErrors = this.validateFile(file);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(' '));
    }

    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await documentAPI.upload(formData);
      return response.data;
    } catch (error) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error('Failed to upload document');
    }
  }

  async getAllDocuments() {
    try {
      const response = await documentAPI.getAll();
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch documents');
    }
  }

  async getDocument(id) {
    try {
      const response = await documentAPI.getById(id);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Document not found');
      }
      throw new Error('Failed to fetch document');
    }
  }

  async deleteDocument(id) {
    try {
      const response = await documentAPI.delete(id);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Document not found');
      }
      throw new Error('Failed to delete document');
    }
  }

  async getDocumentStatus(id) {
    try {
      const response = await documentAPI.getStatus(id);
      return response.data;
    } catch (error) {
      throw new Error('Failed to get document status');
    }
  }
}

export default new DocumentService();
