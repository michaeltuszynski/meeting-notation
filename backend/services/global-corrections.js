const { EventEmitter } = require('events');

class GlobalCorrectionService extends EventEmitter {
    constructor(db) {
        super();
        this.db = db;
        this.corrections = new Map(); // Cache for performance
        this.phoneticsCache = new Map();
        this.loadCorrections();
    }

    async loadCorrections() {
        try {
            const query = `
                SELECT * FROM global_corrections 
                WHERE is_active = true 
                ORDER BY usage_count DESC, original_term ASC
            `;
            const result = await this.db.query(query);
            
            // Build correction cache
            this.corrections.clear();
            result.rows.forEach(correction => {
                this.corrections.set(correction.original_term.toLowerCase(), correction);
            });
            
            console.log(`[Corrections] Loaded ${this.corrections.size} global corrections`);
        } catch (error) {
            console.error('Error loading corrections:', error);
        }
    }

    // Apply corrections to a text string
    applyCorrections(text, meetingId = null) {
        if (!text || typeof text !== 'string') return text;
        
        let correctedText = text;
        const appliedCorrections = [];
        
        // Apply corrections in order of usage count (most used first)
        for (const [originalTerm, correction] of this.corrections) {
            if (!correction.auto_apply) continue;
            
            const flags = correction.case_sensitive ? 'g' : 'gi';
            const pattern = correction.whole_word_only 
                ? new RegExp(`\\b${this.escapeRegExp(correction.original_term)}\\b`, flags)
                : new RegExp(this.escapeRegExp(correction.original_term), flags);
            
            if (pattern.test(correctedText)) {
                correctedText = correctedText.replace(pattern, correction.corrected_term);
                appliedCorrections.push({
                    id: correction.id,
                    original: correction.original_term,
                    corrected: correction.corrected_term,
                    category: correction.category
                });
                
                // Update usage statistics
                this.updateUsageStats(correction.id, meetingId);
            }
        }
        
        return {
            text: correctedText,
            corrections: appliedCorrections,
            hasChanges: appliedCorrections.length > 0
        };
    }

