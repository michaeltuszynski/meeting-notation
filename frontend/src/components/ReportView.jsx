import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, FileText, X, AlertTriangle, BarChart3, DollarSign, Bot, Sparkles, ClipboardList, KeyRound, FileSignature } from 'lucide-react';

// Simple markdown renderer
const renderMarkdown = (text) => {
    if (!text) return null;
    
    // Split by lines and process each line
    const lines = text.split('\n');
    const elements = [];
    let currentList = null;
    let listType = null;
    
    lines.forEach((line, index) => {
        // Headers
        if (line.startsWith('### ')) {
            if (currentList) {
                elements.push(currentList);
                currentList = null;
            }
            elements.push(
                <h4 key={index} style={{ marginTop: '15px', marginBottom: '10px', fontWeight: 'bold' }}>
                    {line.substring(4)}
                </h4>
            );
        } else if (line.startsWith('## ')) {
            if (currentList) {
                elements.push(currentList);
                currentList = null;
            }
            elements.push(
                <h3 key={index} style={{ marginTop: '20px', marginBottom: '10px', fontWeight: 'bold' }}>
                    {line.substring(3)}
                </h3>
            );
        } else if (line.startsWith('# ')) {
            if (currentList) {
                elements.push(currentList);
                currentList = null;
            }
            elements.push(
                <h2 key={index} style={{ marginTop: '20px', marginBottom: '15px', fontWeight: 'bold' }}>
                    {line.substring(2)}
                </h2>
            );
        }
        // Bold text (handle **text**)
        else if (line.includes('**')) {
            if (currentList) {
                elements.push(currentList);
                currentList = null;
            }
            const parts = line.split(/\*\*/);
            const formatted = parts.map((part, i) => 
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            );
            elements.push(
                <p key={index} style={{ marginBottom: '10px', lineHeight: '1.6' }}>
                    {formatted}
                </p>
            );
        }
        // Bullet points
        else if (line.startsWith('- ') || line.startsWith('* ')) {
            const listItem = <li key={index} style={{ marginBottom: '5px' }}>{line.substring(2)}</li>;
            if (!currentList || listType !== 'ul') {
                if (currentList) elements.push(currentList);
                currentList = <ul key={`ul-${index}`} style={{ marginLeft: '20px', marginBottom: '10px' }}>{[listItem]}</ul>;
                listType = 'ul';
            } else {
                currentList = <ul key={currentList.key} style={{ marginLeft: '20px', marginBottom: '10px' }}>
                    {[...currentList.props.children, listItem]}
                </ul>;
            }
        }
        // Numbered lists
        else if (/^\d+\.\s/.test(line)) {
            const listItem = <li key={index} style={{ marginBottom: '5px' }}>{line.replace(/^\d+\.\s/, '')}</li>;
            if (!currentList || listType !== 'ol') {
                if (currentList) elements.push(currentList);
                currentList = <ol key={`ol-${index}`} style={{ marginLeft: '20px', marginBottom: '10px' }}>{[listItem]}</ol>;
                listType = 'ol';
            } else {
                currentList = <ol key={currentList.key} style={{ marginLeft: '20px', marginBottom: '10px' }}>
                    {[...currentList.props.children, listItem]}
                </ol>;
            }
        }
        // Regular paragraphs
        else if (line.trim()) {
            if (currentList) {
                elements.push(currentList);
                currentList = null;
            }
            elements.push(
                <p key={index} style={{ marginBottom: '10px', lineHeight: '1.6' }}>
                    {line}
                </p>
            );
        }
    });
    
    // Add any remaining list
    if (currentList) {
        elements.push(currentList);
    }
    
    return <div>{elements}</div>;
};

