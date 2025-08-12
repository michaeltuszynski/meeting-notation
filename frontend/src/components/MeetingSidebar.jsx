import React, { useState, useEffect } from 'react';

function MeetingSidebar({ onSelectMeeting, activeMeetingId, onNewMeeting, onGenerateReport, socket }) {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
    const [newMeetingTitle, setNewMeetingTitle] = useState('');
    const [editingMeetingId, setEditingMeetingId] = useState(null);
    const [editingTitle, setEditingTitle] = useState('');

    useEffect(() => {
        fetchMeetings();
        
        // Listen for meeting events if socket is available
        if (socket) {
            // When a meeting starts, refresh the list
            socket.on('meeting:started', (meeting) => {
                setMeetings(prevMeetings => {
                    // Check if meeting already exists
                    const exists = prevMeetings.some(m => m.id === meeting.id);
                    if (exists) {
                        // Update existing meeting
                        return prevMeetings.map(m => 
                            m.id === meeting.id ? meeting : m
                        );
                    } else {
                        // Add new meeting at the top
                        return [meeting, ...prevMeetings];
                    }
                });
            });
            
            // When a meeting ends, update its status
            socket.on('meeting:ended', (meeting) => {
                console.log('[MeetingSidebar] Received meeting:ended event:', meeting);
                setMeetings(prevMeetings => 
                    prevMeetings.map(m => 
                        m.id === meeting.id ? { ...m, status: 'completed' } : m
                    )
                );
            });
            
            // When a meeting is deleted
            socket.on('meeting:deleted', (data) => {
                setMeetings(prevMeetings => 
                    prevMeetings.filter(m => m.id !== data.meetingId)
                );
            });
            
            // When a meeting title is updated
            socket.on('meeting:updated', (meeting) => {
                setMeetings(prevMeetings => 
                    prevMeetings.map(m => 
                        m.id === meeting.id ? { ...m, title: meeting.title } : m
                    )
                );
            });
            
            // Cleanup listeners on unmount
            return () => {
                socket.off('meeting:started');
                socket.off('meeting:ended');
                socket.off('meeting:deleted');
                socket.off('meeting:updated');
            };
        }
    }, [socket]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:9000/api/meetings');
            const data = await response.json();
            setMeetings(data.meetings || []);
        } catch (error) {
            console.error('Error fetching meetings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            fetchMeetings();
            return;
        }

        try {
            const response = await fetch(`http://localhost:9000/api/meetings?search=${encodeURIComponent(searchTerm)}`);
            const data = await response.json();
            setMeetings(data.meetings || []);
        } catch (error) {
            console.error('Error searching meetings:', error);
        }
    };

    const handleNewMeeting = () => {
        const title = newMeetingTitle.trim() || `Meeting ${new Date().toLocaleString()}`;
        onNewMeeting({ title });
        setShowNewMeetingModal(false);
        setNewMeetingTitle('');
        // Refresh sessions list
        setTimeout(fetchMeetings, 500);
    };

    const deleteMeeting = async (meetingId, e) => {
        e.stopPropagation();
        
        // Get meeting details for better confirmation message
        const meeting = meetings.find(m => m.id === meetingId);
        const confirmMessage = meeting?.status === 'active' 
            ? 'This meeting is currently active. Are you sure you want to delete it and stop recording?'
            : 'Are you sure you want to delete this meeting and all associated data (transcripts, terms, reports)?';
            
        if (!window.confirm(confirmMessage)) return;

        try {
            await fetch(`http://localhost:9000/api/meetings/${meetingId}`, {
                method: 'DELETE'
            });
            fetchMeetings();
        } catch (error) {
            console.error('Error deleting meeting:', error);
        }
    };

    const renameMeeting = async (meetingId, newTitle) => {
        if (!newTitle.trim()) {
            alert('Meeting title cannot be empty');
            return false;
        }

        try {
            const response = await fetch(`http://localhost:9000/api/meetings/${meetingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: newTitle.trim() })
            });

            if (!response.ok) {
                throw new Error('Failed to rename meeting');
            }

            // Update local state
            setMeetings(prevMeetings => 
                prevMeetings.map(m => 
                    m.id === meetingId ? { ...m, title: newTitle.trim() } : m
                )
            );
            
            setEditingMeetingId(null);
            setEditingTitle('');
            return true;
        } catch (error) {
            console.error('Error renaming meeting:', error);
            alert('Failed to rename meeting');
            return false;
        }
    };

    const startEditing = (meeting, e) => {
        e.stopPropagation();
        setEditingMeetingId(meeting.id);
        setEditingTitle(meeting.title);
    };

    const cancelEditing = () => {
        setEditingMeetingId(null);
        setEditingTitle('');
    };

    const handleKeyPress = async (e, meetingId) => {
        if (e.key === 'Enter') {
            await renameMeeting(meetingId, editingTitle);
        } else if (e.key === 'Escape') {
            cancelEditing();
        }
    };

    const exportMeeting = async (meetingId, format, e) => {
        e.stopPropagation();
        try {
            const response = await fetch(`http://localhost:9000/api/meetings/${meetingId}/export?format=${format}`);
            
            if (format === 'json') {
                const data = await response.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `meeting-${meetingId}.json`;
                a.click();
            } else if (format === 'csv') {
                const data = await response.text();
                const blob = new Blob([data], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `meeting-${meetingId}.csv`;
                a.click();
            }
        } catch (error) {
            console.error('Error exporting meeting:', error);
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    return (
        <div style={{
            width: '300px',
            height: '100vh',
            background: '#f8f9fa',
            borderRight: '1px solid #dee2e6',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 100
        }}>
            {/* Header */}
            <div style={{
                padding: '15px',
                borderBottom: '1px solid #dee2e6',
                background: '#ffffff'
            }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>📁 TranscriptIQ Sessions</h3>
                
                {/* Search */}
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                    <input
                        type="text"
                        placeholder="Search sessions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        style={{
                            flex: 1,
                            padding: '5px 10px',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '14px'
                        }}
                    />
                    <button
                        onClick={handleSearch}
                        style={{
                            padding: '5px 10px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        🔍
                    </button>
                </div>

                {/* New Meeting Button - Prominent when no active meeting */}
                <button
                    onClick={() => setShowNewMeetingModal(true)}
                    style={{
                        width: '100%',
                        padding: activeMeetingId ? '8px' : '12px',
                        background: activeMeetingId ? '#007bff' : 'linear-gradient(135deg, #007bff, #0056b3)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: activeMeetingId ? '14px' : '16px',
                        boxShadow: activeMeetingId ? 'none' : '0 2px 8px rgba(0, 123, 255, 0.3)',
                        animation: activeMeetingId ? 'none' : 'pulse 2s infinite',
                        transition: 'all 0.3s'
                    }}
                >
                    {activeMeetingId ? '+ New Meeting' : '🎯 Start New Meeting'}
                </button>
                
                {/* Add CSS for pulse animation */}
                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.02); }
                        100% { transform: scale(1); }
                    }
                `}</style>
            </div>

            {/* Meetings List */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px'
            }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                        Loading sessions...
                    </div>
                ) : meetings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                        No sessions yet
                    </div>
                ) : (
                    meetings.map(meeting => (
                        <div
                            key={meeting.id}
                            onClick={() => onSelectMeeting(meeting)}
                            className="meeting-card"
                            style={{
                                padding: '10px',
                                marginBottom: '8px',
                                background: meeting.id === activeMeetingId ? '#e7f3ff' : '#ffffff',
                                border: `1px solid ${meeting.id === activeMeetingId ? '#0066cc' : '#dee2e6'}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (meeting.id !== activeMeetingId) {
                                    e.currentTarget.style.background = '#f1f3f5';
                                }
                                // Show edit button on hover
                                const editBtn = e.currentTarget.querySelector('.edit-btn');
                                if (editBtn) editBtn.style.opacity = '0.7';
                            }}
                            onMouseLeave={(e) => {
                                if (meeting.id !== activeMeetingId) {
                                    e.currentTarget.style.background = '#ffffff';
                                }
                                // Hide edit button when not hovering
                                const editBtn = e.currentTarget.querySelector('.edit-btn');
                                if (editBtn) editBtn.style.opacity = '0';
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start'
                            }}>
                                <div style={{ flex: 1 }}>
                                    {editingMeetingId === meeting.id ? (
                                        <input
                                            type="text"
                                            value={editingTitle}
                                            onChange={(e) => setEditingTitle(e.target.value)}
                                            onKeyDown={(e) => handleKeyPress(e, meeting.id)}
                                            onBlur={() => renameMeeting(meeting.id, editingTitle)}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                width: '100%',
                                                padding: '2px 4px',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                color: '#212529',
                                                border: '1px solid #007bff',
                                                borderRadius: '3px',
                                                background: 'white',
                                                marginBottom: '4px'
                                            }}
                                            autoFocus
                                        />
                                    ) : (
                                        <div style={{
                                            fontWeight: '500',
                                            fontSize: '14px',
                                            marginBottom: '4px',
                                            color: '#212529',
                                            position: 'relative',
                                            paddingRight: '25px'
                                        }}>
                                            <span>{meeting.title}</span>
                                            <button
                                                className="edit-btn"
                                                onClick={(e) => startEditing(meeting, e)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '0',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    padding: '2px',
                                                    fontSize: '12px',
                                                    background: 'transparent',
                                                    color: '#6c757d',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    opacity: 0,
                                                    transition: 'opacity 0.2s',
                                                    lineHeight: '1',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.opacity = '1';
                                                    e.currentTarget.style.color = '#007bff';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.opacity = '0.7';
                                                    e.currentTarget.style.color = '#6c757d';
                                                }}
                                                title="Rename meeting"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                    <div style={{
                                        fontSize: '12px',
                                        color: '#6c757d'
                                    }}>
                                        {new Date(meeting.start_time).toLocaleDateString()}
                                        {meeting.duration_seconds && ` • ${formatDuration(meeting.duration_seconds)}`}
                                    </div>
                                    {meeting.term_count > 0 && (
                                        <div style={{
                                            fontSize: '11px',
                                            color: '#6c757d',
                                            marginTop: '2px'
                                        }}>
                                            {meeting.word_count} words • {meeting.unique_terms_count} terms
                                        </div>
                                    )}
                                </div>
                                
                                {/* Meeting Status */}
                                <div style={{
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    background: meeting.status === 'active' ? '#d4edda' : '#f8f9fa',
                                    color: meeting.status === 'active' ? '#155724' : '#6c757d'
                                }}>
                                    {meeting.status === 'active' ? '● LIVE' : meeting.status}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{
                                display: 'flex',
                                gap: '5px',
                                marginTop: '8px'
                            }}>
                                <button
                                    onClick={(e) => exportMeeting(meeting.id, 'json', e)}
                                    style={{
                                        padding: '3px 8px',
                                        fontSize: '11px',
                                        background: '#17a2b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                    title="Export as JSON"
                                >
                                    JSON
                                </button>
                                <button
                                    onClick={(e) => exportMeeting(meeting.id, 'csv', e)}
                                    style={{
                                        padding: '3px 8px',
                                        fontSize: '11px',
                                        background: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                    title="Export as CSV"
                                >
                                    CSV
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onGenerateReport(meeting.id);
                                    }}
                                    style={{
                                        padding: '3px 8px',
                                        fontSize: '11px',
                                        background: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                    title="Generate Report"
                                >
                                    📊 Report
                                </button>
                                <button
                                    onClick={(e) => deleteMeeting(meeting.id, e)}
                                    style={{
                                        padding: '3px 8px',
                                        fontSize: '11px',
                                        background: '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        marginLeft: 'auto'
                                    }}
                                    title="Delete meeting"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Meeting Modal */}
            {showNewMeetingModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        width: '400px'
                    }}>
                        <h3 style={{ marginTop: 0 }}>New TranscriptIQ Session</h3>
                        <input
                            type="text"
                            placeholder="Session title (optional)"
                            value={newMeetingTitle}
                            onChange={(e) => setNewMeetingTitle(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleNewMeeting()}
                            style={{
                                width: '100%',
                                padding: '8px',
                                marginBottom: '15px',
                                border: '1px solid #ced4da',
                                borderRadius: '4px'
                            }}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowNewMeetingModal(false)}
                                style={{
                                    padding: '8px 16px',
                                    background: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleNewMeeting}
                                style={{
                                    padding: '8px 16px',
                                    background: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Start Meeting
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MeetingSidebar;