    // Add a new global correction
    async addCorrection(original, corrected, options = {}) {
        try {
            const {
                category = 'general',
                confidenceThreshold = 0.8,
                autoApply = true,
                caseSensitive = false,
                wholeWordOnly = true,
                createdByUserId = null
            } = options;

            // Check if correction already exists
            const existingQuery = `
                SELECT id FROM global_corrections 
                WHERE LOWER(original_term) = LOWER($1) 
                AND LOWER(corrected_term) = LOWER($2)
                AND is_active = true
            `;
            const existing = await this.db.query(existingQuery, [original, corrected]);
            
            if (existing.rows.length > 0) {
                throw new Error('Correction already exists');
            }

            const insertQuery = `
                INSERT INTO global_corrections (
                    original_term, corrected_term, category, confidence_threshold,
                    auto_apply, case_sensitive, whole_word_only, created_by_user_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
            
            const result = await this.db.query(insertQuery, [
                original, corrected, category, confidenceThreshold,
                autoApply, caseSensitive, wholeWordOnly, createdByUserId
            ]);

            const newCorrection = result.rows[0];
            
            // Update cache
            this.corrections.set(original.toLowerCase(), newCorrection);
            
            // Emit event for real-time updates
            this.emit('correction:added', newCorrection);
            
            console.log(`[Corrections] Added: "${original}" → "${corrected}"`);
            return newCorrection;
        } catch (error) {
            console.error('Error adding correction:', error);
            throw error;
        }
    }

    // Remove a correction
    async removeCorrection(correctionId) {
        try {
            const query = `
                UPDATE global_corrections 
                SET is_active = false 
                WHERE id = $1
                RETURNING *
            `;
            const result = await this.db.query(query, [correctionId]);
            
            if (result.rows.length === 0) {
                throw new Error('Correction not found');
            }

            const correction = result.rows[0];
            
            // Remove from cache
            this.corrections.delete(correction.original_term.toLowerCase());
            
            // Emit event for real-time updates
            this.emit('correction:removed', correction);
            
            console.log(`[Corrections] Removed: "${correction.original_term}"`);
            return correction;
        } catch (error) {
            console.error('Error removing correction:', error);
            throw error;
        }
    }

    // Get all corrections
    async getAllCorrections() {
        try {
            const query = `
                SELECT *, 
                       (SELECT COUNT(*) FROM correction_applications WHERE correction_id = global_corrections.id) as total_applications
                FROM global_corrections 
                WHERE is_active = true 
                ORDER BY usage_count DESC, original_term ASC
            `;
            const result = await this.db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error getting corrections:', error);
            return [];
        }
    }

    // Find suggestions for a term using phonetic matching
    findSuggestions(term, limit = 5) {
        const suggestions = [];
        const termLower = term.toLowerCase();
        
        // Exact matches first
        if (this.corrections.has(termLower)) {
            const correction = this.corrections.get(termLower);
            suggestions.push({
                type: 'exact',
                original: correction.original_term,
                corrected: correction.corrected_term,
                confidence: 1.0,
                category: correction.category
            });
        }
        
        // Partial matches
        for (const [originalTerm, correction] of this.corrections) {
            if (originalTerm.includes(termLower) || termLower.includes(originalTerm)) {
                if (!suggestions.some(s => s.original === correction.original_term)) {
                    suggestions.push({
                        type: 'partial',
                        original: correction.original_term,
                        corrected: correction.corrected_term,
                        confidence: this.calculateSimilarity(term, correction.original_term),
                        category: correction.category
                    });
                }
            }
        }
        
        // Sort by confidence and limit results
        return suggestions
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, limit);
    }

    // Calculate similarity between two strings (simple Levenshtein-based)
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
        return (longer.length - distance) / longer.length;
    }

    // Levenshtein distance algorithm
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,      // insertion
                    matrix[j - 1][i] + 1,      // deletion
                    matrix[j - 1][i - 1] + cost // substitution
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Update usage statistics
    async updateUsageStats(correctionId, meetingId = null) {
        try {
            // Update correction usage count
            await this.db.query(
                'UPDATE global_corrections SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = $1',
                [correctionId]
            );

            // Track application to specific meeting
            if (meetingId) {
                await this.db.query(`
                    INSERT INTO correction_applications (correction_id, meeting_id, applied_count)
                    VALUES ($1, $2, 1)
                    ON CONFLICT (correction_id, meeting_id) 
                    DO UPDATE SET applied_count = correction_applications.applied_count + 1
                `, [correctionId, meetingId]);
            }
        } catch (error) {
            console.error('Error updating usage stats:', error);
        }
    }

    // Get correction statistics
    async getStatistics() {
        try {
            const stats = await this.db.query(`
                SELECT 
                    COUNT(*) as total_corrections,
                    COUNT(CASE WHEN auto_apply THEN 1 END) as auto_apply_count,
                    SUM(usage_count) as total_applications,
                    COUNT(DISTINCT category) as categories_count
                FROM global_corrections 
                WHERE is_active = true
            `);

            const topCorrections = await this.db.query(`
                SELECT original_term, corrected_term, usage_count, category
                FROM global_corrections 
                WHERE is_active = true 
                ORDER BY usage_count DESC 
                LIMIT 10
            `);

            return {
                ...stats.rows[0],
                topCorrections: topCorrections.rows
            };
        } catch (error) {
            console.error('Error getting statistics:', error);
            return null;
        }
    }

    // Escape special regex characters
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Reload corrections cache (useful for real-time updates)
    async reloadCorrections() {
        await this.loadCorrections();
        this.emit('corrections:reloaded');
    }
}

module.exports = GlobalCorrectionService;