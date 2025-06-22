import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ragService from '../services/ragService.js';
import Document from '../models/Document.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatFileSize, sanitizeFilename } from '../utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = sanitizeFilename(file.originalname);
    const extension = path.extname(sanitizedName);
    const nameWithoutExt = path.basename(sanitizedName, extension);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.txt', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} not allowed. Only PDF, TXT, and DOCX files are supported.`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// Extract text from different file types
const extractText = async (filePath, fileType) => {
  let content = '';

  try {
    switch (fileType) {
      case '.pdf':
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(pdfBuffer, {
          max: 0, // Extract all pages
          normalizeWhitespace: true
        });
        content = pdfData.text;
        break;

      case '.txt':
        content = fs.readFileSync(filePath, 'utf8');
        break;

      case '.docx':
        const docxResult = await mammoth.extractRawText({ path: filePath });
        content = docxResult.value;
        if (docxResult.messages && docxResult.messages.length > 0) {
          console.warn('DOCX extraction warnings:', docxResult.messages);
        }
        break;

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Clean up content
    content = content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .trim();

    return content;
  } catch (error) {
    throw new Error(`Failed to extract text from ${fileType} file: ${error.message}`);
  }
};

// Upload and process document
export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const fileType = path.extname(req.file.originalname).toLowerCase();
  const fileSize = req.file.size;

  try {
    // Validate file size
    if (fileSize === 0) {
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    // Extract text content
    const content = await extractText(filePath, fileType);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Document appears to be empty or contains no extractable text' });
    }

    if (content.length < 10) {
      return res.status(400).json({ error: 'Document content is too short (minimum 10 characters)' });
    }

    if (content.length > 5 * 1024 * 1024) { // 5MB text limit
      return res.status(400).json({ error: 'Document text content is too large (maximum 5MB)' });
    }

    // Check for duplicate documents
    const existingDoc = await Document.findOne({
      originalName: req.file.originalname,
      fileSize: fileSize
    });

    if (existingDoc) {
      return res.status(400).json({
        error: 'A document with the same name and size already exists',
        existingDocumentId: existingDoc._id
      });
    }

    // Process document with RAG service
    const document = await ragService.processDocument(
      req.file.filename,
      req.file.originalname,
      content,
      fileType,
      fileSize
    );

    res.status(201).json({
      message: 'Document uploaded and processed successfully',
      document: {
        id: document._id,
        filename: document.originalName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        fileSizeFormatted: formatFileSize(document.fileSize),
        chunksCount: document.chunks.length,
        contentLength: content.length,
        uploadedAt: document.uploadedAt,
        status: document.status
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      error: error.message || 'Failed to upload and process document'
    });
  } finally {
    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }
    }
  }
});

// Get all documents
export const getAllDocuments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, fileType } = req.query;
  const skip = (page - 1) * limit;

  // Build filter
  const filter = {};
  if (status) filter.status = status;
  if (fileType) filter.fileType = fileType;

  const [documents, totalDocuments] = await Promise.all([
    Document.find(filter, {
      content: 0, // Exclude content field for performance
      chunks: 0   // Exclude chunks field for performance
    })
    .sort({ uploadedAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean(),
    Document.countDocuments(filter)
  ]);

  const documentsWithStats = documents.map(doc => ({
    id: doc._id,
    filename: doc.originalName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    fileSizeFormatted: formatFileSize(doc.fileSize),
    chunksCount: doc.chunks?.length || 0,
    uploadedAt: doc.uploadedAt,
    status: doc.status
  }));

  res.json({
    documents: documentsWithStats,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalDocuments,
      totalPages: Math.ceil(totalDocuments / limit),
      hasMore: skip + documents.length < totalDocuments
    }
  });
});

// Get single document details
export const getDocumentById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { includeContent = false } = req.query;

  const projection = includeContent ? {} : { content: 0 };
  const document = await Document.findById(id, projection).lean();

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const documentData = {
    id: document._id,
    filename: document.originalName,
    fileType: document.fileType,
    fileSize: document.fileSize,
    fileSizeFormatted: formatFileSize(document.fileSize),
    chunksCount: document.chunks.length,
    uploadedAt: document.uploadedAt,
    status: document.status,
    chunks: document.chunks.map(chunk => ({
      index: chunk.index,
      textPreview: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
      textLength: chunk.text.length
    }))
  };

  if (includeContent && document.content) {
    documentData.content = document.content;
    documentData.contentLength = document.content.length;
  }

  res.json(documentData);
});

