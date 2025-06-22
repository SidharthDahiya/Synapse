import { GoogleGenerativeAI } from '@google/generative-ai';
import Document from '../models/Document.js';
import { redisClient } from '../../server.js';
import { ENV } from '../config/env.js';
import webSearchService from './webSearchService.js';

class RAGService {
  constructor() {
    console.log('🤖 Initializing RAG Service...');

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required. Please set it in your .env file.');
    }

    try {
      this.genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      console.log('✅ RAG Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error);
      throw new Error('Failed to initialize Gemini AI: ' + error.message);
    }
  }

  // Generate simple embeddings (using hash-based approach for stability)
  generateEmbedding(text) {
    try {
      // Simple hash-based embedding for demo purposes
      // In production, use proper embedding models like sentence-transformers
      const hash = this.simpleHash(text);
      const embedding = Array.from({length: 384}, (_, i) => {
        return Math.sin(hash + i) * 0.1 + Math.cos(hash * 2 + i) * 0.05;
      });

      return embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      // Return zero vector as fallback
      return Array(384).fill(0);
    }
  }

  // Simple hash function for text
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash);
  }

  // Split document into chunks with overlap
  chunkDocument(text, chunkSize = 800, overlap = 150) {
    const chunks = [];
    let start = 0;
    let index = 0;

    // Handle very short text
    if (text.length <= chunkSize) {
      return [{
        text: text.trim(),
        index: 0
      }];
    }

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.slice(start, end).trim();

      // Try to break at sentence boundaries
      if (end < text.length) {
        const sentenceEnd = chunk.lastIndexOf('. ');
        const paragraphEnd = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(sentenceEnd, paragraphEnd);

        if (breakPoint > chunkSize * 0.7) { // Only break if we keep at least 70% of chunk
          chunk = chunk.slice(0, breakPoint + 1).trim();
        }
      }

      if (chunk.length > 0) {
        chunks.push({
          text: chunk,
          index: index++
        });
      }

      // Move start position
      start = start + chunk.length - overlap;
      if (start >= text.length) break;
    }

    console.log(`📝 Created ${chunks.length} chunks from ${text.length} characters`);
    return chunks;
  }

  // Process document and create embeddings
  async processDocument(filename, originalName, content, fileType, fileSize) {
    console.log(`🤖 Processing document: ${originalName} (${fileType})`);

    try {
      let chunks;

      // Handle different file types differently
      if (fileType === '.pdf') {
        // For PDFs, create simpler chunks to avoid memory issues
        chunks = [{
          text: content,
          index: 0
        }];
        console.log('📄 PDF: Using single chunk to prevent memory issues');
      } else {
        // Normal chunking for TXT and DOCX files
        chunks = this.chunkDocument(content);
      }

      // Create document in database
      const document = new Document({
        filename,
        originalName,
        content,
        chunks,
        fileType,
        fileSize,
        status: 'processing'
      });

      await document.save();
      console.log('💾 Document saved to database');

      // Generate and cache embeddings (skip for PDFs to prevent memory issues)
      if (fileType !== '.pdf') {
        try {
          await this.generateAndCacheEmbeddings(document._id, chunks, originalName);
          console.log('🔗 Embeddings generated and cached');
        } catch (embeddingError) {
          console.error('⚠️ Error generating embeddings (continuing anyway):', embeddingError);
          // Don't fail the whole process if embeddings fail
        }
      } else {
        console.log('📄 PDF: Skipping embedding generation to prevent memory issues');
      }

      // Update status to completed
      document.status = 'completed';
      await document.save();

      console.log('✅ Document processing completed successfully');
      return document;

    } catch (error) {
      console.error('❌ Error processing document:', error);
      throw error;
    }
  }

  // Generate and cache embeddings for chunks
  async generateAndCacheEmbeddings(documentId, chunks, filename) {
    const batchSize = 5; // Process embeddings in small batches

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      await Promise.all(batch.map(async (chunk) => {
        try {
          const embedding = this.generateEmbedding(chunk.text);
          const cacheKey = `doc:${documentId}:chunk:${chunk.index}`;

          await redisClient.hSet(cacheKey, {
            text: chunk.text,
            embedding: JSON.stringify(embedding),
            docId: documentId.toString(),
            filename: filename
          });

          // Set expiration (24 hours)
          await redisClient.expire(cacheKey, 86400);
        } catch (chunkError) {
          console.error(`⚠️ Error processing chunk ${chunk.index}:`, chunkError);
          // Continue with other chunks
        }
      }));

      // Small delay between batches to prevent memory spikes
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  // Calculate cosine similarity between vectors
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;

    try {
      const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
      const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
      const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

      if (magnitudeA === 0 || magnitudeB === 0) return 0;

      return dotProduct / (magnitudeA * magnitudeB);
    } catch (error) {
      console.error('❌ Error calculating cosine similarity:', error);
      return 0;
    }
  }


  // Retrieve relevant chunks for a query - FIXED VERSION
