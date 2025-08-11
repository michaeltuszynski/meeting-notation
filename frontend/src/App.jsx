import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

function App() {
    const [transcript, setTranscript] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [metrics, setMetrics] = useState(null);
    const [error, setError] = useState(null);
    const [extractedTerms, setExtractedTerms] = useState([]);
    const [termDefinitions, setTermDefinitions] = useState({});
    
    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const sourceRef = useRef(null);
    const streamRef = useRef(null);
    const animationRef = useRef(null);
    
    useEffect(() => {
        const socket = io(process.env.REACT_APP_WS_URL || 'http://localhost:9000');
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
    
    const startRecording = async () => {
        try {
            // Set recording state first
            setIsRecording(true);
            setError(null);
            
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
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>🎙️ Meeting Intelligence Assistant</h1>
            
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
            
            {/* Controls */}
            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '20px',
                alignItems: 'center'
            }}>
                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!isConnected}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: 'white',
                        background: isRecording ? '#dc3545' : '#28a745',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: isConnected ? 'pointer' : 'not-allowed',
                        opacity: isConnected ? 1 : 0.5
                    }}
                >
                    {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
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
                
                {/* Extracted Terms Sidebar */}
                <div style={{
                    flex: '1',
                    minWidth: '0',
                    padding: '20px',
                    background: '#ffffff',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    maxHeight: '600px',
                    overflowY: 'auto'
                }}>
                    <h2 style={{ marginTop: 0 }}>🔍 Key Terms</h2>
                    {extractedTerms.length === 0 ? (
                        <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
                            Terms will appear here as they're extracted from the conversation
                        </p>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {extractedTerms.map((term, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            padding: '6px 12px',
                                            background: termDefinitions[term] ? '#d4edda' : '#e7f3ff',
                                            border: `1px solid ${termDefinitions[term] ? '#28a745' : '#0066cc'}`,
                                            borderRadius: '20px',
                                            fontSize: '14px',
                                            color: termDefinitions[term] ? '#155724' : '#0066cc',
                                            fontWeight: '500',
                                            whiteSpace: 'nowrap',
                                            cursor: termDefinitions[term] ? 'help' : 'default',
                                            position: 'relative',
                                            title: termDefinitions[term]?.summary || 'Fetching definition...'
                                        }}
                                    >
                                        {term}
                                        {termDefinitions[term] && (
                                            <span style={{
                                                marginLeft: '4px',
                                                fontSize: '12px',
                                                opacity: 0.7
                                            }}>ⓘ</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {/* Definition Display */}
                            {Object.keys(termDefinitions).length > 0 && (
                                <div style={{
                                    marginTop: '20px',
                                    padding: '15px',
                                    background: '#f8f9fa',
                                    borderRadius: '5px',
                                    maxHeight: '200px',
                                    overflowY: 'auto'
                                }}>
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Recent Definitions</h4>
                                    {extractedTerms
                                        .filter(term => termDefinitions[term])
                                        .slice(0, 3)
                                        .map((term, index) => (
                                            <div key={index} style={{ marginBottom: '10px' }}>
                                                <strong style={{ color: '#0066cc' }}>{term}:</strong>
                                                <div style={{ fontSize: '13px', marginTop: '2px' }}>
                                                    {termDefinitions[term].summary}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Metrics Section */}
                    {metrics?.gpt4oMini && (
                        <div style={{
                            marginTop: '30px',
                            padding: '15px',
                            background: '#f8f9fa',
                            borderRadius: '5px',
                            fontSize: '12px'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>GPT-4o Mini Metrics</h3>
                            <div style={{ display: 'grid', gap: '5px' }}>
                                <div>Extractions: {metrics.gpt4oMini.totalExtractions}</div>
                                <div>Avg Latency: {formatLatency(Math.round(metrics.gpt4oMini.averageLatency))}</div>
                                <div>Last: {formatLatency(metrics.gpt4oMini.lastLatency)}</div>
                                {metrics.gpt4oMini.errors > 0 && (
                                    <div style={{ color: '#dc3545' }}>Errors: {metrics.gpt4oMini.errors}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;