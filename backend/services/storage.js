class StorageService {
  constructor(db) {
    this.db = db;
    this.transcriptSequence = new Map(); // Track sequence numbers per meeting
  }

  async saveTranscript(meetingId, transcriptData) {
    const { text, isFinal, confidence, speaker, timestamp } = transcriptData;
    
    // Get next sequence number for this meeting
    if (!this.transcriptSequence.has(meetingId)) {
      const result = await this.db.query(
        'SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM transcripts WHERE meeting_id = $1',
        [meetingId]
      );
      this.transcriptSequence.set(meetingId, result.rows[0].max_seq);
    }
    
    const sequenceNumber = this.transcriptSequence.get(meetingId) + 1;
    this.transcriptSequence.set(meetingId, sequenceNumber);
    
    const query = `
      INSERT INTO transcripts (meeting_id, text, is_final, confidence, speaker, timestamp, sequence_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    try {
      const result = await this.db.query(query, [
        meetingId,
        text,
        isFinal || false,
        confidence,
        speaker,
        timestamp || new Date(),
        sequenceNumber
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('[Storage Service] Error saving transcript:', error);
      throw error;
    }
  }

  async saveExtractedTerms(meetingId, terms) {
    if (!terms || terms.length === 0) return [];
    
    try {
      const savedTerms = [];
      
      for (const term of terms) {
        // Check if term already exists for this meeting
        const existingResult = await this.db.query(
          'SELECT * FROM extracted_terms WHERE meeting_id = $1 AND term = $2',
          [meetingId, term]
        );
        
        if (existingResult.rows.length > 0) {
          // Update frequency and last occurrence
          const updateQuery = `
            UPDATE extracted_terms 
            SET frequency = frequency + 1,
                last_occurrence = CURRENT_TIMESTAMP
            WHERE meeting_id = $1 AND term = $2
            RETURNING *
          `;
          
          const updateResult = await this.db.query(updateQuery, [meetingId, term]);
          savedTerms.push(updateResult.rows[0]);
        } else {
          // Insert new term
          const insertQuery = `
            INSERT INTO extracted_terms (meeting_id, term)
            VALUES ($1, $2)
            RETURNING *
          `;
          
          const insertResult = await this.db.query(insertQuery, [meetingId, term]);
          savedTerms.push(insertResult.rows[0]);
        }
      }
      
      return savedTerms;
    } catch (error) {
      console.error('[Storage Service] Error saving extracted terms:', error);
      throw error;
    }
  }

  async saveTermDefinition(term, definition, sources) {
    const query = `
      INSERT INTO term_definitions (term, definition, sources)
      VALUES ($1, $2, $3)
      ON CONFLICT (term) 
      DO UPDATE SET 
        definition = $2,
        sources = $3,
        cached_at = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours'
      RETURNING *
    `;
    
    try {
      const result = await this.db.query(query, [term, definition, JSON.stringify(sources)]);
      return result.rows[0];
    } catch (error) {
      console.error('[Storage Service] Error saving term definition:', error);
      throw error;
    }
  }

  async getTranscripts(meetingId, options = {}) {
    const { limit = 100, offset = 0, finalOnly = false } = options;
    
    let query = `
      SELECT * FROM transcripts 
      WHERE meeting_id = $1
    `;
    
    const params = [meetingId];
    
    if (finalOnly) {
      query += ' AND is_final = true';
    }
    
    query += ' ORDER BY sequence_number ASC';
    
    if (limit) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }
    
    if (offset) {
      params.push(offset);
      query += ` OFFSET $${params.length}`;
    }
    
    try {
      const result = await this.db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('[Storage Service] Error getting transcripts:', error);
      throw error;
    }
  }

  async getExtractedTerms(meetingId) {
    const query = `
      SELECT et.*, td.definition, td.sources
      FROM extracted_terms et
      LEFT JOIN term_definitions td ON et.term = td.term
      WHERE et.meeting_id = $1
      ORDER BY et.frequency DESC, et.first_occurrence ASC
    `;
    
    try {
      const result = await this.db.query(query, [meetingId]);
      return result.rows;
    } catch (error) {
      console.error('[Storage Service] Error getting extracted terms:', error);
      throw error;
    }
  }

  async getTermDefinition(term) {
    const query = `
      SELECT * FROM term_definitions 
      WHERE term = $1 AND expires_at > CURRENT_TIMESTAMP
    `;
    
    try {
      const result = await this.db.query(query, [term]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('[Storage Service] Error getting term definition:', error);
      throw error;
    }
  }

  async exportMeeting(meetingId) {
    try {
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
      
      // Get transcripts
      const transcripts = await this.getTranscripts(meetingId, { finalOnly: true });
      
      // Get extracted terms with definitions
      const terms = await this.getExtractedTerms(meetingId);
      
      // Build export object
      const exportData = {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          description: meeting.description,
          startTime: meeting.start_time,
          endTime: meeting.end_time,
          duration: meeting.duration_seconds,
          wordCount: meeting.word_count,
          termCount: meeting.term_count,
          keyTopics: meeting.key_topics
        },
        transcripts: transcripts.map(t => ({
          text: t.text,
          confidence: t.confidence,
          timestamp: t.timestamp,
          speaker: t.speaker
        })),
        terms: terms.map(t => ({
          term: t.term,
          frequency: t.frequency,
          definition: t.definition,
          sources: t.sources
        })),
        exportedAt: new Date()
      };
      
      return exportData;
    } catch (error) {
      console.error('[Storage Service] Error exporting meeting:', error);
      throw error;
    }
  }

  async searchMeetings(searchTerm) {
    const query = `
      SELECT DISTINCT m.*, mm.duration_seconds, mm.word_count, mm.term_count
      FROM meetings m
      LEFT JOIN meeting_metadata mm ON m.id = mm.meeting_id
      LEFT JOIN transcripts t ON m.id = t.meeting_id
      LEFT JOIN extracted_terms et ON m.id = et.meeting_id
      WHERE 
        m.title ILIKE $1 OR 
        m.description ILIKE $1 OR
        t.text ILIKE $1 OR
        et.term ILIKE $1
      ORDER BY m.created_at DESC
      LIMIT 50
    `;
    
    try {
      const result = await this.db.query(query, [`%${searchTerm}%`]);
      return result.rows;
    } catch (error) {
      console.error('[Storage Service] Error searching meetings:', error);
      throw error;
    }
  }

  clearSequenceCache(meetingId) {
    this.transcriptSequence.delete(meetingId);
  }
}

module.exports = StorageService;