async retrieveRelevantChunks(query, topK = 3) {
  try {
    console.log(`🔍 Searching for relevant chunks: "${query.substring(0, 50)}..."`);

    // Get all completed documents
    const documents = await Document.find({ status: 'completed' }).lean();

    if (documents.length === 0) {
      console.log('📭 No documents found');
      return [];
    }

    console.log(`📚 Found ${documents.length} documents to search`);
    const similarities = [];

    // Search through documents
    for (const doc of documents) {
      console.log(`🔍 Searching document: ${doc.originalName} (${doc.fileType})`);

      for (let i = 0; i < doc.chunks.length; i++) {
        try {
          const chunkKey = `doc:${doc._id}:chunk:${i}`;

          // Try to get from Redis first (for non-PDF files)
          if (doc.fileType !== '.pdf') {
            const chunkData = await redisClient.hGetAll(chunkKey);

            if (chunkData.embedding && chunkData.text) {
              const queryEmbedding = this.generateEmbedding(query);
              const chunkEmbedding = JSON.parse(chunkData.embedding);
              const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);

              similarities.push({
                text: chunkData.text,
                similarity,
                docId: doc._id,
                filename: doc.originalName,
                fileType: doc.fileType
              });
              continue;
            }
          }

          // Fallback: Direct text search from database (especially for PDFs)
          const chunk = doc.chunks[i];
          if (chunk && chunk.text) {
            let similarity = 0;
            const queryLower = query.toLowerCase();
            const chunkTextLower = chunk.text.toLowerCase();

            // Simple text matching for PDFs and fallback cases
            if (chunkTextLower.includes(queryLower)) {
              similarity = 0.9; // High similarity for direct matches
            } else {
              // Check for partial word matches
              const queryWords = queryLower.split(' ').filter(word => word.length > 2);
              const matchedWords = queryWords.filter(word => chunkTextLower.includes(word));
              similarity = matchedWords.length / queryWords.length * 0.7;
            }

            // For PDF documents, be more lenient with matching
            if (doc.fileType === '.pdf') {
              // Check if query mentions PDF, document, file, etc.
              if (queryLower.includes('pdf') || queryLower.includes('document') ||
                  queryLower.includes('file') || queryLower.includes('summary') ||
                  queryLower.includes(doc.originalName.toLowerCase().replace('.pdf', ''))) {
                similarity = Math.max(similarity, 0.8);
              }
            }

            if (similarity > 0.1) { // Only include if there's some relevance
              similarities.push({
                text: chunk.text,
                similarity,
                docId: doc._id,
                filename: doc.originalName,
                fileType: doc.fileType
              });

              console.log(`✅ Found relevant chunk in ${doc.originalName} (similarity: ${similarity.toFixed(2)})`);
            }
          }
        } catch (chunkError) {
          console.error(`⚠️ Error processing chunk ${i} of document ${doc._id}:`, chunkError);
          continue;
        }
      }
    }

    // Sort by similarity and return top K
    const topChunks = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    console.log(`🎯 Found ${topChunks.length} relevant chunks (total candidates: ${similarities.length})`);

    // Debug: Log the top chunks
    topChunks.forEach((chunk, idx) => {
      console.log(`📄 Chunk ${idx + 1}: ${chunk.filename} (${chunk.similarity.toFixed(2)}) - ${chunk.text.substring(0, 100)}...`);
    });

    return topChunks;

  } catch (error) {
    console.error('❌ Error retrieving chunks:', error);
    return [];
  }
}


