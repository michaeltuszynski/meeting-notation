const { v4: uuidv4 } = require('uuid');

class MeetingService {
  constructor(db) {
    this.db = db;
  }

  async createMeeting(data) {
    const { title, description } = data;
    const query = `
      INSERT INTO meetings (title, description, status)
      VALUES ($1, $2, 'active')
      RETURNING *
    `;
    
    try {
      const result = await this.db.query(query, [title || `Meeting ${new Date().toLocaleDateString()}`, description]);
      const meeting = result.rows[0];
      console.log(`[Meeting Service] Created new meeting: ${meeting.id}`);
      return meeting;
    } catch (error) {
      console.error('[Meeting Service] Error creating meeting:', error);
      throw error;
    }
  }

  async endMeeting(meetingId) {
    const query = `
      UPDATE meetings 
      SET end_time = CURRENT_TIMESTAMP, 
          status = 'ended'
      WHERE id = $1 AND status = 'active'
      RETURNING *
    `;
    
    try {
      const result = await this.db.query(query, [meetingId]);
      if (result.rows.length === 0) {
        throw new Error('Meeting not found or already ended');
      }
      
      // Calculate and store meeting metadata
      await this.calculateMeetingMetadata(meetingId);
      
      console.log(`[Meeting Service] Ended meeting: ${meetingId}`);
      return result.rows[0];
    } catch (error) {
      console.error('[Meeting Service] Error ending meeting:', error);
      throw error;
    }
  }

  async getMeeting(meetingId) {
    const query = `
      SELECT m.*, mm.duration_seconds, mm.word_count, mm.term_count, mm.summary
      FROM meetings m
      LEFT JOIN meeting_metadata mm ON m.id = mm.meeting_id
      WHERE m.id = $1
    `;
    
    try {
      const result = await this.db.query(query, [meetingId]);
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows[0];
    } catch (error) {
      console.error('[Meeting Service] Error getting meeting:', error);
      throw error;
    }
  }

