import React from 'react';
import { BookOpen } from 'lucide-react';

function DefinitionHistory({ definitions, terms }) {
    // Create an array of ALL terms, with or without definitions
    const allTerms = React.useMemo(() => {
        const termsList = [];
        
        // Add all terms, whether they have definitions or not
        terms.forEach((term, index) => {
            termsList.push({
                term,
                definition: definitions[term] || null,
                hasDefinition: !!definitions[term],
                timestamp: Date.now() - (index * 1000), // Approximate timestamp based on order
                isRecent: index < 5
            });
        });
        
        // Sort by timestamp (most recent first)
        return termsList.sort((a, b) => b.timestamp - a.timestamp);
    }, [definitions, terms]);
    
    if (allTerms.length === 0) {
        return (
            <div style={{
                padding: '20px',
                background: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                height: '100%',
                overflowY: 'auto'
            }}>
                <h2 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen className="h-5 w-5" />
                    Glossary Terms
                </h2>
                <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
                    Terms will appear here as they are identified during the conversation.
                </p>
            </div>
        );
    }
    
    return (
        <div style={{
            padding: '20px',
            background: '#ffffff',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen className="h-5 w-5" />
                Glossary Terms
            </h2>
            
            {/* Summary Stats */}
            <div style={{
                padding: '10px',
                background: '#f8f9fa',
                borderRadius: '5px',
                marginBottom: '20px',
                fontSize: '14px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Terms:</span>
                    <strong>{allTerms.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                    <span>With Definitions:</span>
                    <strong>{allTerms.filter(t => t.hasDefinition).length}</strong>
                </div>
            </div>
            
            {/* Scrollable Definition List */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '5px'
            }}>
                {allTerms.map((item, index) => (
                    <div
                        key={`${item.term}-${index}`}
                        style={{
                            marginBottom: '15px',
                            padding: '12px',
                            background: item.hasDefinition ? (item.isRecent ? '#e7f3ff' : '#f8f9fa') : '#fff8dc',
                            borderLeft: `3px solid ${item.hasDefinition ? (item.isRecent ? '#007bff' : '#dee2e6') : '#ffc107'}`,
                            opacity: item.hasDefinition ? 1 : 0.9,
                            borderRadius: '3px',
                            transition: 'all 0.3s'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px'
                        }}>
                            <strong style={{
                                color: item.hasDefinition ? (item.isRecent ? '#007bff' : '#495057') : '#856404',
                                fontSize: '15px'
                            }}>
                                {item.term}
                            </strong>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                {item.isRecent && (
                                    <span style={{
                                        padding: '2px 6px',
                                        background: '#007bff',
                                        color: 'white',
                                        borderRadius: '10px',
                                        fontSize: '10px',
                                        fontWeight: 'bold'
                                    }}>
                                        NEW
                                    </span>
                                )}
                                {!item.hasDefinition && (
                                    <span style={{
                                        padding: '2px 6px',
                                        background: '#ffc107',
                                        color: '#856404',
                                        borderRadius: '10px',
                                        fontSize: '10px',
                                        fontWeight: 'bold'
                                    }}>
                                        PENDING
                                    </span>
                                )}
                            </div>
                        </div>
                        {item.hasDefinition ? (
                            <>
                                <div style={{
                                    fontSize: '13px',
                                    color: '#495057',
                                    lineHeight: '1.5'
                                }}>
                                    {item.definition.summary || item.definition}
                                </div>
                                {item.definition.sources && item.definition.sources.length > 0 && (
                                    <div style={{
                                        marginTop: '6px',
                                        fontSize: '11px',
                                        color: '#6c757d',
                                        fontStyle: 'italic'
                                    }}>
                                        Sources: {item.definition.sources.slice(0, 2).join(', ')}
                                        {item.definition.sources.length > 2 && ` +${item.definition.sources.length - 2} more`}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{
                                fontSize: '13px',
                                color: '#856404',
                                fontStyle: 'italic',
                                lineHeight: '1.5'
                            }}>
                                Looking up definition...
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Scroll to Top Button */}
            {allTerms.length > 5 && (
                <button
                    onClick={() => {
                        const container = document.querySelector('.definition-history-scroll');
                        if (container) container.scrollTop = 0;
                    }}
                    style={{
                        marginTop: '10px',
                        padding: '8px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    ↑ Scroll to Top
                </button>
            )}
        </div>
    );
}

export default DefinitionHistory;