// Generate answer using RAG - UPDATED WITH WEB SEARCH TOGGLE
async generateAnswer(question, roomId, webSearchEnabled = true) {
  try {
    console.log(`🤔 Generating answer for: "${question.substring(0, 50)}..."`);
    console.log(`🌐 Web search enabled: ${webSearchEnabled}`);

    // Check cache first (include webSearchEnabled in cache key)
    const cacheKey = `answer:${roomId}:${Buffer.from(question).toString('base64').substring(0, 50)}:ws${webSearchEnabled}`;
    const cachedAnswer = await redisClient.get(cacheKey);
    if (cachedAnswer) {
      console.log('💾 Returning cached answer');
      return JSON.parse(cachedAnswer);
    }

    // Retrieve relevant chunks from documents
    const relevantChunks = await this.retrieveRelevantChunks(question);

    // Check if user is requesting web search
    const isWebSearchRequested = webSearchService.isWebSearchRequest(question);

    let webSearchResults = [];
    let documentContext = '';

    // Prepare document context
    if (relevantChunks.length > 0) {
      documentContext = relevantChunks
        .map((chunk, idx) => {
          let sourceInfo = `[Document ${idx + 1}: ${chunk.filename}]`;
          if (chunk.fileType === '.pdf') {
            sourceInfo += ' (PDF)';
          }
          return `${sourceInfo}\n${chunk.text}`;
        })
        .join('\n\n---\n\n');
    }

    // Perform web search only if enabled and requested
    if (isWebSearchRequested && webSearchEnabled) {
      if (relevantChunks.length > 0) {
        try {
          console.log('🌐 Web search requested and enabled, performing search...');

          // Extract search terms from document content and user query
          const searchTerms = webSearchService.extractSearchTerms(
            relevantChunks[0].text,
            question
          );

          webSearchResults = await webSearchService.searchWeb(searchTerms, 4);
          console.log(`🔍 Web search completed: ${webSearchResults.length} results found`);

        } catch (searchError) {
          console.error('❌ Web search failed:', searchError);
          // Continue without web search results
        }
      } else {
        // No document content but web search requested
        try {
          console.log('🌐 Web search requested (no documents), performing direct search...');

          const searchTerms = question
            .replace(/[?!.]/g, '')
            .replace(/search\s+(internet|web|online|for)/gi, '')
            .trim();

          webSearchResults = await webSearchService.searchWeb(searchTerms, 4);
          console.log(`🔍 Web search completed: ${webSearchResults.length} results found`);

        } catch (searchError) {
          console.error('❌ Web search failed:', searchError);
        }
      }
    } else if (isWebSearchRequested && !webSearchEnabled) {
      console.log('❌ Web search requested but disabled by user');
    }

    // Generate comprehensive response
    let response;

    if (relevantChunks.length === 0 && webSearchResults.length === 0) {
      // No content available
      const totalDocs = await Document.countDocuments({ status: 'completed' });

      if (!webSearchEnabled && isWebSearchRequested) {
        response = {
          answer: "Web search is currently disabled. I can only answer questions based on your uploaded documents. To enable web search, please toggle the 'Web Search' button in the chat header.",
          sources: [],
          webResults: []
        };
      } else if (totalDocs === 0) {
        response = {
          answer: `I don't have any uploaded documents to reference. Please upload some documents first (PDF, TXT, or DOCX files) so I can provide helpful answers${webSearchEnabled ? ' and perform relevant web searches' : ''}.`,
          sources: [],
          webResults: []
        };
      } else {
        response = {
          answer: `I found ${totalDocs} uploaded document(s), but I couldn't find content directly relevant to your question. Try asking more specific questions about your documents${webSearchEnabled ? ', or use web search for external information' : ''}.`,
          sources: [],
          webResults: []
        };
      }
    } else {
      // Generate answer based on available content
      let prompt;

      if (webSearchResults.length > 0 && relevantChunks.length > 0) {
        // Combined document + web search response
        const webContext = webSearchResults
          .map((result, idx) => `[Web Result ${idx + 1}: ${result.source}]\nTitle: ${result.title}\nContent: ${result.snippet}\nURL: ${result.link}`)
          .join('\n\n---\n\n');

        prompt = `You are an AI assistant helping users understand their documents and find related information online. You have access to both their uploaded documents and current web search results.

DOCUMENT CONTEXT:
${documentContext}

WEB SEARCH RESULTS:
${webContext}

User Question: ${question}

Instructions:
1. Start by analyzing the document content to understand the core topic
2. Then incorporate relevant information from the web search results
3. Provide a comprehensive answer that combines both sources
4. Clearly distinguish between information from the user's document vs. web sources
5. Include specific details and be helpful
6. Mention that web search was performed to supplement the document information

Answer:`;

      } else if (webSearchResults.length > 0) {
        // Web search only response
        const webContext = webSearchResults
          .map((result, idx) => `[Web Result ${idx + 1}: ${result.source}]\nTitle: ${result.title}\nContent: ${result.snippet}\nURL: ${result.link}`)
          .join('\n\n---\n\n');

        prompt = `You are an AI assistant answering a question using current web search results.

WEB SEARCH RESULTS:
${webContext}

User Question: ${question}

Instructions:
1. Answer based on the web search results
2. Be informative and helpful
3. Cite sources when relevant

Answer:`;

      } else {
        // Document-only response
        prompt = `You are an AI assistant helping users understand their uploaded documents. Based on the provided context from their documents, answer the question clearly and helpfully.

DOCUMENT CONTEXT:
${documentContext}

User Question: ${question}

Instructions:
1. Answer based on the provided document context
2. Be helpful and conversational
3. If the context mentions that PDF processing is simplified, acknowledge this
4. For PDF files, work with the available information effectively
5. ${webSearchEnabled ? 'If the user asks about web search, explain that you can search the internet for additional information' : 'Note that web search is currently disabled'}
6. Cite which documents you're referencing when relevant

Answer:`;
      }

      console.log('🧠 Generating AI response...');
      const result = await this.model.generateContent(prompt);
      const answer = result.response.text();

      response = {
        answer,
        sources: relevantChunks.map(chunk => ({
          filename: chunk.filename,
          fileType: chunk.fileType,
          similarity: Math.round(chunk.similarity * 100) / 100
        })),
        webResults: webSearchResults.map(result => ({
          title: result.title,
          source: result.source,
          url: result.link
        })),
        webSearchEnabled
      };
    }

    // Cache the answer for appropriate time
    const cacheTime = webSearchResults.length > 0 ? 1800 : 3600;
    await redisClient.setEx(cacheKey, cacheTime, JSON.stringify(response));

    console.log('✅ AI response generated successfully');
    console.log(`📊 Response includes: ${response.sources.length} document sources, ${response.webResults.length} web results`);

    return response;

  } catch (error) {
    console.error('❌ Error generating answer:', error);

    return {
      answer: "I apologize, but I encountered an error while generating a response. Please try asking your question again, or rephrase it differently.",
      sources: [],
      webResults: [],
      error: true
    };
  }
}



  // Clean up document data from Redis
  async deleteDocumentFromCache(documentId) {
    try {
      console.log(`🧹 Cleaning up cache for document: ${documentId}`);

      const keys = await redisClient.keys(`doc:${documentId}:*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`🧹 Deleted ${keys.length} cache entries`);
      }

      // Also clean up any related answer cache
      const answerKeys = await redisClient.keys(`answer:*`);
      const relatedAnswerKeys = [];

      for (const key of answerKeys) {
        const cached = await redisClient.get(key);
        if (cached && cached.includes(documentId)) {
          relatedAnswerKeys.push(key);
        }
      }

      if (relatedAnswerKeys.length > 0) {
        await redisClient.del(relatedAnswerKeys);
        console.log(`🧹 Deleted ${relatedAnswerKeys.length} related answer cache entries`);
      }

    } catch (error) {
      console.error('⚠️ Error deleting document from cache:', error);
      // Don't throw error, just log it
    }
  }

  // Get service health status
  getHealthStatus() {
    try {
      return {
        status: 'healthy',
        geminiApiConnected: !!this.model,
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default new RAGService();
