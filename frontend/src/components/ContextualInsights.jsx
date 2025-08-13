import React, { useState, useEffect } from 'react';

function ContextualInsights({ socket, currentTopic, view }) {
    const [insights, setInsights] = useState(null);
    const [talkingPoints, setTalkingPoints] = useState([]);
    const [rollingSummary, setRollingSummary] = useState('');
    const [glossary, setGlossary] = useState([]);
    const [activeTab, setActiveTab] = useState('insights');
    const [showTalkingPointsModal, setShowTalkingPointsModal] = useState(false);
    const [talkingPointTopic, setTalkingPointTopic] = useState('');
    
    useEffect(() => {
        if (!socket) return;
        
        // Listen for contextual insights
        socket.on('contextual:insights', (data) => {
            console.log('Received contextual insights:', data);
            setInsights(data);
        });
        
        // Listen for talking points response
        socket.on('intelligence:talking-points-response', (data) => {
            setTalkingPoints(data.points || []);
            setShowTalkingPointsModal(true);
        });
        
        // Listen for rolling summary
        socket.on('intelligence:summary-response', (data) => {
            setRollingSummary(data.summary || '');
        });
        
        // Listen for glossary updates
        socket.on('intelligence:glossary-response', (data) => {
            setGlossary(data.glossary || []);
        });
        
        return () => {
            socket.off('contextual:insights');
            socket.off('intelligence:talking-points-response');
            socket.off('intelligence:summary-response');
            socket.off('intelligence:glossary-response');
        };
    }, [socket]);
    
    const requestTalkingPoints = () => {
        if (socket && talkingPointTopic.trim()) {
            socket.emit('intelligence:talking-points', talkingPointTopic);
        }
    };
    
    const requestRollingSummary = (duration = 120000) => {
        if (socket) {
            socket.emit('intelligence:rolling-summary', duration);
        }
    };
    
    const requestGlossary = () => {
        if (socket) {
            socket.emit('intelligence:get-glossary');
            setActiveTab('glossary');
        }
    };
    
    const renderInsightsTab = () => {
        if (!insights) {
            return (
                <div style={{ padding: '20px', color: '#6c757d', fontStyle: 'italic' }}>
                    Waiting for contextual insights...
                </div>
            );
        }
        
        return (
            <div style={{ padding: '15px' }}>
                {/* Current Topic */}
                {insights.currentTopic && (
                    <div style={{
                        padding: '10px',
                        background: '#e7f3ff',
                        borderRadius: '5px',
                        marginBottom: '15px'
                    }}>
                        <strong>Current Topic:</strong>
                        <div style={{ marginTop: '5px' }}>{insights.currentTopic}</div>
                    </div>
                )}
                
                {/* Key Concepts */}
                {insights.concepts && insights.concepts.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Key Concepts</h4>
                        {insights.concepts.map((concept, idx) => (
                            <div key={idx} style={{
                                padding: '8px',
                                marginBottom: '8px',
                                background: concept.importance === 'high' ? '#fff3cd' : '#f8f9fa',
                                borderLeft: `3px solid ${
                                    concept.importance === 'high' ? '#ffc107' : 
                                    concept.importance === 'medium' ? '#17a2b8' : '#6c757d'
                                }`,
                                borderRadius: '3px'
                            }}>
                                <div style={{ fontWeight: '500' }}>{concept.concept}</div>
                                {concept.context && (
                                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '3px' }}>
                                        {concept.context}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Suggested Questions */}
                {insights.suggestedQuestions && insights.suggestedQuestions.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>
                            Questions You Could Ask
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                            {insights.suggestedQuestions.map((question, idx) => (
                                <li key={idx} style={{ marginBottom: '5px', fontSize: '13px' }}>
                                    {question}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                
                {/* Potential Action Items */}
                {insights.potentialActions && insights.potentialActions.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>
                            Potential Action Items
                        </h4>
                        {insights.potentialActions.map((action, idx) => (
                            <div key={idx} style={{
                                padding: '8px',
                                marginBottom: '5px',
                                background: '#d4edda',
                                borderLeft: '3px solid #28a745',
                                borderRadius: '3px',
                                fontSize: '13px'
                            }}>
                                {action}
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Needs Clarification */}
                {insights.needsClarification && insights.needsClarification.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ fontSize: '14px', marginBottom: '10px', color: '#dc3545' }}>
                            Needs Clarification
                        </h4>
                        {insights.needsClarification.map((item, idx) => (
                            <div key={idx} style={{
                                padding: '8px',
                                marginBottom: '5px',
                                background: '#f8d7da',
                                borderLeft: '3px solid #dc3545',
                                borderRadius: '3px',
                                fontSize: '13px'
                            }}>
                                {item}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };
    
    const renderAssistantTab = () => {
        return (
            <div style={{ padding: '15px' }}>
                {/* Generate Talking Points */}
                <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>
                        Generate Talking Points
                    </h4>
                    <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '10px' }}>
                        Enter a topic to get AI-generated talking points based on the current meeting context and discussion.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="e.g., 'project timeline', 'budget concerns', 'next steps'"
                            value={talkingPointTopic}
                            onChange={(e) => setTalkingPointTopic(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && requestTalkingPoints()}
                            style={{
                                flex: 1,
                                padding: '8px',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                fontSize: '13px'
                            }}
                        />
                        <button
                            onClick={requestTalkingPoints}
                            disabled={!talkingPointTopic.trim()}
                            style={{
                                padding: '8px 15px',
                                background: talkingPointTopic.trim() ? '#007bff' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: talkingPointTopic.trim() ? 'pointer' : 'not-allowed',
                                fontSize: '13px'
                            }}
                        >
                            Generate
                        </button>
                    </div>
                </div>
                
                {/* Get Rolling Summary */}
                <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>
                        Rolling Summary
                    </h4>
                    <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '10px' }}>
                        Get an AI-generated summary of the recent discussion. Choose a time window:
                    </p>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <button
                            onClick={() => requestRollingSummary(60000)}
                            style={{
                                padding: '6px 12px',
                                background: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Last 1 min
                        </button>
                        <button
                            onClick={() => requestRollingSummary(120000)}
                            style={{
                                padding: '6px 12px',
                                background: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Last 2 min
                        </button>
                        <button
                            onClick={() => requestRollingSummary(300000)}
                            style={{
                                padding: '6px 12px',
                                background: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Last 5 min
                        </button>
                    </div>
                    {rollingSummary && (
                        <div style={{
                            padding: '10px',
                            background: '#f8f9fa',
                            borderRadius: '5px',
                            fontSize: '13px',
                            lineHeight: '1.5'
                        }}>
                            {rollingSummary}
                        </div>
                    )}
                </div>
            </div>
        );
    };
    
    const renderGlossaryTab = () => {
        return (
            <div style={{ padding: '15px' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '15px' }}>
                    Meeting-Specific Terms
                </h4>
                {glossary.length === 0 ? (
                    <div style={{ color: '#6c757d', fontStyle: 'italic', fontSize: '13px' }}>
                        No terms defined yet in this meeting context.
                    </div>
                ) : (
                    <div>
                        {glossary.map((item, idx) => (
                            <div key={idx} style={{
                                padding: '10px',
                                marginBottom: '10px',
                                background: '#f8f9fa',
                                borderLeft: '3px solid #17a2b8',
                                borderRadius: '3px'
                            }}>
                                <div style={{ fontWeight: '500', marginBottom: '5px' }}>
                                    {item.term}
                                </div>
                                <div style={{ fontSize: '13px', color: '#495057' }}>
                                    {item.definition}
                                </div>
                                {item.context && (
                                    <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '5px' }}>
                                        Context: {item.context}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };
    
    // If view prop is provided, render only that specific view without tabs
    if (view) {
        return (
            <div style={{ height: '100%' }}>
                {view === 'insights' && renderInsightsTab()}
                {view === 'assistant' && renderAssistantTab()}
                {view === 'glossary' && renderGlossaryTab()}
            </div>
        );
    }
    
    // Otherwise render with internal tabs (for backward compatibility)
    return (
        <div style={{
            background: '#ffffff',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header with Tabs */}
            <div style={{
                borderBottom: '1px solid #dee2e6',
                background: '#f8f9fa'
            }}>
                <h3 style={{ 
                    margin: 0, 
                    padding: '10px 15px',
                    fontSize: '16px',
                    borderBottom: '1px solid #dee2e6'
                }}>
                    Meeting Intelligence
                </h3>
                <div style={{ display: 'flex' }}>
                    <button
                        onClick={() => setActiveTab('insights')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            background: activeTab === 'insights' ? '#ffffff' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'insights' ? '2px solid #007bff' : 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: activeTab === 'insights' ? '500' : 'normal'
                        }}
                    >
                        Insights
                    </button>
                    <button
                        onClick={() => setActiveTab('assistant')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            background: activeTab === 'assistant' ? '#ffffff' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'assistant' ? '2px solid #007bff' : 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: activeTab === 'assistant' ? '500' : 'normal'
                        }}
                    >
                        Assistant
                    </button>
                    <button
                        onClick={() => setActiveTab('glossary')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            background: activeTab === 'glossary' ? '#ffffff' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'glossary' ? '2px solid #007bff' : 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: activeTab === 'glossary' ? '500' : 'normal'
                        }}
                    >
                        Glossary
                    </button>
                </div>
            </div>
            
            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {activeTab === 'insights' && renderInsightsTab()}
                {activeTab === 'assistant' && renderAssistantTab()}
                {activeTab === 'glossary' && renderGlossaryTab()}
            </div>
            
            {/* Talking Points Modal */}
            {showTalkingPointsModal && talkingPoints.length > 0 && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    maxWidth: '500px',
                    width: '90%'
                }}>
                    <h3 style={{ marginTop: 0 }}>Talking Points</h3>
                    <ul style={{ paddingLeft: '20px' }}>
                        {talkingPoints.map((point, idx) => (
                            <li key={idx} style={{ marginBottom: '10px' }}>
                                {point}
                            </li>
                        ))}
                    </ul>
                    <button
                        onClick={() => setShowTalkingPointsModal(false)}
                        style={{
                            padding: '8px 15px',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginTop: '10px'
                        }}
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}

export default ContextualInsights;