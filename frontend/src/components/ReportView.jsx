import React, { useState, useEffect } from 'react';

function ReportView({ meetingId, onClose }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        if (meetingId) {
            loadReport(false);
        }
    }, [meetingId]);
    
    const loadReport = async (forceRegenerate = false) => {
        if (forceRegenerate) {
            setRegenerating(true);
        } else {
            setLoading(true);
        }
        setError(null);
        
        try {
            const url = `http://localhost:9000/api/meetings/${meetingId}/report${forceRegenerate ? '?regenerate=true' : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }
            const data = await response.json();
            setReport(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setRegenerating(false);
        }
    };
    
    const handleRegenerate = () => {
        loadReport(true);
    };

    const exportReport = (format) => {
        console.log('Export report in format:', format);
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
                justifyContent: 'center'
            }}>
                <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                    {regenerating ? 'Regenerating report with fresh AI analysis...' : 'Loading report...'}
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
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column'
            }}>
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
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: '#dc3545' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
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
                    background: 'rgba(255, 255, 255, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    flexDirection: 'column'
                }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                    <div style={{ color: '#6c757d', textAlign: 'center' }}>
                        Regenerating report with fresh AI analysis...
                        <br />
                        <small>This may take 10-30 seconds</small>
                    </div>
                </div>
            )}

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
                    {report.meeting.title} • {new Date(report.meeting.startTime).toLocaleDateString()}
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{
                padding: '15px 20px',
                borderBottom: '1px solid #dee2e6',
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                {/* Regenerate Button */}
                <button 
                    onClick={handleRegenerate} 
                    disabled={regenerating}
                    style={{
                        padding: '8px 16px',
                        background: regenerating ? '#6c757d' : '#ffc107',
                        color: regenerating ? 'white' : '#212529',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: regenerating ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    {regenerating ? '⏳ Regenerating...' : '🔄 Regenerate Report'}
                </button>
                
                {/* Cache indicator */}
                {report?.cached && (
                    <span style={{
                        padding: '4px 8px',
                        background: '#d4edda',
                        color: '#155724',
                        borderRadius: '3px',
                        fontSize: '12px',
                        fontWeight: '500'
                    }}>
                        📄 Cached
                    </span>
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <h3>Summary</h3>
                    <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '5px' }}>
                        {report.summary}
                    </div>

                    {report.keyTerms && report.keyTerms.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <h3>Key Terms ({report.keyTerms.length})</h3>
                            {report.keyTerms.map((term, index) => (
                                <div key={index} style={{ 
                                    marginBottom: '10px', 
                                    padding: '10px', 
                                    border: '1px solid #dee2e6', 
                                    borderRadius: '5px' 
                                }}>
                                    <strong>{term.term}</strong> ({term.frequency} mentions)
                                    <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '5px' }}>
                                        {term.definition}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ReportView;