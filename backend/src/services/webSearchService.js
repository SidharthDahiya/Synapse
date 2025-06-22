import axios from 'axios';

class WebSearchService {
  constructor() {
    this.apiKey = process.env.SERPER_API_KEY;
    this.baseUrl = 'https://google.serper.dev/search';

    if (!this.apiKey) {
      console.warn('⚠️ SERPER_API_KEY not found. Web search functionality will be disabled.');
    } else {
      console.log('🌐 Web Search Service initialized');
    }
  }

  async searchWeb(query, numResults = 5) {
    if (!this.apiKey) {
      throw new Error('Web search is not configured. Please add SERPER_API_KEY to environment variables.');
    }

    try {
      console.log(`🔍 Searching web for: "${query}"`);

      const response = await axios.post(this.baseUrl, {
        q: query,
        num: numResults,
        gl: 'us', // Country
        hl: 'en'  // Language
      }, {
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      const results = response.data;

      if (!results.organic) {
        console.log('🔍 No organic results found');
        return [];
      }

      const searchResults = results.organic.slice(0, numResults).map(result => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        source: this.extractDomain(result.link)
      }));

      console.log(`✅ Found ${searchResults.length} web search results`);
      return searchResults;

    } catch (error) {
      console.error('❌ Web search error:', error.message);
      throw new Error(`Web search failed: ${error.message}`);
    }
  }

  extractDomain(url) {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return 'Unknown Source';
    }
  }

  // Extract key search terms from document content and user query
  extractSearchTerms(documentContent, userQuery) {
    try {
      // Combine important terms from document and user query
      const documentWords = documentContent
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(' ')
        .filter(word => word.length > 3)
        .slice(0, 10); // Take first 10 meaningful words

      const queryWords = userQuery
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(' ')
        .filter(word => word.length > 2);

      // Combine and deduplicate
      const allTerms = [...new Set([...queryWords, ...documentWords])];

      // Create a focused search query
      const searchQuery = allTerms.slice(0, 6).join(' ');

      console.log(`🎯 Generated search terms: "${searchQuery}"`);
      return searchQuery;

    } catch (error) {
      console.error('❌ Error extracting search terms:', error);
      return userQuery; // Fallback to original query
    }
  }

  // Check if user is asking for web search
  isWebSearchRequest(query) {
    const webSearchKeywords = [
      'search internet', 'search web', 'search online', 'google', 'find online',
      'web search', 'internet search', 'search for', 'look up online',
      'find more info', 'additional information', 'latest news', 'current info'
    ];

    const queryLower = query.toLowerCase();
    return webSearchKeywords.some(keyword => queryLower.includes(keyword));
  }
}

export default new WebSearchService();
