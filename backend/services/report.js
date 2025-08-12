const LLMProviderFactory = require('../llm/provider-factory');
const EnhancedSummaryService = require('./enhanced-summary');

class ReportService {
  constructor(db, storageService, contextualIntelligence = null) {
    this.db = db;
    this.storageService = storageService;
    this.llmProvider = new LLMProviderFactory();
    
    // Enhanced summary service (optional)
    this.enhancedSummaryService = null;
    if (contextualIntelligence) {
      try {
        this.enhancedSummaryService = new EnhancedSummaryService(storageService, contextualIntelligence);
        console.log('[Report Service] Enhanced summary service initialized');
      } catch (error) {
        console.warn('[Report Service] Could not initialize enhanced summary service:', error.message);
      }
    }
  }

  async generateMeetingReport(meetingId, forceRegenerate = false) {
    try {
      console.log(`[Report Service] ${forceRegenerate ? 'Regenerating' : 'Getting'} report for meeting ${meetingId}`);
      
      // Get meeting details
      const meetingQuery = `
        SELECT m.*, mm.*
        FROM meetings m
        LEFT JOIN meeting_metadata mm ON m.id = mm.meeting_id
        WHERE m.id = $1
      `;
      const meetingResult = await this.db.query(meetingQuery, [meetingId]);
      
      if (meetingResult.rows.length === 0) {
        throw new Error('Meeting not found');
      }
      
      const meeting = meetingResult.rows[0];
      
      // Check if we already have a cached report and don't need to regenerate
      if (!forceRegenerate && meeting.summary) {
        console.log(`[Report Service] Using cached report for meeting ${meetingId}`);
        return await this.buildReportFromCache(meeting, meetingId);
      }
      
      console.log(`[Report Service] Generating new report for meeting ${meetingId}`);
      
      // Get all final transcripts
      const transcripts = await this.storageService.getTranscripts(meetingId, { 
        finalOnly: true,
        limit: null 
      });
      
      // Get extracted terms with definitions
      const terms = await this.storageService.getExtractedTerms(meetingId);
      
      // Combine transcripts into full text
      const fullTranscript = transcripts
        .map(t => t.text)
        .join(' ')
        .trim();
      
      // Generate summary using enhanced service if available, otherwise fallback to standard
      const summary = await this.generateSummary(fullTranscript, terms, meetingId);
      
      // Save summary to database
      await this.saveSummary(meetingId, summary);
      
      // Get cost data
      const costData = await this.getCostData(meetingId);
      
      // Build complete report
      const report = {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          description: meeting.description,
          startTime: meeting.start_time,
          endTime: meeting.end_time,
          duration: this.formatDuration(meeting.duration_seconds),
          status: meeting.status
        },
        statistics: {
          wordCount: meeting.word_count || this.countWords(fullTranscript),
          uniqueTerms: meeting.term_count || terms.length,
          transcriptSegments: transcripts.length,
          totalDefinitions: terms.filter(t => t.definition).length
        },
        costs: costData,
        summary: summary,
        keyTerms: this.formatKeyTerms(terms),
        fullTranscript: this.formatTranscript(transcripts),
        generatedAt: new Date()
      };
      
      console.log(`[Report Service] Report generated successfully for meeting ${meetingId}`);
      return report;
      
    } catch (error) {
      console.error('[Report Service] Error generating report:', error);
      throw error;
    }
  }

  async buildReportFromCache(meeting, meetingId) {
    try {
      // Get all final transcripts
      const transcripts = await this.storageService.getTranscripts(meetingId, { 
        finalOnly: true,
        limit: null 
      });
      
      // Get extracted terms with definitions
      const terms = await this.storageService.getExtractedTerms(meetingId);
      
      // Combine transcripts into full text for word count (if not cached)
      const fullTranscript = transcripts.map(t => t.text).join(' ').trim();
      
      // Get cost data
      const costData = await this.getCostData(meetingId);
      
      // Build report using cached summary
      const report = {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          startTime: meeting.start_time,
          endTime: meeting.end_time,
          duration: this.formatDuration(meeting.duration_seconds),
          status: meeting.status
        },
        statistics: {
          wordCount: meeting.word_count || this.countWords(fullTranscript),
          uniqueTerms: meeting.term_count || terms.length,
          transcriptSegments: transcripts.length,
          totalDefinitions: terms.filter(t => t.definition).length
        },
        costs: costData,
        summary: meeting.summary, // Use cached summary
        keyTerms: this.formatKeyTerms(terms),
        fullTranscript: this.formatTranscript(transcripts),
        generatedAt: meeting.updated_at || new Date(), // Use original generation time
        cached: true // Flag to indicate this was cached
      };
      
      return report;
      
    } catch (error) {
      console.error('[Report Service] Error building cached report:', error);
      throw error;
    }
  }

  async getCostData(meetingId) {
    try {
      const query = `
        SELECT 
          llm_cost,
          transcription_cost,
          knowledge_cost,
          total_cost,
          usage_data,
          created_at
        FROM meeting_costs 
        WHERE meeting_id = $1
      `;
      
      const result = await this.db.query(query, [meetingId]);
      
      if (result.rows.length === 0) {
        console.log(`[Report Service] No cost data found for meeting ${meetingId}`);
        return {
          llm: 0,
          transcription: 0,
          knowledge: 0,
          total: 0,
          breakdown: {},
          lastUpdated: null
        };
      }
      
      const costRow = result.rows[0];
      const usageData = typeof costRow.usage_data === 'string' 
        ? JSON.parse(costRow.usage_data) 
        : costRow.usage_data || {};
      
      return {
        llm: parseFloat(costRow.llm_cost) || 0,
        transcription: parseFloat(costRow.transcription_cost) || 0,
        knowledge: parseFloat(costRow.knowledge_cost) || 0,
        total: parseFloat(costRow.total_cost) || 0,
        breakdown: {
          llm: usageData.llm || [],
          transcription: usageData.transcription || [],
          knowledge: usageData.knowledge || []
        },
        lastUpdated: costRow.created_at
      };
      
    } catch (error) {
      console.error('[Report Service] Error retrieving cost data:', error);
      return {
        llm: 0,
        transcription: 0,
        knowledge: 0,
        total: 0,
        breakdown: {},
        lastUpdated: null
      };
    }
  }

  async generateSummary(transcript, terms, meetingId = null) {
    if (!transcript || transcript.length < 50) {
      return 'Meeting too short to generate meaningful summary.';
    }
    
    // Try enhanced summary first if available and meetingId provided
    if (this.enhancedSummaryService && meetingId) {
      try {
        console.log(`[Report Service] Attempting enhanced summary for meeting ${meetingId}`);
        const enhancedResult = await this.enhancedSummaryService.generateEnhancedSummary(meetingId);
        
        if (enhancedResult && enhancedResult.summary && enhancedResult.metadata.enhancementLevel !== 'failed') {
          console.log(`[Report Service] Enhanced summary generated successfully in ${enhancedResult.metadata.processingTime}ms`);
          
          // Store enhanced summary costs in database
          if (enhancedResult.metadata.usageTracking && meetingId) {
            try {
              const MeetingService = require('./meeting');
              const meetingService = new MeetingService(this.db);
              await meetingService.addEnhancedSummaryCosts(meetingId, enhancedResult.metadata.usageTracking);
              console.log(`[Report Service] Added enhanced summary costs to meeting ${meetingId}`);
            } catch (error) {
              console.warn('[Report Service] Failed to add enhanced summary costs:', error.message);
            }
          }
          
          return enhancedResult.summary;
        } else {
          console.warn('[Report Service] Enhanced summary failed or returned invalid result, falling back to standard');
        }
      } catch (error) {
        console.warn('[Report Service] Enhanced summary error, falling back to standard:', error.message);
      }
    }
    
    // Fallback to standard summary generation
    console.log('[Report Service] Using standard summary generation');
    return await this.generateStandardSummary(transcript, terms);
  }
  
  async generateStandardSummary(transcript, terms) {
    try {
      const topTerms = terms
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10)
        .map(t => t.term)
        .join(', ');
      
      const systemPrompt = `You are a professional meeting summarizer. Create a concise, well-structured summary of the meeting transcript provided. 

Your summary should include:
1. Main Topics Discussed (2-3 bullet points)
2. Key Decisions or Action Items (if any)
3. Important Technical Concepts Mentioned
4. Next Steps or Follow-ups (if mentioned)

Keep the summary under 300 words and focus on the most important information.
If technical terms were discussed, briefly explain their relevance to the meeting context.`;

      const userPrompt = `Meeting Transcript:
${transcript.substring(0, 8000)}

Key Terms Identified: ${topTerms}

Please provide a professional summary of this meeting.`;

      const response = await this.llmProvider.createCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.3,
          maxTokens: 500
        }
      );
      
      return response.content;
      
    } catch (error) {
      console.error('[Report Service] Error generating standard summary:', error);
      return 'Unable to generate summary at this time.';
    }
  }

  async saveSummary(meetingId, summary) {
    try {
      const query = `
        UPDATE meeting_metadata 
        SET summary = $1
        WHERE meeting_id = $2
      `;
      await this.db.query(query, [summary, meetingId]);
    } catch (error) {
      // If no metadata exists, create it
      const insertQuery = `
        INSERT INTO meeting_metadata (meeting_id, summary)
        VALUES ($1, $2)
        ON CONFLICT (meeting_id) 
        DO UPDATE SET summary = $2
      `;
      await this.db.query(insertQuery, [meetingId, summary]);
    }
  }

  formatKeyTerms(terms) {
    return terms
      .filter(term => term.frequency >= 3) // Only include terms with 3+ mentions
      .sort((a, b) => b.frequency - a.frequency)
      .map(term => ({
        term: term.term,
        frequency: term.frequency,
        definition: term.definition || 'No definition available',
        sources: term.sources ? (typeof term.sources === 'string' ? JSON.parse(term.sources) : term.sources) : []
      }));
  }

  formatTranscript(transcripts) {
    return transcripts.map(t => ({
      text: t.text,
      timestamp: t.timestamp,
      confidence: t.confidence
    }));
  }

  formatDuration(seconds) {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  async generateReportHTML(report) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Meeting Report - ${report.meeting.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2c3e50;
      margin: 0 0 10px 0;
    }
    .meta {
      color: #666;
      font-size: 14px;
    }
    .stats {
      display: flex;
      gap: 30px;
      margin: 20px 0;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 5px;
    }
    .stat {
      flex: 1;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #007bff;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .section {
      background: white;
      padding: 25px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h2 {
      color: #2c3e50;
      border-bottom: 2px solid #e9ecef;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .term {
      background: #f8f9fa;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 5px;
      border-left: 3px solid #007bff;
    }
    .term-name {
      font-weight: bold;
      color: #007bff;
      margin-bottom: 5px;
    }
    .term-definition {
      color: #666;
      font-size: 14px;
    }
    .transcript-segment {
      padding: 10px;
      margin: 5px 0;
      background: #f8f9fa;
      border-radius: 3px;
    }
    .timestamp {
      color: #999;
      font-size: 12px;
      margin-right: 10px;
    }
    .costs {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 5px;
      padding: 15px;
      margin: 15px 0;
    }
    .cost-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .cost-total {
      font-weight: bold;
      border-top: 1px solid #ddd;
      padding-top: 5px;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 12px;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Meeting Report: ${report.meeting.title}</h1>
    <div class="meta">
      <div>📅 Date: ${new Date(report.meeting.startTime).toLocaleDateString()}</div>
      <div>⏱️ Duration: ${report.meeting.duration}</div>
      <div>📝 Generated: ${new Date(report.generatedAt).toLocaleString()}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${report.statistics.wordCount}</div>
      <div class="stat-label">Total Words</div>
    </div>
    <div class="stat">
      <div class="stat-value">${report.statistics.uniqueTerms}</div>
      <div class="stat-label">Key Terms</div>
    </div>
    <div class="stat">
      <div class="stat-value">${report.statistics.transcriptSegments}</div>
      <div class="stat-label">Segments</div>
    </div>
    <div class="stat">
      <div class="stat-value">${report.statistics.totalDefinitions}</div>
      <div class="stat-label">Definitions</div>
    </div>
  </div>

  <div class="section">
    <h2>💰 API Usage Costs</h2>
    <div class="costs">
      <div class="cost-item">
        <span>LLM Processing:</span>
        <span>$${report.costs.llm.toFixed(6)}</span>
      </div>
      <div class="cost-item">
        <span>Transcription:</span>
        <span>$${report.costs.transcription.toFixed(6)}</span>
      </div>
      <div class="cost-item">
        <span>Knowledge Retrieval:</span>
        <span>$${report.costs.knowledge.toFixed(6)}</span>
      </div>
      <div class="cost-item cost-total">
        <span>Total Cost:</span>
        <span>$${report.costs.total.toFixed(6)}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>📋 Executive Summary</h2>
    <div style="white-space: pre-line;">${report.summary}</div>
  </div>

  <div class="section">
    <h2>🔍 Key Terms & Definitions</h2>
    ${report.keyTerms.slice(0, 15).map(term => `
      <div class="term">
        <div class="term-name">${term.term} (mentioned ${term.frequency}x)</div>
        <div class="term-definition">${term.definition}</div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <h2>📝 Full Transcript</h2>
    ${report.fullTranscript.map(segment => `
      <div class="transcript-segment">
        <span class="timestamp">${new Date(segment.timestamp).toLocaleTimeString()}</span>
        ${segment.text}
      </div>
    `).join('')}
  </div>

  <div class="footer">
    Generated by Meeting Intelligence Assistant • ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`;
    
    return html;
  }
}

module.exports = ReportService;