const express = require('express');
const router = express.Router();

// Get all global corrections
router.get('/', async (req, res) => {
    try {
        const corrections = await req.correctionService.getAllCorrections();
        res.json(corrections);
    } catch (error) {
        console.error('Error getting corrections:', error);
        res.status(500).json({ error: 'Failed to get corrections' });
    }
});

// Add a new correction
router.post('/', async (req, res) => {
    try {
        const { original, corrected, options = {} } = req.body;
        
        if (!original || !corrected) {
            return res.status(400).json({ error: 'Original and corrected terms are required' });
        }

        if (original === corrected) {
            return res.status(400).json({ error: 'Original and corrected terms cannot be the same' });
        }

        const correction = await req.correctionService.addCorrection(original, corrected, options);
        res.status(201).json(correction);
    } catch (error) {
        console.error('Error adding correction:', error);
        if (error.message === 'Correction already exists') {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to add correction' });
    }
});

// Update a correction
router.put('/:id', async (req, res) => {
    try {
        const correctionId = parseInt(req.params.id);
        const { corrected, options = {} } = req.body;
        
        if (!corrected) {
            return res.status(400).json({ error: 'Corrected term is required' });
        }

        // For now, we'll recreate the correction since we don't have an update method
        // In a production system, you'd want a proper update method
        const updatedCorrection = await req.correctionService.updateCorrection(correctionId, corrected, options);
        res.json(updatedCorrection);
    } catch (error) {
        console.error('Error updating correction:', error);
        res.status(500).json({ error: 'Failed to update correction' });
    }
});

// Remove a correction
router.delete('/:id', async (req, res) => {
    try {
        const correctionId = parseInt(req.params.id);
        const correction = await req.correctionService.removeCorrection(correctionId);
        res.json({ message: 'Correction removed', correction });
    } catch (error) {
        console.error('Error removing correction:', error);
        if (error.message === 'Correction not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to remove correction' });
    }
});

// Get correction suggestions for a term
router.get('/suggestions/:term', async (req, res) => {
    try {
        const term = decodeURIComponent(req.params.term);
        const limit = parseInt(req.query.limit) || 5;
        
        const suggestions = req.correctionService.findSuggestions(term, limit);
        res.json(suggestions);
    } catch (error) {
        console.error('Error getting suggestions:', error);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

// Apply corrections to text (for testing/preview)
router.post('/apply', async (req, res) => {
    try {
        const { text, meetingId } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const result = req.correctionService.applyCorrections(text, meetingId);
        res.json(result);
    } catch (error) {
        console.error('Error applying corrections:', error);
        res.status(500).json({ error: 'Failed to apply corrections' });
    }
});

// Get correction statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await req.correctionService.getStatistics();
        res.json(stats);
    } catch (error) {
        console.error('Error getting correction statistics:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Apply corrections retroactively to a meeting
router.post('/apply-to-meeting/:meetingId', async (req, res) => {
    try {
        const meetingId = parseInt(req.params.meetingId);
        
        // Get all transcripts for the meeting
        const transcriptsQuery = `
            SELECT id, text FROM transcripts 
            WHERE meeting_id = $1 
            ORDER BY timestamp ASC
        `;
        const transcripts = await req.db.query(transcriptsQuery, [meetingId]);
        
        let totalCorrections = 0;
        const updates = [];
        
        // Apply corrections to each transcript
        for (const transcript of transcripts.rows) {
            const result = req.correctionService.applyCorrections(transcript.text, meetingId);
            
            if (result.hasChanges) {
                // Update the transcript in the database
                await req.db.query(
                    'UPDATE transcripts SET text = $1 WHERE id = $2',
                    [result.text, transcript.id]
                );
                
                updates.push({
                    transcriptId: transcript.id,
                    originalText: transcript.text,
                    correctedText: result.text,
                    corrections: result.corrections
                });
                
                totalCorrections += result.corrections.length;
            }
        }
        
        // Re-extract terms with corrected transcripts if there were changes
        if (updates.length > 0) {
            // Trigger term re-extraction for this meeting
            req.io.emit('corrections:meeting-updated', {
                meetingId,
                totalCorrections,
                updatedTranscripts: updates.length
            });
        }
        
        res.json({
            success: true,
            meetingId,
            totalCorrections,
            updatedTranscripts: updates.length,
            updates
        });
    } catch (error) {
        console.error('Error applying corrections to meeting:', error);
        res.status(500).json({ error: 'Failed to apply corrections to meeting' });
    }
});

module.exports = router;