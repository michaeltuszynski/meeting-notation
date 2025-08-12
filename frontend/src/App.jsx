import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import MeetingSidebar from './components/MeetingSidebar';
import ReportView from './components/ReportView';
import DefinitionHistory from './components/DefinitionHistory';
import ContextualInsights from './components/ContextualInsights';
import useElectronAudio from './hooks/useElectronAudio';

function App() {
    const [transcript, setTranscript] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [metrics, setMetrics] = useState(null);
    const [error, setError] = useState(null);
    const [extractedTerms, setExtractedTerms] = useState([]);
    const [termDefinitions, setTermDefinitions] = useState({});
    const [activeMeeting, setActiveMeeting] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showReport, setShowReport] = useState(false);
    const [reportMeetingId, setReportMeetingId] = useState(null);
    const [rightPanelView, setRightPanelView] = useState('contextual'); // 'contextual' or 'definitions'
    const [useElectronBridge, setUseElectronBridge] = useState(false); // Toggle for Electron audio bridge
    
    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const sourceRef = useRef(null);
    const streamRef = useRef(null);
    const animationRef = useRef(null);
    
    // Electron audio capture hook
    const {
        isElectron,
        audioSources,
        selectedSource,
        setSelectedSource,
        isCapturing: isElectronCapturing,
        startCapture: startElectronCapture,
        stopCapture: stopElectronCapture,
        getAudioSources
    } = useElectronAudio();
    
    // Debug: Log Electron detection
    useEffect(() => {
        console.log('[App] Electron detected:', isElectron);
        console.log('[App] window.electronAPI:', window.electronAPI);
        console.log('[App] window.meetingAPI (old):', window.meetingAPI);
        if (isElectron) {
            console.log('[App] Audio sources:', audioSources);
        }
    }, [isElectron, audioSources]);
    
    useEffect(() => {
        // Use the webpack-defined environment variable or fallback
        const wsUrl = 'http://localhost:9000';
        const socket = io(wsUrl);
        socketRef.current = socket;
        
        socket.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to backend');
        });
        
        socket.on('disconnect', () => {
            setIsConnected(false);
            setIsRecording(false);
        });
        
        socket.on('service:status', (status) => {
            console.log('Service status:', status);
            setMetrics(status.metrics);
            if (status.activeMeetingId) {
                // Load active meeting if one exists
                fetch(`http://localhost:9000/api/meetings/${status.activeMeetingId}`)
                    .then(res => res.json())
                    .then(meeting => setActiveMeeting(meeting))
                    .catch(console.error);
            }
        });
        
        socket.on('meeting:started', (meeting) => {
            console.log('Meeting started:', meeting);
            setActiveMeeting(meeting);
            // Clear previous transcript and terms
            setTranscript([]);
            setExtractedTerms([]);
            setTermDefinitions({});
        });
        
        socket.on('meeting:ended', (meeting) => {
            console.log('Meeting ended:', meeting);
            setActiveMeeting(null);
        });
        
        socket.on('transcript:update', (data) => {
            console.log('Transcript update:', data);
            if (data.text && data.text.trim()) {
                setTranscript(prev => [...prev, {
                    text: data.text,
                    isFinal: data.isFinal,
                    confidence: data.confidence,
                    timestamp: data.timestamp,
                    latency: data.latency
                }]);
                
                // Update metrics
                if (data.latency) {
                    setMetrics(prev => ({
                        ...prev,
                        lastLatency: data.latency
                    }));
                }
            }
        });
        
        socket.on('transcription:error', (data) => {
            setError(data.message);
            setTimeout(() => setError(null), 5000);
        });
        
        socket.on('audio:error', (data) => {
            setError(data.message);
            // Stop recording if no active meeting
            if (data.code === 'NO_ACTIVE_MEETING') {
                setIsRecording(false);
                setAudioLevel(0);
            }
            setTimeout(() => setError(null), 5000);
        });
        
        socket.on('terms:extracted', (data) => {
            console.log('Terms extracted:', data);
            setExtractedTerms(prev => {
                // Add new terms and keep only last 20 unique terms
                const newTerms = [...new Set([...data.terms, ...prev])].slice(0, 20);
                return newTerms;
            });
        });
        
        socket.on('definitions:updated', (data) => {
            console.log('Definitions received:', data);
            setTermDefinitions(prev => {
                const newDefs = { ...prev };
                data.forEach(item => {
                    newDefs[item.term] = item.definition;
                });
                return newDefs;
            });
        });
        
        socket.on('metrics:response', (data) => {
            console.log('Metrics received:', data);
            setMetrics(data);
        });
        
        // Request metrics periodically
        const metricsInterval = setInterval(() => {
            socket.emit('metrics:request');
        }, 5000);
        
        return () => {
            clearInterval(metricsInterval);
            socket.disconnect();
        };
    }, []);
    
    const handleNewMeeting = (meetingData) => {
        if (socketRef.current) {
            socketRef.current.emit('meeting:start', meetingData);
        }
    };
    
    const handleEndMeeting = () => {
        if (socketRef.current) {
            socketRef.current.emit('meeting:end');
        }
        setIsRecording(false);
        // Automatically show report after ending meeting
        if (activeMeeting) {
            setTimeout(() => {
                setReportMeetingId(activeMeeting.id);
                setShowReport(true);
            }, 1000);
        }
    };
    
    const handleGenerateReport = (meetingId) => {
        setReportMeetingId(meetingId);
        setShowReport(true);
    };
    
    const handleSelectMeeting = async (meeting) => {
        try {
            // Set meeting context in backend
            if (socketRef.current) {
                socketRef.current.emit('meeting:setContext', meeting.id);
            }
            
            // Load meeting transcripts and terms
            const [transcriptsRes, termsRes] = await Promise.all([
                fetch(`http://localhost:9000/api/meetings/${meeting.id}/transcripts`),
                fetch(`http://localhost:9000/api/meetings/${meeting.id}/terms`)
            ]);
            
            const transcripts = await transcriptsRes.json();
            const terms = await termsRes.json();
            
            // Update UI with historical data
            setTranscript(transcripts.map(t => ({
                text: t.text,
                isFinal: t.is_final,
                confidence: t.confidence,
                timestamp: t.timestamp
            })));
            
            setExtractedTerms(terms.map(t => t.term));
            
            const defs = {};
            terms.forEach(t => {
                if (t.definition) {
                    defs[t.term] = {
                        summary: t.definition,
                        sources: t.sources
                    };
                }
            });
            setTermDefinitions(defs);
            
            setActiveMeeting(meeting);
        } catch (error) {
            console.error('Error loading meeting:', error);
        }
    };
    
    const startRecording = async () => {
        try {
            // Require active meeting before recording
            if (!activeMeeting) {
                setError('Please start a meeting before recording. Click "New Meeting" in the sidebar.');
                return;
            }
            
            // Check if meeting is already completed
            if (activeMeeting.status === 'completed') {
                setError('This meeting has already ended. Please start a new meeting to record.');
                return;
            }
            
            // Set recording state first
            setIsRecording(true);
            setError(null);
            
            // Use Electron audio capture if enabled and available
            if (isElectron && useElectronBridge) {
                console.log('[App] Using Electron audio bridge for system audio capture');
                
                // If no source selected, get sources first
                if (!selectedSource && audioSources.length === 0) {
                    await getAudioSources();
                }
                
                const success = await startElectronCapture();
                if (!success) {
                    setError('Failed to start Electron audio capture. Please check audio source selection.');
                    setIsRecording(false);
                }
                return;
            }
            
            console.log('[App] Using browser microphone capture');
            
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            streamRef.current = stream;
            
            // Create Web Audio API context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            audioContextRef.current = audioContext;
            
            // Create audio source from microphone
            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            // Create script processor for capturing audio chunks
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            let chunkCount = 0;
            const AMPLIFICATION_FACTOR = 3; // Boost audio signal
            
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Calculate audio level for visualization
                let sum = 0;
                let maxLevel = 0;
                for (let i = 0; i < inputData.length; i++) {
                    const absValue = Math.abs(inputData[i]);
                    sum += absValue;
                    maxLevel = Math.max(maxLevel, absValue);
                }
                const avgLevel = sum / inputData.length;
                setAudioLevel(avgLevel * 500); // Increased sensitivity for visualization
                
                // Convert Float32Array to Int16Array with amplification
                const int16Data = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    // Amplify the signal
                    const amplifiedSample = inputData[i] * AMPLIFICATION_FACTOR;
                    const sample = Math.max(-1, Math.min(1, amplifiedSample));
                    int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                }
                
                // Send audio chunk to backend
                if (socketRef.current && socketRef.current.connected) {
                    socketRef.current.emit('audio:chunk', {
                        audio: Array.from(int16Data),
                        sampleRate: audioContext.sampleRate,
                        channels: 1
                    });
                    
                    // Log every 10th chunk to avoid spamming console
                    if (++chunkCount % 10 === 0) {
                        console.log(`Sent ${chunkCount} chunks | Avg Level: ${(avgLevel * 100).toFixed(3)} | Max: ${(maxLevel * 100).toFixed(3)}`);
                    }
                }
            };
            
            // Connect audio nodes
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            console.log('Recording started successfully');
            
        } catch (err) {
            console.error('Error starting recording:', err);
            setError('Failed to start recording: ' + err.message);
            setIsRecording(false);
        }
    };
    
    const stopRecording = () => {
        console.log('Stopping recording...');
        
        // Stop Electron capture if using it
        if (isElectron && useElectronBridge && isElectronCapturing) {
            stopElectronCapture();
            setIsRecording(false);
            setAudioLevel(0);
            
            // End meeting if it's active
            if (activeMeeting && activeMeeting.status === 'active') {
                handleEndMeeting();
            }
            return;
        }
        
        // Stop audio processing
        if (processorRef.current && sourceRef.current) {
            sourceRef.current.disconnect();
            processorRef.current.disconnect();
        }
        
        // Close audio context
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        
        // Stop media stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        // Notify backend
        if (socketRef.current) {
            socketRef.current.emit('audio:stop');
        }
        
        setIsRecording(false);
        setAudioLevel(0);
        
        // End meeting if it's active
        if (activeMeeting && activeMeeting.status === 'active') {
            handleEndMeeting();
        }
    };
    
    const clearTranscript = () => {
        setTranscript([]);
    };
    
    const formatLatency = (latency) => {
        if (!latency) return 'N/A';
        const color = latency < 300 ? '#28a745' : latency < 500 ? '#ffc107' : '#dc3545';
        return <span style={{ color }}>{latency}ms</span>;
    };
    
    return (
        <div style={{ display: 'flex', fontFamily: 'system-ui', height: '100vh' }}>
            {/* Meeting Sidebar */}
            {showSidebar && (
                <MeetingSidebar
                    onSelectMeeting={handleSelectMeeting}
                    activeMeetingId={activeMeeting?.id}
                    onNewMeeting={handleNewMeeting}
                    onGenerateReport={handleGenerateReport}
                />
            )}
            
            {/* Main Content */}
            <div style={{ 
                flex: 1,
                marginLeft: showSidebar ? '300px' : '0',
                padding: '20px',
                transition: 'margin-left 0.3s'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        style={{
                            padding: '8px 12px',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {showSidebar ? '◀' : '▶'} Meetings
                    </button>
                    <h1 style={{ margin: 0 }}>🎙️ Meeting Intelligence Assistant</h1>
                    {/* Debug: Show Electron status */}
                    {isElectron && (
                        <span style={{ 
                            padding: '4px 8px', 
                            background: '#17a2b8', 
                            color: 'white', 
                            borderRadius: '4px',
                            fontSize: '12px'
                        }}>
                            Electron Mode
                        </span>
                    )}
                    {activeMeeting && (
                        <div style={{
                            padding: '5px 10px',
                            background: activeMeeting.status === 'active' ? '#d4edda' : '#f8f9fa',
                            color: activeMeeting.status === 'active' ? '#155724' : '#6c757d',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: '500'
                        }}>
                            {activeMeeting.title} {activeMeeting.status === 'active' && '(LIVE)'}
                        </div>
                    )}
                </div>
            
            {/* Status Bar */}
            <div style={{ 
                display: 'flex', 
                gap: '20px', 
                marginBottom: '20px',
                padding: '15px',
                background: '#f8f9fa',
                borderRadius: '8px'
            }}>
                <div>
                    <strong>Connection:</strong>{' '}
                    <span style={{ 
                        color: isConnected ? '#28a745' : '#dc3545',
                        fontWeight: 'bold'
                    }}>
                        {isConnected ? '● Connected' : '○ Disconnected'}
                    </span>
                </div>
                <div>
                    <strong>Recording:</strong>{' '}
                    <span style={{ 
                        color: isRecording ? '#dc3545' : '#6c757d',
                        fontWeight: 'bold'
                    }}>
                        {isRecording ? '● Recording' : '○ Stopped'}
                    </span>
                    {isRecording && isElectron && (
                        <span style={{ 
                            marginLeft: '10px',
                            fontSize: '12px',
                            padding: '2px 6px',
                            background: useElectronBridge ? '#007bff' : '#28a745',
                            color: 'white',
                            borderRadius: '3px'
                        }}>
                            {useElectronBridge ? 'System Audio' : 'Microphone'}
                        </span>
                    )}
                </div>
                {metrics && (
                    <>
                        <div>
                            <strong>Avg Latency:</strong> {formatLatency(Math.round(metrics.avgLatency))}
                        </div>
                        <div>
                            <strong>Last Latency:</strong> {formatLatency(metrics.deepgram?.lastLatency || metrics.lastLatency)}
                        </div>
                    </>
                )}
            </div>
            
            {/* Error Display */}
            {error && (
                <div style={{
                    padding: '10px',
                    background: '#f8d7da',
                    color: '#721c24',
                    borderRadius: '5px',
                    marginBottom: '20px'
                }}>
                    ⚠️ {error}
                </div>
            )}
            
            {/* Meeting Required Notice */}
            {!activeMeeting && (
                <div style={{
                    padding: '15px',
                    background: '#fff3cd',
                    color: '#856404',
                    borderRadius: '5px',
                    marginBottom: '20px',
                    border: '1px solid #ffeaa7',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <span style={{ fontSize: '20px' }}>ℹ️</span>
                    <div>
                        <strong>No Active Meeting</strong>
                        <div>Please start a new meeting from the sidebar before recording. All transcripts must be associated with a meeting.</div>
                    </div>
                </div>
            )}
            
            {/* Controls */}
            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '20px',
                alignItems: 'center',
                flexWrap: 'wrap'
            }}>
                {/* Electron Bridge Toggle - Only show in Electron environment */}
                {isElectron && (
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        padding: '8px 12px',
                        background: useElectronBridge ? '#e7f3ff' : '#f8f9fa',
                        borderRadius: '4px',
                        border: `1px solid ${useElectronBridge ? '#007bff' : '#dee2e6'}`
                    }}>
                        <label style={{ 
                            fontSize: '14px', 
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                        }}>
                            <input
                                type="checkbox"
                                checked={useElectronBridge}
                                onChange={(e) => {
                                    setUseElectronBridge(e.target.checked);
                                    if (e.target.checked) {
                                        getAudioSources();
                                    }
                                }}
                                disabled={isRecording}
                                style={{ cursor: isRecording ? 'not-allowed' : 'pointer' }}
                            />
                            <span>
                                {useElectronBridge ? '🖥️ System Audio' : '🎤 Microphone'} Mode
                            </span>
                        </label>
                        {useElectronBridge && (
                            <span style={{ 
                                fontSize: '12px', 
                                color: '#007bff',
                                padding: '2px 6px',
                                background: 'white',
                                borderRadius: '3px'
                            }}>
                                Capture all system sounds
                            </span>
                        )}
                    </div>
                )}
                
                {/* Audio Source Selection for Electron Bridge */}
                {isElectron && useElectronBridge && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500' }}>
                            Audio Source:
                        </label>
                        <select
                            value={selectedSource?.id || ''}
                            onChange={(e) => {
                                const source = audioSources.find(s => s.id === e.target.value);
                                setSelectedSource(source);
                            }}
                            disabled={isRecording}
                            style={{
                                padding: '8px 12px',
                                fontSize: '14px',
                                borderRadius: '4px',
                                border: '1px solid #ced4da',
                                background: isRecording ? '#e9ecef' : 'white',
                                cursor: isRecording ? 'not-allowed' : 'pointer',
                                minWidth: '200px'
                            }}
                        >
                            {audioSources.length === 0 && (
                                <option value="">Loading sources...</option>
                            )}
                            {audioSources.map(source => (
                                <option key={source.id} value={source.id}>
                                    {source.name}
                                    {(source.name.includes('Screen') || source.name.includes('BlackHole')) && ' (Recommended)'}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={getAudioSources}
                            disabled={isRecording}
                            style={{
                                padding: '8px 12px',
                                fontSize: '14px',
                                background: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isRecording ? 'not-allowed' : 'pointer',
                                opacity: isRecording ? 0.5 : 1
                            }}
                            title="Refresh audio sources"
                        >
                            🔄
                        </button>
                    </div>
                )}
                
                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!isConnected || !activeMeeting || activeMeeting?.status === 'completed' || (isElectron && useElectronBridge && !selectedSource)}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: 'white',
                        background: isRecording ? '#dc3545' : (!activeMeeting ? '#6c757d' : '#28a745'),
                        border: 'none',
                        borderRadius: '5px',
                        cursor: (isConnected && activeMeeting && activeMeeting.status !== 'completed' && (!isElectron || !useElectronBridge || selectedSource)) ? 'pointer' : 'not-allowed',
                        opacity: (isConnected && activeMeeting && activeMeeting.status !== 'completed' && (!isElectron || !useElectronBridge || selectedSource)) ? 1 : 0.5
                    }}
                    title={!activeMeeting ? 'Start a meeting first' : (activeMeeting.status === 'completed' ? 'Meeting has ended' : (isElectron && useElectronBridge && !selectedSource ? 'Select an audio source' : ''))}
                >
                    {isRecording ? '⏹ Stop Recording' : (isElectron && useElectronBridge ? '🖥️ Start System Capture' : '🎤 Start Recording')}
                </button>
                
                <button
                    onClick={clearTranscript}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    🗑️ Clear Transcript
                </button>
                
                {/* Audio Level Indicator */}
                {isRecording && (
                    <div style={{
                        flex: 1,
                        height: '20px',
                        background: '#e9ecef',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            height: '100%',
                            width: `${Math.min(100, audioLevel * 200)}%`,
                            background: 'linear-gradient(to right, #28a745, #ffc107, #dc3545)',
                            transition: 'width 0.1s ease'
                        }} />
                    </div>
                )}
            </div>
            
            {/* Two Column Layout */}
            <div style={{ 
                display: 'flex', 
                gap: '20px'
            }}>
                {/* Transcript Display */}
                <div style={{ 
                    flex: '2',
                    minWidth: '0',
                    padding: '20px', 
                    background: '#ffffff',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    minHeight: '400px',
                    maxHeight: '600px',
                    overflowY: 'auto'
                }}>
                    <h2 style={{ marginTop: 0 }}>📝 Live Transcript</h2>
                {transcript.length === 0 ? (
                    <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
                        {isRecording ? 'Listening... Speak to see transcript' : 'Click "Start Recording" to begin'}
                    </p>
                ) : (
                    <div>
                        {transcript.map((item, index) => (
                            <div 
                                key={index}
                                style={{
                                    marginBottom: '10px',
                                    padding: '8px',
                                    background: item.isFinal ? '#f8f9fa' : '#fff3cd',
                                    borderLeft: `3px solid ${item.isFinal ? '#28a745' : '#ffc107'}`,
                                    borderRadius: '3px'
                                }}
                            >
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    marginBottom: '5px',
                                    fontSize: '12px',
                                    color: '#6c757d'
                                }}>
                                    <span>
                                        {new Date(item.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span>
                                        Confidence: {(item.confidence * 100).toFixed(1)}% | 
                                        Latency: {formatLatency(item.latency)}
                                    </span>
                                </div>
                                <div style={{ 
                                    fontWeight: item.isFinal ? 'normal' : '300',
                                    color: item.isFinal ? '#212529' : '#6c757d'
                                }}>
                                    {item.text}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                </div>
                
                {/* Right Panel - Contextual Insights or Definition History */}
                <div style={{
                    flex: '1',
                    minWidth: '0',
                    maxHeight: '600px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Toggle Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: '5px',
                        marginBottom: '10px'
                    }}>
                        <button
                            onClick={() => setRightPanelView('contextual')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: rightPanelView === 'contextual' ? '#007bff' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px 0 0 4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                            }}
                        >
                            Intelligence
                        </button>
                        <button
                            onClick={() => setRightPanelView('definitions')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: rightPanelView === 'definitions' ? '#007bff' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0 4px 4px 0',
                                cursor: 'pointer',
                                fontSize: '13px'
                            }}
                        >
                            Definitions
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div style={{ flex: 1, minHeight: 0 }}>
                        {rightPanelView === 'contextual' ? (
                            <ContextualInsights 
                                socket={socketRef.current}
                                currentTopic={activeMeeting?.title}
                            />
                        ) : (
                            <DefinitionHistory 
                                definitions={termDefinitions}
                                terms={extractedTerms}
                            />
                        )}
                    </div>
                </div>
            </div>
            </div>
            
            {/* Report View Modal */}
            {showReport && reportMeetingId && (
                <ReportView
                    meetingId={reportMeetingId}
                    onClose={() => {
                        setShowReport(false);
                        setReportMeetingId(null);
                    }}
                />
            )}
        </div>
    );
}

export default App;