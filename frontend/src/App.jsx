import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

function App() {
    const [transcript, setTranscript] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    
    useEffect(() => {
        const socket = io('http://localhost:8080');
        
        socket.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to backend');
        });
        
        socket.on('transcript:update', (data) => {
            setTranscript(prev => prev + ' ' + data.text);
        });
        
        return () => socket.disconnect();
    }, []);
    
    return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>Meeting Intelligence Assistant</h1>
            <div style={{ 
                padding: '10px', 
                background: isConnected ? '#d4edda' : '#f8d7da',
                borderRadius: '5px',
                marginBottom: '20px'
            }}>
                Status: {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div style={{ 
                padding: '20px', 
                background: '#f8f9fa',
                borderRadius: '5px',
                minHeight: '300px'
            }}>
                <h2>Live Transcript</h2>
                <p>{transcript || 'Waiting for audio...'}</p>
            </div>
        </div>
    );
}

export default App;
