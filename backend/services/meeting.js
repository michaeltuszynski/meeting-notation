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
}

module.exports = MeetingService;