function ReportView({ meetingId, onClose }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [error, setError] = useState(null);
    const [costsExpanded, setCostsExpanded] = useState(false);
    const [abortController, setAbortController] = useState(null);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    
    useEffect(() => {
        if (meetingId) {
            loadReport(false);
        }
    }, [meetingId]);
    
    // Add click outside handler to close export menu
    useEffect(() => {
        const handleClickOutside = () => {
            if (exportMenuOpen) {
                setExportMenuOpen(false);
            }
        };
        
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [exportMenuOpen]);
    
    const loadReport = async (forceRegenerate = false) => {
        // Cancel any existing request
        if (abortController) {
            abortController.abort();
        }
        
        // Create new AbortController for this request
        const controller = new AbortController();
        setAbortController(controller);
        
        if (forceRegenerate) {
            setRegenerating(true);
        } else {
            setLoading(true);
        }
        setError(null);
        
        try {
            const url = `http://localhost:9000/api/meetings/${meetingId}/report${forceRegenerate ? '?regenerate=true' : ''}`;
            const response = await fetch(url, {
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }
            const data = await response.json();
            setReport(data);
        } catch (err) {
            if (err.name === 'AbortError') {
                // Request was cancelled
                console.log('Report generation cancelled');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
            setRegenerating(false);
            setAbortController(null);
        }
    };
    
    const handleRegenerate = () => {
        loadReport(true);
    };
    
    const handleCancel = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
        }
        setLoading(false);
        setRegenerating(false);
        onClose();
    };

    const exportReport = (format) => {
        if (!report) return;
        
        const date = new Date().toISOString().split('T')[0];
        const filename = `${report.meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${date}`;
        
        if (format === 'markdown') {
            // Generate Markdown content
            let mdContent = `# ${report.meeting.title}\n\n`;
            mdContent += `**Date:** ${new Date(report.meeting.startTime).toLocaleDateString()}\n`;
            mdContent += `**Duration:** ${report.meeting.duration}\n`;
            mdContent += `**Words:** ${report.statistics.wordCount.toLocaleString()} | **Terms:** ${report.statistics.uniqueTerms}\n\n`;
            
            if (report.costs && report.costs.total > 0) {
                mdContent += `## API Usage Costs\n\n`;
                mdContent += `- **LLM Processing:** $${report.costs.llm.toFixed(6)}\n`;
                mdContent += `- **Transcription:** $${report.costs.transcription.toFixed(6)}\n`;
                mdContent += `- **Knowledge Retrieval:** $${report.costs.knowledge.toFixed(6)}\n`;
                mdContent += `- **Total:** $${report.costs.total.toFixed(6)}\n\n`;
            }
            
            mdContent += `## Executive Summary\n\n${report.summary}\n\n`;
            
            if (report.keyTerms && report.keyTerms.length > 0) {
                mdContent += `## Key Terms & Definitions\n\n`;
                report.keyTerms.forEach(term => {
                    mdContent += `### ${term.term} (${term.frequency}x)\n\n`;
                    mdContent += `${term.definition}\n\n`;
                    if (term.sources && term.sources.length > 0) {
                        mdContent += `**Sources:** ${term.sources.map(s => 
                            s.url !== 'meeting-context' ? `[${s.title}](${s.url})` : s.title
                        ).join(', ')}\n\n`;
                    }
                });
            }
            
            mdContent += `## Full Transcript\n\n`;
            report.fullTranscript.forEach(segment => {
                const time = new Date(segment.timestamp).toLocaleTimeString();
                const confidence = segment.confidence ? ` (${Math.round(segment.confidence * 100)}%)` : '';
                mdContent += `**[${time}]${confidence}** ${segment.text}\n\n`;
            });
            
            mdContent += `---\n\n*Generated on ${new Date().toLocaleString()}*\n`;
            
            const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.md`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'json') {
            const dataStr = JSON.stringify(report, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `${filename}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        } else if (format === 'csv') {
            // Export key terms as CSV
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Term,Frequency,Definition\\n";
            
            report.keyTerms.forEach(term => {
                const cleanDefinition = term.definition.replace(/"/g, '""').replace(/\\n/g, ' ');
                csvContent += `"${term.term}",${term.frequency},"${cleanDefinition}"\\n`;
            });
            
            const encodedUri = encodeURI(csvContent);
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', encodedUri);
            linkElement.setAttribute('download', `${filename}_terms.csv`);
            linkElement.click();
        } else if (format === 'html') {
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${report.meeting.title} - Meeting Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .term { border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .transcript { background: #f1f3f4; padding: 10px; margin: 5px 0; border-radius: 3px; }
        .costs { background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7; }
        .cost-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; margin: 15px 0; }
        .cost-item { background: white; padding: 15px; border-radius: 5px; text-align: center; border: 1px solid #ffeaa7; }
        .cost-total { background: #f8d7da; border: 2px solid #dc3545; }
        .cost-label { font-size: 12px; color: #856404; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
        .cost-total .cost-label { color: #721c24; }
        .cost-value { font-size: 20px; font-weight: bold; color: #495057; }
        .cost-total .cost-value { color: #721c24; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.meeting.title}</h1>
        <p><strong>Duration:</strong> ${report.meeting.duration} | <strong>Date:</strong> ${new Date(report.meeting.startTime).toLocaleDateString()}</p>
        <p><strong>Words:</strong> ${report.statistics.wordCount.toLocaleString()} | <strong>Terms:</strong> ${report.statistics.uniqueTerms} | <strong>Segments:</strong> ${report.statistics.transcriptSegments}</p>
    </div>
    
    ${report.costs && report.costs.total > 0 ? `
    <div class="costs">
        <h2>API Usage Costs</h2>
        <p style="color: #856404; font-size: 14px;">Estimated costs based on API provider pricing</p>
        <div class="cost-grid">
            <div class="cost-item">
                <div class="cost-label">LLM Processing</div>
                <div class="cost-value">$${report.costs.llm.toFixed(6)}</div>
            </div>
            <div class="cost-item">
                <div class="cost-label">Transcription</div>
                <div class="cost-value">$${report.costs.transcription.toFixed(6)}</div>
            </div>
            <div class="cost-item">
                <div class="cost-label">Knowledge Retrieval</div>
                <div class="cost-value">$${report.costs.knowledge.toFixed(6)}</div>
            </div>
            <div class="cost-item cost-total">
                <div class="cost-label">Total Cost</div>
                <div class="cost-value">$${report.costs.total.toFixed(6)}</div>
            </div>
        </div>
        ${report.costs.lastUpdated ? `<p style="font-size: 11px; color: #856404; font-style: italic;">Last updated: ${new Date(report.costs.lastUpdated).toLocaleString()}</p>` : ''}
    </div>
    ` : ''}
    
    <div class="summary">
        <h2>Summary</h2>
        ${report.summary.split('\\n').map(p => `<p>${p}</p>`).join('')}
    </div>
    
    <h2>Key Terms & Definitions (${report.keyTerms.length})</h2>
    ${report.keyTerms.map(term => `
        <div class="term">
            <h3>${term.term} <small>(${term.frequency} mentions)</small></h3>
            <p>${term.definition}</p>
        </div>
    `).join('')}
    
    <h2>Full Transcript</h2>
    ${report.fullTranscript.map(segment => `
        <div class="transcript">
            <small>${new Date(segment.timestamp).toLocaleTimeString()}</small><br>
            ${segment.text}
        </div>
    `).join('')}
    
    <p><em>Generated on ${new Date().toLocaleString()}</em></p>
</body>
</html>`;
            
            const dataUri = 'data:text/html;charset=utf-8,'+ encodeURIComponent(htmlContent);
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', `${filename}.html`);
            linkElement.click();
        }
    };

    if (loading) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '600px',
                height: '100vh',
                background: 'white',
                boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
            }}>
                {/* Add CSS animation keyframes */}
                <style>
                    {`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        @keyframes dots {
                            0%, 20% { content: '.'; }
                            40% { content: '..'; }
                            60%, 100% { content: '...'; }
                        }
                    `}
                </style>
                
                {/* Animated Spinner */}
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #007bff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '20px'
                }}></div>
                
                {/* Loading Text with Animated Dots */}
                <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold',
                    color: '#007bff',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }}>
                    {regenerating ? (
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5" />
                            Regenerating report with fresh AI analysis
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Generating meeting report
                        </div>
                    )}
                    <span style={{
                        animation: 'dots 1.5s infinite',
                        width: '20px',
                        textAlign: 'left'
                    }}>...</span>
                </div>
                
                <div style={{ 
                    color: '#6c757d', 
                    textAlign: 'center',
                    fontSize: '14px',
                    maxWidth: '300px'
                }}>
                    {regenerating ? 'This may take a moment as we re-analyze the entire meeting' : 'Analyzing transcript and generating insights...'}
                </div>
                
                {/* Cancel Button */}
                <button
                    onClick={handleCancel}
                    style={{
                        marginTop: '20px',
                        padding: '10px 24px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#c82333'}
                    onMouseOut={(e) => e.target.style.background = '#dc3545'}
                >
                    Cancel
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '600px',
                height: '100vh',
                background: 'white',
                boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{
                    padding: '15px 20px',
                    borderBottom: '1px solid #dee2e6',
                    background: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText className="h-5 w-5 text-red-500" />
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Meeting Report</h3>
                        </div>
                        <button onClick={onClose} style={{
                            width: '32px',
                            height: '32px',
                            background: 'white',
                            color: '#6c757d',
                            border: '1px solid #dee2e6',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: 'normal',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8f9fa';
                            e.currentTarget.style.borderColor = '#adb5bd';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.borderColor = '#dee2e6';
                        }}>
                            ×
                        </button>
                    </div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: '#dc3545' }}>
                        <AlertTriangle className="h-12 w-12 text-red-500" style={{ marginBottom: '20px' }} />
                        <h3>Error Loading Report</h3>
                        <p>{error}</p>
                        <button onClick={() => loadReport(false)} style={{
                            padding: '8px 16px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}>
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    if (!report) return null;
    
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '600px',
            height: '100vh',
            background: 'white',
            boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Regenerating Overlay */}
            {regenerating && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(255, 255, 255, 0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    flexDirection: 'column',
                    backdropFilter: 'blur(2px)'
                }}>
                    {/* Animated Spinner */}
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #007bff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '20px'
                    }}></div>
                    
                    {/* Animated Dots */}
                    <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        color: '#007bff',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Bot className="h-5 w-5" />
                            Regenerating report with fresh AI analysis
                        </div>
                        <span style={{
                            animation: 'dots 1.5s infinite',
                            width: '20px',
                            textAlign: 'left'
                        }}>...</span>
                    </div>
                    
                    <div style={{ 
                        color: '#6c757d', 
                        textAlign: 'center',
                        fontSize: '14px',
                        lineHeight: '1.5'
                    }}>
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sparkles className="h-4 w-4" />
                                Enhanced multi-stage processing
                            </div>
                        </div>
                        <small style={{ opacity: 0.8 }}>This may take 10-30 seconds</small>
                    </div>
                    
                    {/* Cancel Button */}
                    <button
                        onClick={handleCancel}
                        style={{
                            marginTop: '20px',
                            padding: '10px 24px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#c82333'}
                        onMouseOut={(e) => e.target.style.background = '#dc3545'}
                    >
                        Cancel Regeneration
                    </button>

                    {/* CSS Animations */}
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        
                        @keyframes dots {
                            0%, 20% { content: ''; }
                            40% { content: '.'; }
                            60% { content: '..'; }
                            80%, 100% { content: '...'; }
                        }
                    `}</style>
                </div>
            )}

            {/* Header */}
            <div style={{
                padding: '15px 20px',
                borderBottom: '1px solid #dee2e6',
                background: 'white'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                                {report.meeting.title}
                            </h3>
                            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                                {new Date(report.meeting.startTime).toLocaleDateString()} • {report.meeting.duration} • 
                                {report.statistics.wordCount.toLocaleString()} words
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        width: '32px',
                        height: '32px',
                        background: 'white',
                        color: '#6c757d',
                        border: '1px solid #dee2e6',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 'normal',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8f9fa';
                        e.currentTarget.style.borderColor = '#adb5bd';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = '#dee2e6';
                    }}>
                        ×
                    </button>
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{
                padding: '10px 15px',
                borderBottom: '1px solid #dee2e6',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                background: 'white'
            }}>
                {/* Regenerate Button */}
                <button 
                    onClick={handleRegenerate} 
                    disabled={regenerating}
                    style={{
                        padding: '6px 10px',
                        background: regenerating ? '#6c757d' : '#ffc107',
                        color: regenerating ? 'white' : '#212529',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: regenerating ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                    }}
                    title={regenerating ? 'Regenerating...' : 'Regenerate Report'}
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
                
                {/* Cache indicator */}
                {report?.cached && (
                    <span style={{
                        padding: '4px 8px',
                        background: '#d4edda',
                        color: '#155724',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: '500'
                    }}>
                        Cached
                    </span>
                )}
                
                {/* Export Dropdown */}
                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExportMenuOpen(!exportMenuOpen);
                        }}
                        style={{
                            padding: '6px 10px',
                            background: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        title="Export report"
                    >
                        <Download className="h-3.5 w-3.5" />
                    </button>
                    {exportMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '2px',
                            background: 'white',
                            border: '1px solid #dee2e6',
                            borderRadius: '3px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            zIndex: 1000,
                            minWidth: '100px'
                        }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    exportReport('markdown');
                                    setExportMenuOpen(false);
                                }}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    color: '#212529'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                Markdown
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    exportReport('html');
                                    setExportMenuOpen(false);
                                }}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderTop: '1px solid #dee2e6',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    color: '#212529'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                HTML Report
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    exportReport('json');
                                    setExportMenuOpen(false);
                                }}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderTop: '1px solid #dee2e6',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    color: '#212529'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                JSON Data
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    exportReport('csv');
                                    setExportMenuOpen(false);
                                }}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderTop: '1px solid #dee2e6',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    color: '#212529'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                CSV Terms
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* API Costs Section */}
                {report.costs && report.costs.total > 0 && (
                    <div style={{ 
                        borderBottom: '1px solid #dee2e6',
                        background: '#fff3cd'
                    }}>
                        <div 
                            onClick={() => setCostsExpanded(!costsExpanded)}
                            style={{ 
                                padding: '15px 20px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                userSelect: 'none'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <DollarSign className="h-4 w-4" />
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#856404' }}>
                                        API Usage Costs
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#856404', opacity: 0.8 }}>
                                        Total: ${report.costs.total.toFixed(6)}
                                    </div>
                                </div>
                            </div>
                            <div style={{ 
                                fontSize: '18px', 
                                color: '#856404',
                                transform: costsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.3s ease'
                            }}>
                                ▶
                            </div>
                        </div>
                        
                        {costsExpanded && (
                            <div style={{ padding: '0 20px 20px 20px' }}>
                                <div style={{ 
                                    fontSize: '13px', 
                                    color: '#856404',
                                    marginBottom: '15px'
                                }}>
                                    Estimated costs based on API provider pricing
                                </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            marginBottom: '15px'
                        }}>
                            <div style={{
                                padding: '12px',
                                background: 'white',
                                borderRadius: '5px',
                                border: '1px solid #ffeaa7'
                            }}>
                                <div style={{ 
                                    fontSize: '12px', 
                                    color: '#856404', 
                                    marginBottom: '5px',
                                    textTransform: 'uppercase',
                                    fontWeight: 'bold'
                                }}>
                                    LLM Processing
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
                                    ${report.costs.llm.toFixed(6)}
                                </div>
                            </div>
                            <div style={{
                                padding: '12px',
                                background: 'white',
                                borderRadius: '5px',
                                border: '1px solid #ffeaa7'
                            }}>
                                <div style={{ 
                                    fontSize: '12px', 
                                    color: '#856404', 
                                    marginBottom: '5px',
                                    textTransform: 'uppercase',
                                    fontWeight: 'bold'
                                }}>
                                    Transcription
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
                                    ${report.costs.transcription.toFixed(6)}
                                </div>
                            </div>
                            <div style={{
                                padding: '12px',
                                background: 'white',
                                borderRadius: '5px',
                                border: '1px solid #ffeaa7'
                            }}>
                                <div style={{ 
                                    fontSize: '12px', 
                                    color: '#856404', 
                                    marginBottom: '5px',
                                    textTransform: 'uppercase',
                                    fontWeight: 'bold'
                                }}>
                                    Knowledge Retrieval
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
                                    ${report.costs.knowledge.toFixed(6)}
                                </div>
                            </div>
                            <div style={{
                                padding: '12px',
                                background: '#f8d7da',
                                borderRadius: '5px',
                                border: '2px solid #dc3545'
                            }}>
                                <div style={{ 
                                    fontSize: '12px', 
                                    color: '#721c24', 
                                    marginBottom: '5px',
                                    textTransform: 'uppercase',
                                    fontWeight: 'bold'
                                }}>
                                    Total Cost
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#721c24' }}>
                                    ${report.costs.total.toFixed(6)}
                                </div>
                            </div>
                        </div>
                                {report.costs.lastUpdated && (
                                    <div style={{ fontSize: '11px', color: '#856404', fontStyle: 'italic' }}>
                                        Last updated: {new Date(report.costs.lastUpdated).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Summary Section */}
                <div style={{ 
                    padding: '20px', 
                    borderBottom: '1px solid #dee2e6',
                    background: '#f8f9fa'
                }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ClipboardList className="h-4 w-4" />
                            Executive Summary
                        </div>
                    </h3>
                    <div style={{ 
                        fontSize: '14px', 
                        lineHeight: '1.6',
                        padding: '15px',
                        background: 'white',
                        borderRadius: '5px',
                        border: '1px solid #dee2e6'
                    }}>
                        {renderMarkdown(report.summary)}
                    </div>
                </div>

                {/* Key Terms Section */}
                {report.keyTerms && report.keyTerms.length > 0 && (
                    <div style={{ padding: '20px', borderBottom: '1px solid #dee2e6' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <KeyRound className="h-4 w-4" />
                                Key Terms & Definitions ({report.keyTerms.length})
                            </div>
                        </h3>
                        <div style={{ fontSize: '13px', color: '#6c757d', marginBottom: '15px' }}>
                            Only terms with 3+ mentions are included to focus on key concepts
                        </div>
                        {report.keyTerms.map((term, index) => (
                            <div key={index} style={{
                                marginBottom: '15px',
                                padding: '15px',
                                border: '1px solid #dee2e6',
                                borderRadius: '5px',
                                background: '#f8f9fa'
                            }}>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    marginBottom: '8px'
                                }}>
                                    <strong style={{ fontSize: '14px', color: '#495057' }}>
                                        {term.term}
                                    </strong>
                                    <span style={{
                                        background: '#007bff',
                                        color: 'white',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: 'bold'
                                    }}>
                                        {term.frequency}x
                                    </span>
                                </div>
                                <div style={{ 
                                    fontSize: '13px', 
                                    color: '#6c757d', 
                                    lineHeight: '1.5'
                                }}>
                                    {term.definition}
                                </div>
                                {term.sources && term.sources.length > 0 && (
                                    <div style={{ marginTop: '10px', fontSize: '11px' }}>
                                        <strong>Sources:</strong> {' '}
                                        {term.sources.map((source, i) => (
                                            <span key={i}>
                                                {source.url !== 'meeting-context' ? (
                                                    <a href={source.url} target="_blank" rel="noopener noreferrer" 
                                                       style={{ color: '#007bff', textDecoration: 'none' }}>
                                                        {source.title}
                                                    </a>
                                                ) : (
                                                    <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                                                        {source.title}
                                                    </span>
                                                )}
                                                {i < term.sources.length - 1 && ', '}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Full Transcript Section */}
                <div style={{ padding: '20px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileSignature className="h-4 w-4" />
                            Full Transcript ({report.statistics.transcriptSegments} segments)
                        </div>
                    </h3>
                    <div style={{ fontSize: '13px', color: '#6c757d', marginBottom: '15px' }}>
                        Complete real-time transcription with timestamps and confidence scores
                    </div>
                    
                    <div>
                        {report.fullTranscript.map((segment, index) => (
                            <div key={index} style={{
                                marginBottom: '12px',
                                padding: '12px',
                                background: '#f8f9fa',
                                borderLeft: '3px solid #007bff',
                                borderRadius: '3px'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '5px'
                                }}>
                                    <span style={{
                                        fontSize: '11px',
                                        color: '#6c757d',
                                        fontFamily: 'monospace'
                                    }}>
                                        {new Date(segment.timestamp).toLocaleTimeString()}
                                    </span>
                                    {segment.confidence && (
                                        <span style={{
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            background: segment.confidence > 0.8 ? '#28a745' : 
                                                       segment.confidence > 0.6 ? '#ffc107' : '#dc3545',
                                            color: segment.confidence > 0.6 ? 'white' : 'black',
                                            borderRadius: '3px'
                                        }}>
                                            {Math.round(segment.confidence * 100)}%
                                        </span>
                                    )}
                                </div>
                                <span style={{
                                    fontSize: '14px',
                                    lineHeight: '1.5'
                                }}>
                                    {segment.text}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ReportView;