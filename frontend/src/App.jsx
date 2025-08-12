import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Mic, MicOff, Settings, Activity, Clock, Users, Wifi } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

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
    const [rightPanelView, setRightPanelView] = useState('contextual');
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
    useEffect(() => {
        if (transcriptEndRef.current) {
            transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcript]);

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
        // Don't automatically end meeting - user should explicitly click End Meeting
    };

    const formatLatency = (latency) => {
        if (!latency) return 'N/A';
        return `${latency}ms`;
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            {/* Meeting Sidebar */}
            {showSidebar && (
                <div className="w-80 border-r bg-white dark:bg-gray-800 shadow-sm">
                    <MeetingSidebar
                        onSelectMeeting={handleSelectMeeting}
                        activeMeetingId={activeMeeting?.id}
                        onNewMeeting={handleNewMeeting}
                        onGenerateReport={handleGenerateReport}
                        socket={socketRef.current}
                    />
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="border-b bg-white dark:bg-gray-800 px-6 py-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {!showSidebar && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowSidebar(true)}
                                    className="md:hidden"
                                >
                                    <Users className="h-4 w-4" />
                                </Button>
                            )}
                            <div className="flex items-center gap-2">
                                <Activity className="h-6 w-6 text-blue-600" />
                                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    TranscriptIQ
                                </h1>
                                <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                                    AI-Powered Meeting Intelligence
                                </div>
                            </div>
                            {isElectron && (
                                <Badge variant="secondary" className="hidden sm:inline-flex">
                                    Electron Mode
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Connection Status */}
                            <div className="flex items-center gap-2">
                                <Wifi className={`h-4 w-4 ${isConnected ? 'text-green-600' : 'text-red-600'}`} />
                                <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            
                            {/* Active Meeting */}
                            {activeMeeting && (
                                <Badge variant={activeMeeting.status === 'active' ? 'success' : 'secondary'}>
                                    {activeMeeting.title} {activeMeeting.status === 'active' && '(LIVE)'}
                                </Badge>
                            )}
                        </div>
                        
                        {/* Settings Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSettings(true)}
                            className="flex items-center gap-2"
                        >
                            <Settings className="h-4 w-4" />
                            <span className="hidden sm:inline">Settings</span>
                        </Button>
                    </div>
                </header>

                {/* Status Cards */}
                <div className="p-6 border-b bg-gray-50 dark:bg-gray-900">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-white dark:bg-gray-800">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500' : 'bg-gray-400'}`} />
                                    <span className="text-sm font-medium">
                                        {isRecording ? 'Recording' : 'Stopped'}
                                    </span>
                                    {isRecording && isElectron && (
                                        <Badge variant="outline" className="text-xs">
                                            {useElectronBridge ? 'System Audio' : 'Microphone'}
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {metrics && (
                            <>
                                <Card className="bg-white dark:bg-gray-800">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-blue-600" />
                                            <div>
                                                <div className="text-sm font-medium">Avg Latency</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatLatency(Math.round(metrics.avgLatency))}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-white dark:bg-gray-800">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-green-600" />
                                            <div>
                                                <div className="text-sm font-medium">Last Latency</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatLatency(metrics.deepgram?.lastLatency || metrics.lastLatency)}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}

                        <Card className="bg-white dark:bg-gray-800">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <Settings className="h-4 w-4 text-gray-600" />
                                    <div>
                                        <div className="text-sm font-medium">Audio Source</div>
                                        <div className="text-xs text-muted-foreground">
                                            {useElectronBridge ? 'System Audio' : 'Microphone'}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* Meeting Required Notice */}
                {!activeMeeting && (
                    <div className="mx-6 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <div className="text-yellow-500 text-xl">ℹ️</div>
                            <div>
                                <div className="font-medium text-yellow-800">No Active Meeting</div>
                                <div className="text-yellow-700 text-sm mt-1">
                                    Please start a new meeting from the sidebar before recording. All transcripts must be associated with a meeting.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="p-6 border-b bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between gap-4">
                        {/* Audio Source Selector */}
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Audio Source
                            </span>
                            <div className="flex items-center gap-3">
                                <div className="relative inline-flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                    <button
                                        onClick={() => {
                                            if (!isRecording) {
                                                setUseElectronBridge(false);
                                            }
                                        }}
                                        disabled={isRecording}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                                            !useElectronBridge 
                                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                        } ${isRecording ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        Microphone
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!isRecording) {
                                                setUseElectronBridge(true);
                                                if (!electronBridgeConnected) {
                                                    setShowElectronInstructions(true);
                                                    checkElectronBridge();
                                                }
                                            }
                                        }}
                                        disabled={isRecording}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                                            useElectronBridge 
                                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                        } ${isRecording ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        Electron Bridge
                                    </button>
                                </div>
                                
                                {useElectronBridge && (
                                    <Badge variant={electronBridgeConnected ? 'success' : 'warning'} className="text-xs">
                                        {electronBridgeConnected ? '✅ Connected' : '⚠️ Not Connected'}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Recording Controls */}
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={!isConnected || !activeMeeting || activeMeeting?.status === 'completed' || (useElectronBridge && !electronBridgeConnected)}
                                variant={isRecording ? "destructive" : "default"}
                                size="lg"
                            >
                                {isRecording ? (
                                    <>
                                        <MicOff className="h-4 w-4 mr-2" />
                                        Stop Recording
                                    </>
                                ) : (
                                    <>
                                        <Mic className="h-4 w-4 mr-2" />
                                        Start Recording
                                    </>
                                )}
                            </Button>

                            {/* End Meeting Button - Only show when meeting is active */}
                            {activeMeeting && activeMeeting.status === 'active' && (
                                <Button
                                    onClick={() => {
                                        if (isRecording) {
                                            stopRecording();
                                        } else {
                                            handleEndMeeting();
                                        }
                                    }}
                                    variant="warning"
                                    size="lg"
                                    className="bg-orange-500 hover:bg-orange-600 text-white"
                                >
                                    <Clock className="h-4 w-4 mr-2" />
                                    End Meeting
                                </Button>
                            )}

                            <Button
                                onClick={() => {
                                    setTranscript([]);
                                    setExtractedTerms([]);
                                    setTermDefinitions({});
                                    if (socketRef.current) {
                                        socketRef.current.emit('transcript:clear');
                                    }
                                }}
                                variant="outline"
                                size="lg"
                            >
                                Clear Transcript
                            </Button>

                            {/* Audio Level Indicator */}
                            {isRecording && (
                                <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100"
                                        style={{ width: `${Math.min(100, audioLevel * 200)}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content Area with Resizable Panels */}
                <div className="flex-1 min-h-0">
                    <PanelGroup direction="horizontal" className="h-full">
                        {/* Transcript Panel */}
                        <Panel defaultSize={50} minSize={30}>
                            <Card className="h-full m-4 mr-2 flex flex-col">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        📝 Live Transcript
                                    </CardTitle>
                                    <CardDescription>
                                        Real-time speech-to-text transcription with confidence scoring
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto">
                                    {transcript.length === 0 ? (
                                        <div className="text-center text-muted-foreground py-8">
                                            {isRecording ? 'Listening... Speak to see transcript' : 'Click "Start Recording" to begin'}
                                        </div>
                                    ) : (
                                        <>
                                            <CorrectableTranscript 
                                                transcript={transcript} 
                                                socket={socketRef.current}
                                                className="space-y-3"
                                            />
                                            <div ref={transcriptEndRef} />
                                        </>
                                    )}
                                    <div className="mt-4 text-xs text-gray-500 text-center">
                                        💡 Click on any word to correct it globally across all meetings
                                    </div>
                                </CardContent>
                            </Card>
                        </Panel>

                        {/* Resize Handle */}
                        <PanelResizeHandle className="w-2 hover:bg-blue-500/20 transition-colors duration-200">
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="w-0.5 h-8 bg-gray-300 rounded-full" />
                            </div>
                        </PanelResizeHandle>

                        {/* Right Panel */}
                        <Panel defaultSize={50} minSize={30}>
                            <div className="h-full m-4 ml-2 flex flex-col">
                                {/* Toggle Buttons */}
                                <div className="flex mb-4">
                                    <Button
                                        onClick={() => setRightPanelView('contextual')}
                                        variant={rightPanelView === 'contextual' ? 'default' : 'outline'}
                                        className="flex-1 rounded-r-none"
                                        size="sm"
                                    >
                                        Intelligence
                                    </Button>
                                    <Button
                                        onClick={() => setRightPanelView('definitions')}
                                        variant={rightPanelView === 'definitions' ? 'default' : 'outline'}
                                        className="flex-1 rounded-l-none"
                                        size="sm"
                                    >
                                        Glossary
                                    </Button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-h-0 overflow-y-auto">
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
                        </Panel>
                    </PanelGroup>
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

            {/* Electron Bridge Instructions Modal */}
            <Dialog open={showElectronInstructions} onOpenChange={setShowElectronInstructions}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            🖥️ Launch TranscriptIQ Audio Bridge
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
                                        {electronBridgeConnected ? '✅' : '⏳'}
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
                            🔄 Check Again
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