const db = require('../db/postgres');

class SpeakerTimelineService {
    constructor() {
        this.activeSpeakers = new Map(); // Track active speakers per meeting
        this.speakerStats = new Map(); // Track statistics per meeting
    }

    /**
     * Process incoming speaker segments from transcript
     */
    async processSpeakerSegments(meetingId, segments) {
        if (!segments || segments.length === 0) return;

        const client = await db.getClient();
        
        try {
            await client.query('BEGIN');
            
            for (const segment of segments) {
                // Insert speaker segment
                await client.query(`
                    INSERT INTO speaker_segments 
                    (meeting_id, speaker_id, start_time, end_time, text, word_count, confidence)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    meetingId,
                    segment.speaker,
                    segment.startTime,
                    segment.endTime,
                    segment.text,
                    segment.words ? segment.words.length : 0,
                    segment.confidence
                ]);
                
                // Update speaker statistics
                await this.updateSpeakerStats(client, meetingId, segment);
            }
            
            await client.query('COMMIT');
            
            // Update in-memory tracking
            this.updateActiveSpeakers(meetingId, segments);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error processing speaker segments:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Process speaker transitions/changes
     */
    async processSpeakerTransitions(meetingId, changes) {
        if (!changes || changes.length === 0) return;

        const client = await db.getClient();
        
        try {
            await client.query('BEGIN');
            
            for (const change of changes) {
                // Insert speaker transition
                await client.query(`
                    INSERT INTO speaker_transitions 
                    (meeting_id, from_speaker, to_speaker, transition_time)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT DO NOTHING
                `, [
                    meetingId,
                    change.fromSpeaker || null,
                    change.toSpeaker,
                    change.timestamp
                ]);
            }
            
            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error processing speaker transitions:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Process individual words with speaker information
     */
    async processWordsWithSpeakers(meetingId, words, transcriptId) {
        if (!words || words.length === 0) return;

        const client = await db.getClient();
        
        try {
            await client.query('BEGIN');
            
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                
                // Update transcript with speaker information
                await client.query(`
                    UPDATE transcripts 
                    SET speaker_id = $1, speaker_confidence = $2, start_time = $3, end_time = $4, word_index = $5
                    WHERE id = $6 AND text LIKE $7
                `, [
                    word.speaker,
                    word.speaker_confidence || null,
                    word.start,
                    word.end,
                    i,
                    transcriptId,
                    `%${word.word}%`
                ]);
            }
            
            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error processing words with speakers:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update speaker statistics
     */
    async updateSpeakerStats(client, meetingId, segment) {
        const speakingTime = segment.endTime - segment.startTime;
        const wordCount = segment.words ? segment.words.length : 0;
        
        await client.query(`
            INSERT INTO speaker_stats 
            (meeting_id, speaker_id, total_speaking_time, word_count, segment_count, first_speech_time, last_speech_time)
            VALUES ($1, $2, $3, $4, 1, $5, $6)
            ON CONFLICT (meeting_id, speaker_id) 
            DO UPDATE SET
                total_speaking_time = speaker_stats.total_speaking_time + $3,
                word_count = speaker_stats.word_count + $4,
                segment_count = speaker_stats.segment_count + 1,
                first_speech_time = LEAST(speaker_stats.first_speech_time, $5),
                last_speech_time = GREATEST(speaker_stats.last_speech_time, $6),
                updated_at = CURRENT_TIMESTAMP
        `, [
            meetingId,
            segment.speaker,
            speakingTime,
            wordCount,
            segment.startTime,
            segment.endTime
        ]);
    }

    /**
     * Update active speakers tracking in memory
     */
    updateActiveSpeakers(meetingId, segments) {
        if (!this.activeSpeakers.has(meetingId)) {
            this.activeSpeakers.set(meetingId, new Set());
        }
        
        const speakers = this.activeSpeakers.get(meetingId);
        segments.forEach(segment => speakers.add(segment.speaker));
    }

    /**
     * Get timeline visualization data for a meeting
     */
    async getTimelineData(meetingId, options = {}) {
        const { resolution = 1.0, maxSegments = 1000 } = options;
        
        const client = await db.getClient();
        
        try {
            // Get speaker segments with optional downsampling
            const segmentsQuery = `
                SELECT 
                    speaker_id,
                    start_time,
                    end_time,
                    text,
                    confidence,
                    (end_time - start_time) as duration
                FROM speaker_segments 
                WHERE meeting_id = $1
                ORDER BY start_time
                LIMIT $2
            `;
            
            const segmentsResult = await client.query(segmentsQuery, [meetingId, maxSegments]);
            
            // Get speaker statistics
            const statsQuery = `
                SELECT * FROM speaker_stats 
                WHERE meeting_id = $1
                ORDER BY total_speaking_time DESC
            `;
            
            const statsResult = await client.query(statsQuery, [meetingId]);
            
            // Calculate timeline markers
            const timeline = this.generateTimelineMarkers(segmentsResult.rows, resolution);
            
            return {
                segments: segmentsResult.rows,
                statistics: statsResult.rows,
                timeline: timeline,
                activeSpeakers: Array.from(this.activeSpeakers.get(meetingId) || [])
            };
            
        } catch (error) {
            console.error('Error getting timeline data:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Generate timeline markers for visualization
     */
    generateTimelineMarkers(segments, resolution) {
        if (segments.length === 0) return [];
        
        const maxTime = Math.max(...segments.map(s => s.end_time));
        const markers = [];
        
        for (let time = 0; time <= maxTime; time += resolution) {
            const activeSegments = segments.filter(s => 
                s.start_time <= time && s.end_time > time
            );
            
            if (activeSegments.length > 0) {
                markers.push({
                    timestamp: time,
                    activeSpeakers: activeSegments.map(s => s.speaker_id),
                    dominantSpeaker: activeSegments.reduce((prev, current) => 
                        (current.confidence > prev.confidence) ? current : prev
                    ).speaker_id
                });
            }
        }
        
        return markers;
    }

    /**
     * Calculate speaking time analytics
     */
    async getSpeakingTimeAnalytics(meetingId) {
        const client = await db.getClient();
        
        try {
            const query = `
                SELECT 
                    speaker_id,
                    total_speaking_time,
                    word_count,
                    segment_count,
                    first_speech_time,
                    last_speech_time,
                    ROUND((total_speaking_time / NULLIF(
                        (SELECT SUM(total_speaking_time) FROM speaker_stats WHERE meeting_id = $1), 0
                    ) * 100)::numeric, 2) as speaking_percentage
                FROM speaker_stats 
                WHERE meeting_id = $1
                ORDER BY total_speaking_time DESC
            `;
            
            const result = await client.query(query, [meetingId]);
            
            return {
                speakers: result.rows,
                totalSpeakers: result.rows.length,
                totalSpeakingTime: result.rows.reduce((sum, s) => sum + parseFloat(s.total_speaking_time), 0),
                mostActiveSpeaker: result.rows[0]?.speaker_id || null
            };
            
        } catch (error) {
            console.error('Error calculating speaking time analytics:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get speaker transitions for a meeting
     */
    async getSpeakerTransitions(meetingId) {
        const client = await db.getClient();
        
        try {
            const query = `
                WITH speaker_transitions AS (
                    SELECT 
                        speaker_id,
                        start_time,
                        LAG(speaker_id) OVER (ORDER BY start_time) as prev_speaker,
                        LAG(end_time) OVER (ORDER BY start_time) as prev_end_time
                    FROM speaker_segments 
                    WHERE meeting_id = $1
                    ORDER BY start_time
                )
                SELECT 
                    prev_speaker,
                    speaker_id as current_speaker,
                    start_time as transition_time,
                    CASE 
                        WHEN prev_end_time IS NOT NULL 
                        THEN start_time - prev_end_time 
                        ELSE 0 
                    END as gap_duration
                FROM speaker_transitions
                WHERE prev_speaker IS NOT NULL 
                AND prev_speaker != speaker_id
                ORDER BY start_time
            `;
            
            const result = await client.query(query, [meetingId]);
            
            return result.rows;
            
        } catch (error) {
            console.error('Error getting speaker transitions:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Clean up data for completed meeting
     */
    async finalizeMeeting(meetingId) {
        // Remove from active tracking
        this.activeSpeakers.delete(meetingId);
        this.speakerStats.delete(meetingId);
        
        console.log(`Speaker timeline finalized for meeting ${meetingId}`);
    }

    /**
     * Get current active speaker for a meeting
     */
    getCurrentActiveSpeaker(meetingId) {
        const speakers = this.activeSpeakers.get(meetingId);
        if (!speakers || speakers.size === 0) return null;
        
        // Return the most recently active speaker
        // This is a simplified approach - in practice you might want more sophisticated logic
        return Array.from(speakers).pop();
    }

    /**
     * Get real-time speaker statistics
     */
    getRealTimeStats(meetingId) {
        return {
            activeSpeakers: Array.from(this.activeSpeakers.get(meetingId) || []),
            currentSpeaker: this.getCurrentActiveSpeaker(meetingId),
            speakerCount: (this.activeSpeakers.get(meetingId) || new Set()).size
        };
    }
}

module.exports = new SpeakerTimelineService();