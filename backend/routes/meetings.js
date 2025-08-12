const express = require('express');
const router = express.Router();

module.exports = (meetingService, storageService, reportService) => {
  // Create new meeting
  router.post('/', async (req, res) => {
    try {
      const meeting = await meetingService.createMeeting(req.body);
      res.status(201).json(meeting);
    } catch (error) {
      console.error('Error creating meeting:', error);
      res.status(500).json({ error: 'Failed to create meeting' });
    }
  });

  // Get active meeting
  router.get('/active', async (req, res) => {
    try {
      const meeting = await meetingService.getActiveMeeting();
      res.json(meeting);
    } catch (error) {
      console.error('Error getting active meeting:', error);
      res.status(500).json({ error: 'Failed to get active meeting' });
    }
  });

  // List meetings (lightweight for sidebar)
  router.get('/', async (req, res) => {
    try {
      const { limit = 20, offset = 0, status, search, light = 'true' } = req.query;
      
      // Use lightweight method by default, full method only when explicitly requested
      const result = light === 'false' 
        ? await meetingService.listMeetings({
            limit: parseInt(limit),
            offset: parseInt(offset),
            status,
            searchTerm: search
          })
        : await meetingService.listMeetingsLight({
            limit: parseInt(limit),
            offset: parseInt(offset),
            status,
            searchTerm: search
          });
      
      res.json(result);
    } catch (error) {
      console.error('Error listing meetings:', error);
      res.status(500).json({ error: 'Failed to list meetings' });
    }
  });

  // Get specific meeting
  router.get('/:id', async (req, res) => {
    try {
      const meeting = await meetingService.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      res.json(meeting);
    } catch (error) {
      console.error('Error getting meeting:', error);
      res.status(500).json({ error: 'Failed to get meeting' });
    }
  });

  // End meeting
  router.put('/:id/end', async (req, res) => {
    try {
      const meeting = await meetingService.endMeeting(req.params.id);
      res.json(meeting);
    } catch (error) {
      console.error('Error ending meeting:', error);
      res.status(500).json({ error: 'Failed to end meeting' });
    }
  });

  // Delete meeting
  router.delete('/:id', async (req, res) => {
    try {
      // First, get the meeting to check if it's active
      const meeting = await meetingService.getMeeting(req.params.id);
      
      if (meeting && meeting.status === 'active') {
        // If it's active, end it first to clean up properly
        console.log(`[Routes] Ending active meeting ${req.params.id} before deletion`);
        await meetingService.endMeeting(req.params.id);
        
        // Clear the active meeting ID in the main server context
        // This is handled via the meeting:deleted event emitted below
      }
      
      // Now delete the meeting and all associated data
      await meetingService.deleteMeeting(req.params.id);
      
      // Emit event to notify frontend that meeting was deleted
      if (req.app.get('io')) {
        req.app.get('io').emit('meeting:deleted', { meetingId: req.params.id });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      res.status(500).json({ error: 'Failed to delete meeting' });
    }
  });

  // Get meeting transcripts
  router.get('/:id/transcripts', async (req, res) => {
    try {
      const { limit = 100, offset = 0, finalOnly = false } = req.query;
      const transcripts = await storageService.getTranscripts(req.params.id, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        finalOnly: finalOnly === 'true'
      });
      res.json(transcripts);
    } catch (error) {
      console.error('Error getting transcripts:', error);
      res.status(500).json({ error: 'Failed to get transcripts' });
    }
  });

  // Get meeting terms
  router.get('/:id/terms', async (req, res) => {
    try {
      const terms = await storageService.getExtractedTerms(req.params.id);
      res.json(terms);
    } catch (error) {
      console.error('Error getting terms:', error);
      res.status(500).json({ error: 'Failed to get terms' });
    }
  });

  // Export meeting
  router.get('/:id/export', async (req, res) => {
    try {
      const exportData = await storageService.exportMeeting(req.params.id);
      const { format = 'json' } = req.query;
      
      if (format === 'json') {
        res.json(exportData);
      } else if (format === 'csv') {
        // Convert to CSV format
        const csv = convertToCSV(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="meeting-${req.params.id}.csv"`);
        res.send(csv);
      } else {
        res.status(400).json({ error: 'Invalid export format' });
      }
    } catch (error) {
      console.error('Error exporting meeting:', error);
      res.status(500).json({ error: 'Failed to export meeting' });
    }
  });

  // Search meetings
  router.get('/search/:term', async (req, res) => {
    try {
      const meetings = await storageService.searchMeetings(req.params.term);
      res.json(meetings);
    } catch (error) {
      console.error('Error searching meetings:', error);
      res.status(500).json({ error: 'Failed to search meetings' });
    }
  });

  // Generate meeting report
  router.get('/:id/report', async (req, res) => {
    try {
      const { format = 'json', regenerate = 'false' } = req.query;
      const forceRegenerate = regenerate === 'true';
      const report = await reportService.generateMeetingReport(req.params.id, forceRegenerate);
      
      if (format === 'html') {
        const html = await reportService.generateReportHTML(report);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } else {
        res.json(report);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  return router;
};

function convertToCSV(data) {
  const lines = [];
  
  // Meeting info
  lines.push('Meeting Information');
  lines.push('ID,Title,Description,Start Time,End Time,Duration (s),Word Count,Term Count');
  lines.push([
    data.meeting.id,
    `"${data.meeting.title}"`,
    `"${data.meeting.description || ''}"`,
    data.meeting.startTime,
    data.meeting.endTime,
    data.meeting.duration,
    data.meeting.wordCount,
    data.meeting.termCount
  ].join(','));
  
  lines.push('');
  lines.push('Transcripts');
  lines.push('Timestamp,Speaker,Text,Confidence');
  data.transcripts.forEach(t => {
    lines.push([
      t.timestamp,
      t.speaker || '',
      `"${t.text.replace(/"/g, '""')}"`,
      t.confidence
    ].join(','));
  });
  
  lines.push('');
  lines.push('Extracted Terms');
  lines.push('Term,Frequency,Definition');
  data.terms.forEach(t => {
    lines.push([
      `"${t.term}"`,
      t.frequency,
      `"${(t.definition || '').replace(/"/g, '""')}"`
    ].join(','));
  });
  
  return lines.join('\n');
}