import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Mic, MicOff, Settings, Activity, Clock, Users, Wifi, AlertTriangle, Monitor, CheckCircle, Loader, RefreshCw } from 'lucide-react';
// Removed react-resizable-panels - no longer needed

import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Switch } from './components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';

import MeetingSidebar from './components/MeetingSidebar';
import ReportView from './components/ReportView';
import DefinitionHistory from './components/DefinitionHistory';
import ContextualInsights from './components/ContextualInsights';
import CorrectableTranscript from './components/CorrectableTranscript';
import SettingsModal from './components/Settings';
import MeetingIntelligence from './components/MeetingIntelligence';
import useElectronAudio from './hooks/useElectronAudio';
import './styles/panels.css';

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
    const [intelligenceView, setIntelligenceView] = useState('insights');
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordingStartTime, setRecordingStartTime] = useState(null);
    const [useElectronBridge, setUseElectronBridge] = useState(false);
    const [electronBridgeConnected, setElectronBridgeConnected] = useState(false);
    const [showElectronInstructions, setShowElectronInstructions] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    
    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const sourceRef = useRef(null);
    const streamRef = useRef(null);
    const transcriptEndRef = useRef(null);
    
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

    // Check Electron bridge connection
    const checkElectronBridge = async () => {
        try {
            const response = await fetch('http://localhost:3380/health', {
                method: 'GET',
                mode: 'cors'
            }).catch(() => null);
            
            if (response && response.ok) {
                setElectronBridgeConnected(true);
                return true;
            }
        } catch (error) {
            console.log('Electron bridge not available');
        }
        setElectronBridgeConnected(false);
        return false;
    };

    // Check Electron bridge status periodically when enabled
    useEffect(() => {
        if (useElectronBridge) {
            checkElectronBridge();
            const interval = setInterval(checkElectronBridge, 3000);
            return () => clearInterval(interval);
        } else {
            setElectronBridgeConnected(false);
        }
    }, [useElectronBridge]);

    // Auto-scroll transcript to bottom when new entries arrive
    // Only if viewing transcript tab and user is near the bottom
    useEffect(() => {
        if (transcriptEndRef.current && intelligenceView === 'transcript') {
            // Check if user is near the bottom of the scrollable area
            const scrollContainer = transcriptEndRef.current.parentElement;
            if (scrollContainer) {
                const isNearBottom = 
                    scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 100;
                
                // Only auto-scroll if user is already following the transcript
                if (isNearBottom) {
                    transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
    }, [transcript, intelligenceView]);

    useEffect(() => {
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
            setMetrics(status.metrics);
            if (status.activeMeetingId) {
                fetch(`http://localhost:9000/api/meetings/${status.activeMeetingId}`)
                    .then(res => res.json())
                    .then(meeting => setActiveMeeting(meeting))
                    .catch(console.error);
            }
        });
        
        socket.on('meeting:started', (meeting) => {
            setActiveMeeting(meeting);
            setTranscript([]);
            setExtractedTerms([]);
            setTermDefinitions({});
        });
        
        socket.on('meeting:ended', (meeting) => {
            setActiveMeeting(null);
            // Clear intelligence data when meeting ends
            setExtractedTerms([]);
            setTermDefinitions({});
        });
        
        socket.on('meeting:deleted', (data) => {
            // If the deleted meeting is the active one, clear everything
            if (activeMeeting && activeMeeting.id === data.meetingId) {
                setActiveMeeting(null);
                setTranscript([]);
                setExtractedTerms([]);
                setTermDefinitions({});
            }
        });
        
        socket.on('intelligence:reset', () => {
            // Clear all intelligence data on backend request
            setExtractedTerms([]);
            setTermDefinitions({});
        });
        
        socket.on('transcript:update', (data) => {
            if (data.text && data.text.trim()) {
                setTranscript(prev => [...prev, {
                    text: data.text,
                    isFinal: data.isFinal,
                    confidence: data.confidence,
                    timestamp: data.timestamp,
                    latency: data.latency
                }]);
                
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
            if (data.code === 'NO_ACTIVE_MEETING') {
                setIsRecording(false);
                setAudioLevel(0);
            }
            setTimeout(() => setError(null), 5000);
        });
        
        socket.on('terms:extracted', (data) => {
            setExtractedTerms(prev => {
                const newTerms = [...new Set([...data.terms, ...prev])].slice(0, 20);
                return newTerms;
            });
        });
        
        socket.on('definitions:updated', (data) => {
            setTermDefinitions(prev => {
                const newDefs = { ...prev };
                data.forEach(item => {
                    newDefs[item.term] = item.definition;
                });
                return newDefs;
            });
        });
        
        socket.on('metrics:response', (data) => {
            setMetrics(data);
        });
        
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
            // Clear current intelligence data before switching
            setExtractedTerms([]);
            setTermDefinitions({});
            
            if (socketRef.current) {
                socketRef.current.emit('meeting:setContext', meeting.id);
            }
            
            const [transcriptsRes, termsRes] = await Promise.all([
                fetch(`http://localhost:9000/api/meetings/${meeting.id}/transcripts`),
                fetch(`http://localhost:9000/api/meetings/${meeting.id}/terms`)
            ]);
            
            const transcripts = await transcriptsRes.json();
            const terms = await termsRes.json();
            
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
            if (!activeMeeting) {
                setError('Please start a meeting before recording. Click "New Meeting" in the sidebar.');
                return;
            }
            
            if (activeMeeting.status === 'completed') {
                setError('This meeting has already ended. Please start a new meeting to record.');
                return;
            }
            
            setIsRecording(true);
            setError(null);
            setRecordingStartTime(Date.now());
            setRecordingDuration(0);
            
            if (isElectron && useElectronBridge) {
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
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            audioContextRef.current = audioContext;
            
            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            let chunkCount = 0;
            const AMPLIFICATION_FACTOR = 3;
            
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                
                let sum = 0;
                let maxLevel = 0;
                for (let i = 0; i < inputData.length; i++) {
                    const absValue = Math.abs(inputData[i]);
                    sum += absValue;
                    maxLevel = Math.max(maxLevel, absValue);
                }
                const avgLevel = sum / inputData.length;
                setAudioLevel(avgLevel * 500);
                
                const int16Data = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const amplifiedSample = inputData[i] * AMPLIFICATION_FACTOR;
                    const sample = Math.max(-1, Math.min(1, amplifiedSample));
                    int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                }
                
                if (socketRef.current && socketRef.current.connected) {
                    socketRef.current.emit('audio:chunk', {
                        audio: Array.from(int16Data),
                        sampleRate: audioContext.sampleRate,
                        channels: 1
                    });
                    
                    if (++chunkCount % 10 === 0) {
                        console.log(`Sent ${chunkCount} chunks | Avg Level: ${(avgLevel * 100).toFixed(3)} | Max: ${(maxLevel * 100).toFixed(3)}`);
                    }
                }
            };
            
            source.connect(processor);
            processor.connect(audioContext.destination);
            
        } catch (err) {
            console.error('Error starting recording:', err);
            setError('Failed to start recording: ' + err.message);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (isElectron && useElectronBridge && isElectronCapturing) {
            stopElectronCapture();
            setIsRecording(false);
            setAudioLevel(0);
            setRecordingStartTime(null);
            setRecordingDuration(0);
            // Don't automatically end meeting - user should explicitly click End Meeting
            return;
        }
        
        if (processorRef.current && sourceRef.current) {
            sourceRef.current.disconnect();
            processorRef.current.disconnect();
        }
        
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if (socketRef.current) {
            socketRef.current.emit('audio:stop');
        }
        
        setIsRecording(false);
        setAudioLevel(0);
        setRecordingStartTime(null);
        setRecordingDuration(0);
        // Don't automatically end meeting - user should explicitly click End Meeting
    };

    const formatLatency = (latency) => {
        if (!latency) return 'N/A';
        return `${latency}ms`;
    };
    
    const formatDuration = (seconds) => {
        if (!seconds) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 relative">
            {/* Meeting Sidebar */}
            <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden`}>
                {showSidebar && (
                    <div className="w-80 border-r bg-white dark:bg-gray-800 shadow-sm h-full">
                        <MeetingSidebar
                            onSelectMeeting={handleSelectMeeting}
                            activeMeetingId={activeMeeting?.id}
                            onNewMeeting={handleNewMeeting}
                            onGenerateReport={handleGenerateReport}
                            socket={socketRef.current}
                        />
                    </div>
                )}
            </div>
            
            {/* Sidebar Toggle Button - Floating on top */}
            <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`fixed ${showSidebar ? 'left-[308px]' : 'left-4'} top-1/2 -translate-y-1/2 z-[100] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 shadow-lg`}
                title={showSidebar ? "Hide sidebar" : "Show sidebar"}
            >
                {showSidebar ? (
                    <svg className="h-3 w-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                ) : (
                    <svg className="h-3 w-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                )}
            </button>

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative">
                {/* Header */}
                <header className="border-b bg-white dark:bg-gray-800 px-6 py-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-blue-600" />
                                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        TranscriptIQ
                                    </h1>
                                </div>
                                {isElectron && (
                                    <Badge variant="secondary" className="text-xs">
                                        Electron Mode
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Active Meeting Badge */}
                            {activeMeeting && (
                                <div className="flex items-center gap-2">
                                    {activeMeeting.status === 'active' && (
                                        <div className="relative">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
                                        </div>
                                    )}
                                    <span className="text-sm font-medium text-gray-700">
                                        {activeMeeting.title}
                                    </span>
                                </div>
                            )}
                            
                            {/* Connection Status Icon */}
                            <div className="p-2" title={isConnected ? 'Connected' : 'Disconnected'}>
                                <Wifi className={`h-4 w-4 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
                            </div>
                            
                            {/* Settings Button */}
                            <button
                                onClick={() => setShowSettings(true)}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                                title="Settings"
                            >
                                <Settings className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Compact Status Bar */}
                <div className="px-6 py-2 border-b bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-6">
                            {/* Recording Status */}
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                                <span className="font-medium">
                                    {isRecording ? 'Recording' : 'Stopped'}
                                </span>
                            </div>

                            {/* Latency Metrics */}
                            {metrics && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-3 w-3 text-blue-600" />
                                        <span className="text-gray-600">Avg Latency:</span>
                                        <span className="font-medium">{formatLatency(Math.round(metrics.avgLatency))}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-3 w-3 text-green-600" />
                                        <span className="text-gray-600">Last Latency:</span>
                                        <span className="font-medium">{formatLatency(metrics.deepgram?.lastLatency || metrics.lastLatency)}</span>
                                    </div>
                                </>
                            )}

                            {/* Audio Source */}
                            <div className="flex items-center gap-2">
                                <Settings className="h-3 w-3 text-gray-600" />
                                <span className="text-gray-600">Audio Source:</span>
                                <span className="font-medium">{useElectronBridge ? 'System Audio' : 'Microphone'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Streamlined Controls Bar */}
                <div className="px-4 py-2 border-b bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                        {/* Left side: Audio Source & Status */}
                        <div className="flex items-center gap-4">
                            {/* Audio Source Toggle */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (!isRecording) {
                                            setUseElectronBridge(!useElectronBridge);
                                            if (!useElectronBridge && !electronBridgeConnected) {
                                                setShowElectronInstructions(true);
                                                checkElectronBridge();
                                            }
                                        }
                                    }}
                                    disabled={isRecording}
                                    className={`flex items-center gap-2 px-2.5 py-1 text-xs font-medium rounded-md transition-all border ${
                                        isRecording 
                                            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' 
                                            : 'bg-white hover:bg-gray-50 border-gray-300'
                                    }`}
                                    title="Click to toggle audio source"
                                >
                                    {useElectronBridge ? (
                                        <>
                                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16.5v-9l9 4.5-9 4.5z"/>
                                            </svg>
                                            <span>System Audio</span>
                                        </>
                                    ) : (
                                        <>
                                            <Mic className="h-3 w-3" />
                                            <span>Microphone</span>
                                        </>
                                    )}
                                    <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                    </svg>
                                </button>
                                {useElectronBridge && !electronBridgeConnected && (
                                    <span className="text-xs text-yellow-600 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Not Connected
                                    </span>
                                )}
                            </div>

                            {/* Meeting Status Indicator */}
                            {!activeMeeting && (
                                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                    <span>No active meeting - start one from sidebar</span>
                                </div>
                            )}

                            {/* Audio Level Indicator */}
                            {isRecording && (
                                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100"
                                        style={{ width: `${Math.min(100, audioLevel * 200)}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Right side: Compact Action Buttons */}
                        <div className="flex items-center gap-1">
                            {/* Record Button */}
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={!isConnected || !activeMeeting || activeMeeting?.status === 'completed' || (useElectronBridge && !electronBridgeConnected)}
                                className={`p-2 rounded-md transition-all ${
                                    isRecording 
                                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                                        : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300'
                                }`}
                                title={isRecording ? "Stop Recording" : "Start Recording"}
                            >
                                {isRecording ? (
                                    <MicOff className="h-4 w-4" />
                                ) : (
                                    <Mic className="h-4 w-4" />
                                )}
                            </button>

                            {/* End Meeting Button */}
                            {activeMeeting && activeMeeting.status === 'active' && (
                                <button
                                    onClick={() => {
                                        if (isRecording) {
                                            stopRecording();
                                        }
                                        handleEndMeeting();
                                    }}
                                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-all"
                                    title="End Meeting"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                    </svg>
                                </button>
                            )}

                            {/* Clear Transcript Button */}
                            <button
                                onClick={() => {
                                    setTranscript([]);
                                    setExtractedTerms([]);
                                    setTermDefinitions({});
                                    if (socketRef.current) {
                                        socketRef.current.emit('transcript:clear');
                                    }
                                }}
                                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-all"
                                title="Clear Transcript"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Floating Error Toast - appears at top right when there's an error */}
                {error && (
                    <div className="fixed top-20 right-4 z-50 max-w-sm p-3 bg-red-50 border border-red-200 rounded-lg shadow-lg animate-slide-in">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            <span className="text-sm text-red-800">{error}</span>
                            <button 
                                onClick={() => setError(null)}
                                className="ml-auto text-red-500 hover:text-red-700"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}

                {/* Meeting Intelligence Component */}
                <MeetingIntelligence 
                    intelligenceView={intelligenceView}
                    setIntelligenceView={setIntelligenceView}
                    isRecording={isRecording}
                    recordingStartTime={recordingStartTime}
                    useElectronBridge={useElectronBridge}
                    metrics={metrics}
                    activeMeeting={activeMeeting}
                    socket={socketRef.current}
                    extractedTerms={extractedTerms}
                    termDefinitions={termDefinitions}
                    transcript={transcript}
                    transcriptEndRef={transcriptEndRef}
                    formatDuration={formatDuration}
                    formatLatency={formatLatency}
                />
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

            {/* Electron Bridge Instructions Modal */}
            <Dialog open={showElectronInstructions} onOpenChange={setShowElectronInstructions}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Monitor className="h-5 w-5" />
                                Launch TranscriptIQ Audio Bridge
                            </div>
                        </DialogTitle>
                        <DialogDescription>
                            To capture system audio without ambient noise, you need to launch the TranscriptIQ Audio Bridge application.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Quick Start</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-2">
                                    <p className="text-sm">1. Open a new terminal</p>
                                    <p className="text-sm">2. Navigate to the project directory:</p>
                                    <code className="block p-3 bg-gray-900 text-green-400 rounded text-sm">
                                        cd /Users/mpt/code/meeting-notation/electron-audio-bridge
                                    </code>
                                    <p className="text-sm">3. Install dependencies (first time only):</p>
                                    <code className="block p-3 bg-gray-900 text-green-400 rounded text-sm">
                                        npm install
                                    </code>
                                    <p className="text-sm">4. Start the Electron bridge:</p>
                                    <code className="block p-3 bg-gray-900 text-green-400 rounded text-sm">
                                        npm start
                                    </code>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl">
                                        {electronBridgeConnected ? (
                                            <CheckCircle className="h-6 w-6 text-green-500" />
                                        ) : (
                                            <Loader className="h-6 w-6 text-blue-500 animate-spin" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium">
                                            Status: {electronBridgeConnected ? 'Connected!' : 'Waiting for connection...'}
                                        </div>
                                        {!electronBridgeConnected && (
                                            <div className="text-sm text-muted-foreground">
                                                Checking every 3 seconds...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <DialogFooter>
                        <Button
                            onClick={() => checkElectronBridge()}
                            variant="outline"
                        >
                            <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Check Again
                            </div>
                        </Button>
                        <Button onClick={() => setShowElectronInstructions(false)}>
                            {electronBridgeConnected ? '✓ Done' : 'Close'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Settings Modal */}
            <SettingsModal 
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                socket={socketRef.current}
            />
        </div>
    );
}

export default App;