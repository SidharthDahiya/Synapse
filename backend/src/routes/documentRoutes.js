import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ragService from '../services/ragService.js';
import Document from '../models/Document.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatFileSize, sanitizeFilename } from '../utils/helpers.js';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads with memory optimization
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

// Replace the extractText function with this improved version
const extractText = async (filePath, fileType, fileSize) => {
  let content = '';

  try {
    console.log(`🔍 Extracting text from ${fileType} file (${formatFileSize(fileSize)})`);

    switch (fileType) {
      case '.pdf':
        // Implement safer PDF text extraction
        try {
          // Only process PDFs smaller than 2MB to prevent memory issues
          if (fileSize > 2 * 1024 * 1024) {
            const fileName = path.basename(filePath, '.pdf');
            content = `PDF Document: "${fileName}"\n\nThis is a large PDF file (${formatFileSize(fileSize)}) that has been uploaded successfully. Due to its size, text extraction is limited to prevent memory issues.\n\nDocument Information:\n- Type: PDF Document\n- Size: ${formatFileSize(fileSize)}\n- Status: Successfully uploaded\n- Note: For better AI analysis, consider converting to TXT format or uploading a smaller PDF\n\nYou can ask questions about this document, and I'll help based on the filename and provide general assistance.`;
          } else {
            // Try to extract text from smaller PDFs
            const pdfParse = await import('pdf-parse');
            const pdfBuffer = fs.readFileSync(filePath);

            // Limit PDF parsing to prevent memory issues
            const options = {
              max: 5, // Only process first 5 pages
              version: 'v1.10.100d'
            };

            const pdfData = await pdfParse.default(pdfBuffer, options);
            let extractedText = pdfData.text || '';

            // Limit extracted text size
            if (extractedText.length > 5000) {
              extractedText = extractedText.substring(0, 5000) + '\n\n[Content truncated to first 5000 characters for memory optimization]';
            }

            const fileName = path.basename(filePath, '.pdf');
            content = `PDF Document: "${fileName}"\n\nDocument Size: ${formatFileSize(fileSize)}\nPages Processed: ${Math.min(pdfData.numpages || 1, 5)}\n\nExtracted Content:\n${extractedText}\n\n[Note: This is a partial extraction of the PDF content. For complete analysis, consider converting to TXT format.]`;
          }
        } catch (pdfError) {
          console.error('❌ PDF extraction failed, using fallback:', pdfError);
          const fileName = path.basename(filePath, '.pdf');
          content = `PDF Document: "${fileName}"\n\nThis PDF document has been uploaded but text extraction encountered an issue. The document is available for reference.\n\nDocument Information:\n- Type: PDF Document\n- Size: ${formatFileSize(fileSize)}\n- Status: Uploaded (limited text extraction)\n\nRecommendation: For better AI analysis, try converting this PDF to TXT format and re-uploading.`;
        }

        console.log('📄 PDF: Processing completed with safety measures');
        break;

      case '.txt':
        // Use streaming for large text files
        if (fileSize > 1024 * 1024) {
          content = await new Promise((resolve, reject) => {
            const chunks = [];
            const stream = fs.createReadStream(filePath, {
              encoding: 'utf8',
              highWaterMark: 64 * 1024
            });

            stream.on('data', (chunk) => {
              chunks.push(chunk);
              if (chunks.join('').length > 2 * 1024 * 1024) {
                stream.destroy();
                resolve(chunks.join('') + '\n\n[Content truncated due to size limit]');
              }
            });

            stream.on('end', () => resolve(chunks.join('')));
            stream.on('error', reject);
          });
        } else {
          content = fs.readFileSync(filePath, 'utf8');
        }
        console.log('📝 TXT: Text extraction completed');
        break;

      case '.docx':
        const docxResult = await mammoth.extractRawText({ path: filePath });
        content = docxResult.value;

        if (docxResult.messages && docxResult.messages.length > 0) {
          console.warn('📄 DOCX extraction warnings:', docxResult.messages);
        }

        if (content.length > 2 * 1024 * 1024) {
          content = content.substring(0, 2 * 1024 * 1024) + '\n\n[Content truncated due to size limit]';
        }

        console.log('📄 DOCX: Text extraction completed');
        break;

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Clean up content
    content = content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Final size check
    if (content.length > 3 * 1024 * 1024) {
      content = content.substring(0, 3 * 1024 * 1024) + '\n\n[Content truncated to prevent memory issues]';
      console.log('⚠️ Content truncated to prevent memory issues');
    }

    console.log(`✅ Text extraction completed: ${content.length} characters`);
    return content;
  } catch (error) {
    console.error(`❌ Error extracting text from ${fileType}:`, error);
    throw new Error(`Failed to extract text from ${fileType} file: ${error.message}`);
  }
};

// Upload and process document with comprehensive error handling
router.post('/upload', upload.single('document'), asyncHandler(async (req, res) => {
  console.log('📤 Document upload initiated');

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const fileType = path.extname(req.file.originalname).toLowerCase();
  const fileSize = req.file.size;

  console.log(`📁 Processing file: ${req.file.originalname}`);
  console.log(`📊 File details: ${fileType}, ${formatFileSize(fileSize)}`);

  try {
    // Validate file size
    if (fileSize === 0) {
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    if (fileSize > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }

    // Additional PDF size restriction to prevent memory issues
    if (fileType === '.pdf' && fileSize > 5 * 1024 * 1024) {
      return res.status(400).json({
        error: 'PDF files larger than 5MB are currently not supported due to memory limitations. Please try a smaller PDF or convert to TXT format.'
      });
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

    // Extract text content with memory management
    let content;
    try {
      content = await extractText(filePath, fileType, fileSize);
    } catch (extractError) {
      console.error('❌ Text extraction failed:', extractError);
      return res.status(400).json({
        error: `Failed to extract text from document: ${extractError.message}`
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Document appears to be empty or contains no extractable text' });
    }

    if (content.length < 10) {
      return res.status(400).json({ error: 'Document content is too short (minimum 10 characters)' });
    }

    console.log(`📝 Content extracted: ${content.length} characters`);

    // Process document with RAG service - with error handling
    let document;
    try {
      console.log('🤖 Starting RAG processing...');
      document = await ragService.processDocument(
        req.file.filename,
        req.file.originalname,
        content,
        fileType,
        fileSize
      );
      console.log('✅ RAG processing completed successfully');
    } catch (ragError) {
      console.error('❌ RAG processing failed:', ragError);

      // Still save the document but mark as failed
      try {
        document = new Document({
          filename: req.file.filename,
          originalName: req.file.originalname,
          content,
          chunks: [{ text: content.substring(0, 1000), index: 0 }], // Save first 1000 chars as single chunk
          fileType,
          fileSize,
          status: 'failed'
        });
        await document.save();
        console.log('💾 Document saved with failed status');
      } catch (saveError) {
        console.error('❌ Failed to save document even with failed status:', saveError);
        throw new Error('Failed to process and save document');
      }
    }

    // Successful response
    const response = {
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
    };

    // Add warning for PDF files
    if (fileType === '.pdf') {
      response.warning = 'PDF text extraction is simplified to prevent memory issues. AI responses will be based on document metadata and general PDF knowledge.';
    }

    console.log('✅ Document upload completed successfully');
    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Document upload error:', error);
    res.status(500).json({
      error: error.message || 'Failed to upload and process document',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('🧹 Temporary file cleaned up');
      } catch (cleanupError) {
        console.error('⚠️ Error cleaning up temporary file:', cleanupError);
      }
    }
  }
}));

// Get all documents with pagination and filtering
router.get('/', asyncHandler(async (req, res) => {
  console.log('📋 Fetching documents list');

  const { page = 1, limit = 50, status, fileType } = req.query;
  const skip = (page - 1) * limit;

  // Build filter
  const filter = {};
  if (status && ['processing', 'completed', 'failed'].includes(status)) {
    filter.status = status;
  }
  if (fileType && ['.pdf', '.txt', '.docx'].includes(fileType)) {
    filter.fileType = fileType;
  }

  try {
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
      status: doc.status || 'completed'
    }));

    const response = {
      documents: documentsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalDocuments,
        totalPages: Math.ceil(totalDocuments / limit),
        hasMore: skip + documents.length < totalDocuments
      }
    };

    console.log(`📋 Returning ${documentsWithStats.length} documents (${totalDocuments} total)`);
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
}));

// Get single document details
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { includeContent = false } = req.query;

  console.log(`📄 Fetching document: ${id}`);

  const projection = includeContent === 'true' ? {} : { content: 0 };
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

  if (includeContent === 'true' && document.content) {
    documentData.content = document.content;
    documentData.contentLength = document.content.length;
  }

  res.json(documentData);
}));

