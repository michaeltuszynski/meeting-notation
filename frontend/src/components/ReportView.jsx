import React, { useState, useEffect } from 'react';

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
    const [error, setError] = useState(null);
    
    useEffect(() => {
        if (meetingId) {
            loadReport();
        }
    }, [meetingId]);
    
    const loadReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:9000/api/meetings/${meetingId}/report`);
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }
            const data = await response.json();
            setReport(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const exportReport = (format) => {
        const url = `http://localhost:9000/api/meetings/${meetingId}/report?format=${format}`;
        if (format === 'html') {
            window.open(url, '_blank');
        } else {
            window.location.href = url;
        }
    };
    
    const exportMarkdown = () => {
        if (!report) return;
        
        const markdown = `# Meeting Report: ${report.meeting.title}\n\n` +
            `**Date:** ${new Date(report.meeting.startTime).toLocaleDateString()}\n` +
            `**Duration:** ${report.meeting.duration}\n` +
            `**Total Words:** ${report.statistics.wordCount}\n` +
            `**Key Terms:** ${report.statistics.uniqueTerms}\n` +
            `**Definitions:** ${report.statistics.totalDefinitions}\n\n` +
            `## Executive Summary\n\n${report.summary}\n\n` +
            `## Key Terms & Definitions\n\n` +
            report.keyTerms.map(term => 
                `### ${term.term} (${term.frequency}x)\n${term.definition}\n`
            ).join('\n') +
            `\n## Full Transcript\n\n` +
            report.fullTranscript.map(segment => 
                `**${new Date(segment.timestamp).toLocaleTimeString()}:** ${segment.text}`
            ).join('\n\n');
        
        // Create blob and download
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-report-${meetingId}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const copyMarkdownToClipboard = async () => {
        if (!report) return;
        
        const markdown = `# Meeting Report: ${report.meeting.title}\n\n` +
            `**Date:** ${new Date(report.meeting.startTime).toLocaleDateString()}\n` +
            `**Duration:** ${report.meeting.duration}\n` +
            `**Total Words:** ${report.statistics.wordCount}\n` +
            `**Key Terms:** ${report.statistics.uniqueTerms}\n` +
            `**Definitions:** ${report.statistics.totalDefinitions}\n\n` +
            `## Executive Summary\n\n${report.summary}\n\n` +
            `## Key Terms & Definitions\n\n` +
            report.keyTerms.map(term => 
                `### ${term.term} (${term.frequency}x)\n${term.definition}\n`
            ).join('\n') +
            `\n## Full Transcript\n\n` +
            report.fullTranscript.map(segment => 
                `**${new Date(segment.timestamp).toLocaleTimeString()}:** ${segment.text}`
            ).join('\n\n');
        
        try {
            await navigator.clipboard.writeText(markdown);
            // Show success feedback
            const button = document.getElementById('copy-markdown-btn');
            const originalText = button.innerText;
            button.innerText = '✓ Copied!';
            button.style.background = '#28a745';
            setTimeout(() => {
                button.innerText = originalText;
                button.style.background = '#6c757d';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy markdown:', err);
        }
    };
    
    const formatDuration = (seconds) => {
        if (!seconds) return '0m';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m ${secs}s`;
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
                padding: '20px',
                zIndex: 1000,
                overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>📊 Meeting Report</h2>
                    <button onClick={onClose} style={{
                        padding: '8px 12px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        ✕ Close
                    </button>
                </div>
                <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                    Generating report...
                </div>
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
                padding: '20px',
                zIndex: 1000
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>📊 Meeting Report</h2>
                    <button onClick={onClose} style={{
                        padding: '8px 12px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        ✕ Close
                    </button>
                </div>
                <div style={{
                    padding: '20px',
                    background: '#f8d7da',
                    color: '#721c24',
                    borderRadius: '5px'
                }}>
                    ⚠️ Error: {error}
                </div>
                <button onClick={loadReport} style={{
                    marginTop: '20px',
                    padding: '10px 20px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}>
                    🔄 Retry
                </button>
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
            {/* Header */}
            <div style={{
                padding: '20px',
                borderBottom: '1px solid #dee2e6',
                background: '#f8f9fa'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0 }}>📊 Meeting Report</h2>
                    <button onClick={onClose} style={{
                        padding: '8px 12px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        ✕ Close
                    </button>
                </div>
                <div style={{ marginTop: '10px', fontSize: '14px', color: '#6c757d' }}>
                    {report.meeting.title}
                </div>
            </div>
            
            {/* Export Buttons */}
            <div style={{
                padding: '15px 20px',
                borderBottom: '1px solid #dee2e6',
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap'
            }}>
                <button onClick={() => exportReport('html')} style={{
                    padding: '8px 16px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }}>
                    📄 Export HTML
                </button>
                <button onClick={exportMarkdown} style={{
                    padding: '8px 16px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }}>
                    📝 Export Markdown
                </button>
                <button 
                    id="copy-markdown-btn"
                    onClick={copyMarkdownToClipboard} 
                    style={{
                        padding: '8px 16px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'background 0.3s'
                    }}
                >
                    📋 Copy Markdown
                </button>
                <button onClick={() => window.print()} style={{
                    padding: '8px 16px',
                    background: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }}>
                    🖨️ Print
                </button>
            </div>
            
            {/* Content */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px'
            }}>
                {/* Statistics */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '15px',
                    marginBottom: '30px'
                }}>
                    <div style={{
                        padding: '15px',
                        background: '#e7f3ff',
                        borderRadius: '8px',
                        borderLeft: '4px solid #007bff'
                    }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                            {report.statistics.wordCount}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>Total Words</div>
                    </div>
                    <div style={{
                        padding: '15px',
                        background: '#d4edda',
                        borderRadius: '8px',
                        borderLeft: '4px solid #28a745'
                    }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                            {report.statistics.uniqueTerms}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>Key Terms</div>
                    </div>
                    <div style={{
                        padding: '15px',
                        background: '#fff3cd',
                        borderRadius: '8px',
                        borderLeft: '4px solid #ffc107'
                    }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                            {report.meeting.duration}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>Duration</div>
                    </div>
                    <div style={{
                        padding: '15px',
                        background: '#f8d7da',
                        borderRadius: '8px',
                        borderLeft: '4px solid #dc3545'
                    }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                            {report.statistics.totalDefinitions}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>Definitions</div>
                    </div>
                </div>
                
                {/* Summary */}
                <div style={{
                    marginBottom: '30px',
                    padding: '20px',
                    background: '#f8f9fa',
                    borderRadius: '8px'
                }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>
                        📋 Executive Summary
                    </h3>
                    <div style={{ lineHeight: '1.6' }}>
                        {renderMarkdown(report.summary)}
                    </div>
                </div>
                
                {/* Key Terms */}
                <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#2c3e50', marginBottom: '15px' }}>
                        🔍 Key Terms & Definitions
                    </h3>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {report.keyTerms.map((term, index) => (
                            <div key={index} style={{
                                padding: '15px',
                                marginBottom: '10px',
                                background: '#ffffff',
                                border: '1px solid #dee2e6',
                                borderRadius: '5px',
                                borderLeft: '3px solid #007bff'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '8px'
                                }}>
                                    <strong style={{ color: '#007bff', fontSize: '16px' }}>
                                        {term.term}
                                    </strong>
                                    <span style={{
                                        padding: '2px 8px',
                                        background: '#e7f3ff',
                                        color: '#007bff',
                                        borderRadius: '12px',
                                        fontSize: '12px'
                                    }}>
                                        {term.frequency}x
                                    </span>
                                </div>
                                <div style={{ fontSize: '14px', color: '#495057', lineHeight: '1.5' }}>
                                    {term.definition}
                                </div>
                                {term.sources && term.sources.length > 0 && (
                                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#6c757d' }}>
                                        Sources: {term.sources.join(', ')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Full Transcript */}
                <div>
                    <h3 style={{ color: '#2c3e50', marginBottom: '15px' }}>
                        📝 Full Transcript
                    </h3>
                    <div style={{
                        maxHeight: '400px',
                        overflowY: 'auto',
                        padding: '15px',
                        background: '#f8f9fa',
                        borderRadius: '5px'
                    }}>
                        {report.fullTranscript.map((segment, index) => (
                            <div key={index} style={{
                                marginBottom: '10px',
                                padding: '10px',
                                background: 'white',
                                borderRadius: '3px'
                            }}>
                                <span style={{
                                    fontSize: '12px',
                                    color: '#6c757d',
                                    marginRight: '10px'
                                }}>
                                    {new Date(segment.timestamp).toLocaleTimeString()}
                                </span>
                                <span style={{ color: '#212529' }}>
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