  async listMeetings(options = {}) {
    const { limit = 20, offset = 0, status = null, searchTerm = null } = options;
    
    let query = `
      SELECT m.*, mm.duration_seconds, mm.word_count, mm.term_count,
             COUNT(DISTINCT t.id) as transcript_count,
             COUNT(DISTINCT et.term) as unique_terms_count
      FROM meetings m
      LEFT JOIN meeting_metadata mm ON m.id = mm.meeting_id
      LEFT JOIN transcripts t ON m.id = t.meeting_id
      LEFT JOIN extracted_terms et ON m.id = et.meeting_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (status) {
      params.push(status);
      query += ` AND m.status = $${++paramCount}`;
    }
    
    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      query += ` AND (m.title ILIKE $${++paramCount} OR m.description ILIKE $${paramCount})`;
    }
    
    query += `
      GROUP BY m.id, mm.duration_seconds, mm.word_count, mm.term_count, mm.summary
      ORDER BY m.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    params.push(limit, offset);
    
    try {
      const result = await this.db.query(query, params);
      
      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) FROM meetings WHERE 1=1';
      const countParams = [];
      
      if (status) {
        countParams.push(status);
        countQuery += ` AND status = $${countParams.length}`;
      }
      
      if (searchTerm) {
        countParams.push(`%${searchTerm}%`);
        countQuery += ` AND (title ILIKE $${countParams.length} OR description ILIKE $${countParams.length})`;
      }
      
      const countResult = await this.db.query(countQuery, countParams);
      
      return {
        meetings: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      };
    } catch (error) {
      console.error('[Meeting Service] Error listing meetings:', error);
      throw error;
    }
  }

  async listMeetingsLight(options = {}) {
    const { limit = 20, offset = 0, status = null, searchTerm = null } = options;
    
    // Lightweight query for sidebar - no expensive JOINs with transcript/term tables
    let query = `
      SELECT m.id, m.title, m.description, m.start_time, m.end_time, m.status, m.created_at,
             mm.duration_seconds, mm.word_count, mm.term_count
      FROM meetings m
      LEFT JOIN meeting_metadata mm ON m.id = mm.meeting_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (status) {
      params.push(status);
      query += ` AND m.status = $${++paramCount}`;
    }
    
    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      query += ` AND (m.title ILIKE $${++paramCount} OR m.description ILIKE $${paramCount})`;
    }
    
    query += `
      ORDER BY m.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    params.push(limit, offset);
    
    try {
      const result = await this.db.query(query, params);
      
      // Get total count for pagination (still lightweight)
      let countQuery = 'SELECT COUNT(*) FROM meetings WHERE 1=1';
      const countParams = [];
      
      if (status) {
        countParams.push(status);
        countQuery += ` AND status = $${countParams.length}`;
      }
      
      if (searchTerm) {
        countParams.push(`%${searchTerm}%`);
        countQuery += ` AND (title ILIKE $${countParams.length} OR description ILIKE $${countParams.length})`;
      }
      
      const countResult = await this.db.query(countQuery, countParams);
      
      return {
        meetings: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      };
    } catch (error) {
      console.error('[Meeting Service] Error listing meetings (light):', error);
      throw error;
    }
  }

  async deleteMeeting(meetingId) {
    const query = 'DELETE FROM meetings WHERE id = $1 RETURNING *';
    
    try {
      const result = await this.db.query(query, [meetingId]);
      if (result.rows.length === 0) {
        throw new Error('Meeting not found');
      }
      console.log(`[Meeting Service] Deleted meeting: ${meetingId}`);
      return result.rows[0];
    } catch (error) {
      console.error('[Meeting Service] Error deleting meeting:', error);
      throw error;
    }
  }

  async getActiveMeeting() {
    const query = `
      SELECT * FROM meetings 
      WHERE status = 'active' 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    try {
      const result = await this.db.query(query);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('[Meeting Service] Error getting active meeting:', error);
      throw error;
    }
  }

  async calculateMeetingMetadata(meetingId) {
    try {
      // Get meeting duration
      const meetingResult = await this.db.query(
        'SELECT start_time, end_time FROM meetings WHERE id = $1',
        [meetingId]
      );
      
      if (meetingResult.rows.length === 0) return;
      
      const meeting = meetingResult.rows[0];
      const duration = meeting.end_time && meeting.start_time
        ? Math.floor((new Date(meeting.end_time) - new Date(meeting.start_time)) / 1000)
        : 0;
      
      // Get word count from transcripts
      const transcriptResult = await this.db.query(
        'SELECT SUM(array_length(string_to_array(text, \' \'), 1)) as word_count FROM transcripts WHERE meeting_id = $1',
        [meetingId]
      );
      
      const wordCount = transcriptResult.rows[0].word_count || 0;
      
      // Get term count
      const termResult = await this.db.query(
        'SELECT COUNT(DISTINCT term) as term_count FROM extracted_terms WHERE meeting_id = $1',
        [meetingId]
      );
      
      const termCount = termResult.rows[0].term_count || 0;
      
      // Get top terms as key topics
      const topTermsResult = await this.db.query(
        'SELECT term FROM extracted_terms WHERE meeting_id = $1 GROUP BY term ORDER BY COUNT(*) DESC LIMIT 5',
        [meetingId]
      );
      
      const keyTopics = topTermsResult.rows.map(row => row.term);
      
      // Insert or update metadata
      const metadataQuery = `
        INSERT INTO meeting_metadata (meeting_id, duration_seconds, word_count, term_count, key_topics)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (meeting_id) 
        DO UPDATE SET 
          duration_seconds = $2,
          word_count = $3,
          term_count = $4,
          key_topics = $5
      `;
      
      await this.db.query(metadataQuery, [meetingId, duration, wordCount, termCount, keyTopics]);
      
      console.log(`[Meeting Service] Updated metadata for meeting ${meetingId}`);
    } catch (error) {
      console.error('[Meeting Service] Error calculating metadata:', error);
    }
  }

  async storeMeetingCosts(meetingId, usageData) {
    const ApiCostCalculator = require('../utils/cost-calculator');
    const calculator = new ApiCostCalculator();
    
    try {
      // Calculate costs for this usage
      const newCosts = await calculator.calculateMeetingCostWithCurrentPricing(usageData);
      
      // Get current costs to accumulate
      const currentCostsQuery = `
        SELECT llm_cost, transcription_cost, knowledge_cost, total_cost, usage_data
        FROM meeting_costs 
        WHERE meeting_id = $1
      `;
      const currentResult = await this.db.query(currentCostsQuery, [meetingId]);
      
      let accumulatedCosts = {
        llm: newCosts.llm,
        transcription: newCosts.transcription,
        knowledge: newCosts.knowledge,
        total: newCosts.total
      };
      
      let accumulatedUsageData = usageData;
      
      // If costs already exist, accumulate them
      if (currentResult.rows.length > 0) {
        const current = currentResult.rows[0];
        accumulatedCosts = {
          llm: (parseFloat(current.llm_cost) || 0) + newCosts.llm,
          transcription: (parseFloat(current.transcription_cost) || 0) + newCosts.transcription,
          knowledge: (parseFloat(current.knowledge_cost) || 0) + newCosts.knowledge,
          total: (parseFloat(current.total_cost) || 0) + newCosts.total
        };
        
        // Merge usage data arrays
        const currentUsageData = current.usage_data ? 
          (typeof current.usage_data === 'string' ? JSON.parse(current.usage_data) : current.usage_data) : 
          { llm: [], transcription: [], knowledge: [] };
        
        accumulatedUsageData = {
          llm: [...(currentUsageData.llm || []), ...(usageData.llm || [])],
          transcription: [...(currentUsageData.transcription || []), ...(usageData.transcription || [])],
          knowledge: [...(currentUsageData.knowledge || []), ...(usageData.knowledge || [])]
        };
      }
      
      // Store accumulated costs
      const costQuery = `
        INSERT INTO meeting_costs (
          meeting_id, 
          llm_cost, 
          transcription_cost, 
          knowledge_cost, 
          total_cost,
          usage_data,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (meeting_id) 
        DO UPDATE SET 
          llm_cost = $2,
          transcription_cost = $3,
          knowledge_cost = $4,
          total_cost = $5,
          usage_data = $6,
          updated_at = NOW()
      `;
      
      await this.db.query(costQuery, [
        meetingId,
        accumulatedCosts.llm,
        accumulatedCosts.transcription,
        accumulatedCosts.knowledge,
        accumulatedCosts.total,
        JSON.stringify(accumulatedUsageData)
      ]);
      
      console.log(`[Meeting Service] Accumulated costs for meeting ${meetingId}: +$${newCosts.total.toFixed(6)} new, $${accumulatedCosts.total.toFixed(6)} total`);
    } catch (error) {
      console.error('[Meeting Service] Error storing cost data:', error);
      throw error;
    }
  }

  async addEnhancedSummaryCosts(meetingId, enhancedSummaryUsage) {
    const ApiCostCalculator = require('../utils/cost-calculator');
    const calculator = new ApiCostCalculator();
    
    try {
      // Get current costs
      const currentCostsQuery = `
        SELECT llm_cost, transcription_cost, knowledge_cost, total_cost, usage_data
        FROM meeting_costs 
        WHERE meeting_id = $1
      `;
      const currentResult = await this.db.query(currentCostsQuery, [meetingId]);
      
      // Initialize costs if not exists
      let currentCosts = {
        llm: 0,
        transcription: 0,
        knowledge: 0,
        total: 0
      };
      
      let currentUsageData = { llm: [], transcription: [], knowledge: [] };
      
      if (currentResult.rows.length > 0) {
        const row = currentResult.rows[0];
        currentCosts = {
          llm: parseFloat(row.llm_cost) || 0,
          transcription: parseFloat(row.transcription_cost) || 0,
          knowledge: parseFloat(row.knowledge_cost) || 0,
          total: parseFloat(row.total_cost) || 0
        };
        
        if (row.usage_data) {
          currentUsageData = typeof row.usage_data === 'string' 
            ? JSON.parse(row.usage_data) 
            : row.usage_data;
        }
      }
      
      // Calculate enhanced summary costs
      const enhancedSummaryUsageData = {
        llm: [{
          provider: 'openai', // Assuming enhanced summary uses OpenAI
          model: 'gpt-4o-mini',
          inputTokens: enhancedSummaryUsage.totalInputTokens,
          outputTokens: enhancedSummaryUsage.totalOutputTokens,
          calls: enhancedSummaryUsage.totalCalls,
          type: 'enhanced-summary',
          breakdown: enhancedSummaryUsage.stageBreakdown
        }],
        transcription: [],
        knowledge: []
      };
      
      const enhancedCosts = await calculator.calculateMeetingCostWithCurrentPricing(enhancedSummaryUsageData);
      
      // Add enhanced summary costs to current costs
      const updatedCosts = {
        llm: currentCosts.llm + enhancedCosts.llm,
        transcription: currentCosts.transcription,
        knowledge: currentCosts.knowledge,
        total: currentCosts.total + enhancedCosts.total
      };
      
      // Merge usage data
      const updatedUsageData = {
        llm: [...currentUsageData.llm, ...enhancedSummaryUsageData.llm],
        transcription: currentUsageData.transcription || [],
        knowledge: currentUsageData.knowledge || []
      };
      
      // Update costs in database
      const updateQuery = `
        INSERT INTO meeting_costs (
          meeting_id, 
          llm_cost, 
          transcription_cost, 
          knowledge_cost, 
          total_cost,
          usage_data,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (meeting_id) 
        DO UPDATE SET 
          llm_cost = $2,
          transcription_cost = $3,
          knowledge_cost = $4,
          total_cost = $5,
          usage_data = $6,
          updated_at = NOW()
      `;
      
      await this.db.query(updateQuery, [
        meetingId,
        updatedCosts.llm,
        updatedCosts.transcription,
        updatedCosts.knowledge,
        updatedCosts.total,
        JSON.stringify(updatedUsageData)
      ]);
      
      console.log(`[Meeting Service] Added enhanced summary costs for meeting ${meetingId}: +$${enhancedCosts.llm.toFixed(6)} LLM (${enhancedSummaryUsage.totalCalls} calls)`);
      
      return updatedCosts;
    } catch (error) {
      console.error('[Meeting Service] Error adding enhanced summary costs:', error);
      throw error;
    }
  }
}

module.exports = MeetingService;