// Delete document
export const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const document = await Document.findById(id);

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Delete document from database
  await Document.findByIdAndDelete(id);

  // Clean up Redis cache
  try {
    await ragService.deleteDocumentFromCache(id);
  } catch (cacheError) {
    console.error('Error cleaning up document cache:', cacheError);
    // Don't fail the request if cache cleanup fails
  }

  res.json({
    message: 'Document deleted successfully',
    deletedDocument: {
      id: document._id,
      filename: document.originalName,
      fileType: document.fileType,
      fileSize: document.fileSize
    }
  });
});

// Get document processing status
export const getDocumentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const document = await Document.findById(id, {
    status: 1,
    originalName: 1,
    uploadedAt: 1,
    chunksCount: { $size: '$chunks' }
  }).lean();

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json({
    id: document._id,
    filename: document.originalName,
    status: document.status,
    uploadedAt: document.uploadedAt,
    chunksCount: document.chunksCount || 0
  });
});

// Update document metadata
export const updateDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { originalName } = req.body;

  if (!originalName || !originalName.trim()) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const document = await Document.findById(id);

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Check if new name already exists
  const existingDoc = await Document.findOne({
    originalName: originalName.trim(),
    _id: { $ne: id }
  });

  if (existingDoc) {
    return res.status(400).json({ error: 'A document with this name already exists' });
  }

  document.originalName = originalName.trim();
  await document.save();

  res.json({
    message: 'Document updated successfully',
    document: {
      id: document._id,
      filename: document.originalName,
      fileType: document.fileType,
      status: document.status
    }
  });
});

// Reprocess document (regenerate chunks and embeddings)
export const reprocessDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const document = await Document.findById(id);

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (document.status === 'processing') {
    return res.status(400).json({ error: 'Document is already being processed' });
  }

  try {
    // Update status to processing
    document.status = 'processing';
    await document.save();

    // Clean up old cache
    await ragService.deleteDocumentFromCache(id);

    // Reprocess with RAG service
    const updatedDocument = await ragService.processDocument(
      document.filename,
      document.originalName,
      document.content,
      document.fileType,
      document.fileSize
    );

    res.json({
      message: 'Document reprocessing completed successfully',
      document: {
        id: updatedDocument._id,
        filename: updatedDocument.originalName,
        chunksCount: updatedDocument.chunks.length,
        status: updatedDocument.status
      }
    });
  } catch (error) {
    // Update status to failed
    document.status = 'failed';
    await document.save();

    console.error('Error reprocessing document:', error);
    res.status(500).json({ error: 'Failed to reprocess document' });
  }
});

// Get document statistics
export const getDocumentStats = asyncHandler(async (req, res) => {
  const stats = await Document.aggregate([
    {
      $group: {
        _id: null,
        totalDocuments: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        avgSize: { $avg: '$fileSize' },
        totalChunks: { $sum: { $size: '$chunks' } },
        avgChunks: { $avg: { $size: '$chunks' } },
        statusCounts: {
          $push: '$status'
        },
        fileTypeCounts: {
          $push: '$fileType'
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalDocuments: 0,
    totalSize: 0,
    avgSize: 0,
    totalChunks: 0,
    avgChunks: 0,
    statusCounts: [],
    fileTypeCounts: []
  };

  // Process status counts
  const statusCounts = result.statusCounts.reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Process file type counts
  const fileTypeCounts = result.fileTypeCounts.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  res.json({
    totalDocuments: result.totalDocuments,
    totalSize: result.totalSize,
    totalSizeFormatted: formatFileSize(result.totalSize),
    avgSize: Math.round(result.avgSize || 0),
    avgSizeFormatted: formatFileSize(Math.round(result.avgSize || 0)),
    totalChunks: result.totalChunks,
    avgChunks: Math.round(result.avgChunks || 0),
    statusCounts,
    fileTypeCounts
  });
});