// Delete document
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log(`🗑️ Deleting document: ${id}`);

  const document = await Document.findById(id);

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Delete document from database
  await Document.findByIdAndDelete(id);

  // Clean up Redis cache
  try {
    await ragService.deleteDocumentFromCache(id);
    console.log('🧹 Document cache cleaned up');
  } catch (cacheError) {
    console.error('⚠️ Error cleaning up document cache:', cacheError);
    // Don't fail the request if cache cleanup fails
  }

  console.log('✅ Document deleted successfully');
  res.json({
    message: 'Document deleted successfully',
    deletedDocument: {
      id: document._id,
      filename: document.originalName,
      fileType: document.fileType
    }
  });
}));

// Get document processing status
router.get('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const document = await Document.findById(id, {
    status: 1,
    originalName: 1,
    uploadedAt: 1,
    fileType: 1
  }).lean();

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json({
    id: document._id,
    filename: document.originalName,
    fileType: document.fileType,
    status: document.status,
    uploadedAt: document.uploadedAt
  });
}));

// Get document statistics
router.get('/stats/overview', asyncHandler(async (req, res) => {
  console.log('📊 Fetching document statistics');

  try {
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
      acc[status || 'completed'] = (acc[status || 'completed'] || 0) + 1;
      return acc;
    }, {});

    // Process file type counts
    const fileTypeCounts = result.fileTypeCounts.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const response = {
      totalDocuments: result.totalDocuments,
      totalSize: result.totalSize,
      totalSizeFormatted: formatFileSize(result.totalSize),
      avgSize: Math.round(result.avgSize || 0),
      avgSizeFormatted: formatFileSize(Math.round(result.avgSize || 0)),
      totalChunks: result.totalChunks,
      avgChunks: Math.round(result.avgChunks || 0),
      statusCounts,
      fileTypeCounts
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
}));

// Test route to verify the router is working
router.get('/test', (req, res) => {
  console.log('🧪 Document routes test endpoint called');
  res.json({
    message: 'Document routes are working!',
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage()
  });
});

export default router;
