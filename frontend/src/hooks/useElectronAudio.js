import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to handle Electron audio capture when running in Electron environment
 */
const useElectronAudio = () => {
    const [isElectron, setIsElectron] = useState(false);
    const [audioSources, setAudioSources] = useState([]);
    const [selectedSource, setSelectedSource] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureMetrics, setCaptureMetrics] = useState(null);
    const audioScriptLoaded = useRef(false);

    useEffect(() => {
        // Check if running in Electron by looking for the correct API structure
        const electronAPI = window.electronAPI;
        console.log('[useElectronAudio] Checking for Electron API:', electronAPI);
        console.log('[useElectronAudio] Has audio property?', electronAPI?.audio);
        console.log('[useElectronAudio] Has getSources?', electronAPI?.audio?.getSources);
        
        // Check if the audio property exists with the expected methods
        if (electronAPI && electronAPI.audio && typeof electronAPI.audio.getSources === 'function') {
            setIsElectron(true);
            console.log('[useElectronAudio] Electron environment detected with correct audio API');
            
            // Load renderer audio script dynamically
            if (!audioScriptLoaded.current) {
                const script = document.createElement('script');
                script.src = '/electron-audio-bridge/renderer-audio.js';
                script.onload = () => {
                    console.log('[useElectronAudio] Renderer audio script loaded');
                    audioScriptLoaded.current = true;
                };
                script.onerror = (error) => {
                    console.error('[useElectronAudio] Failed to load renderer audio script:', error);
                };
                document.head.appendChild(script);
            }

            // Load Socket.IO client if not already loaded
            if (!window.io) {
                const socketScript = document.createElement('script');
                socketScript.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
                socketScript.onload = () => {
                    console.log('[useElectronAudio] Socket.IO client loaded');
                };
                document.head.appendChild(socketScript);
            }
        }
    }, []);

    const getAudioSources = useCallback(async () => {
        if (!isElectron || !window.electronAPI) return [];
        
        try {
            const sources = await window.electronAPI.audio.getSources();
            console.log('[useElectronAudio] Available audio sources:', sources);
            setAudioSources(sources);
            
            // Auto-select the first suitable source (usually the screen)
            if (sources.length > 0 && !selectedSource) {
                const defaultSource = sources.find(s => 
                    s.name.includes('Screen') || 
                    s.name.includes('Entire') ||
                    s.name.includes('BlackHole') ||
                    s.name.includes('VB-Cable')
                ) || sources[0];
                
                setSelectedSource(defaultSource);
                console.log('[useElectronAudio] Auto-selected source:', defaultSource.name);
            }
            
            return sources;
        } catch (error) {
            console.error('[useElectronAudio] Error getting audio sources:', error);
            return [];
        }
    }, [isElectron, selectedSource]);

    const startCapture = useCallback(async (sourceId = null) => {
        if (!isElectron || !window.electronAPI) {
            console.warn('[useElectronAudio] Not in Electron environment');
            return false;
        }

        try {
            const source = sourceId || selectedSource?.id;
            if (!source) {
                console.error('[useElectronAudio] No audio source selected');
                return false;
            }

            console.log('[useElectronAudio] Starting capture with source:', source);
            const result = await window.electronAPI.audio.startCapture(source);
            
            if (result.success) {
                setIsCapturing(true);
                console.log('[useElectronAudio] Audio capture started successfully');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[useElectronAudio] Error starting capture:', error);
            return false;
        }
    }, [isElectron, selectedSource]);

    const stopCapture = useCallback(async () => {
        if (!isElectron || !window.electronAPI) return false;
        
        try {
            console.log('[useElectronAudio] Stopping capture');
            const result = await window.electronAPI.audio.stopCapture();
            
            if (result.success) {
                setIsCapturing(false);
                console.log('[useElectronAudio] Audio capture stopped');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[useElectronAudio] Error stopping capture:', error);
            return false;
        }
    }, [isElectron]);

    const getMetrics = useCallback(async () => {
        if (!isElectron || !window.electronAPI) return null;
        
        try {
            const metrics = await window.electronAPI.audio.getMetrics();
            setCaptureMetrics(metrics);
            return metrics;
        } catch (error) {
            console.error('[useElectronAudio] Error getting metrics:', error);
            return null;
        }
    }, [isElectron]);

    // Set up event listeners for audio events
    useEffect(() => {
        if (!isElectron) return;

        const handleCaptureStarted = (event) => {
            console.log('[useElectronAudio] Capture started event:', event.detail);
            setIsCapturing(true);
        };

        const handleCaptureStopped = (event) => {
            console.log('[useElectronAudio] Capture stopped event:', event.detail);
            setIsCapturing(false);
        };

        const handleCaptureError = (event) => {
            console.error('[useElectronAudio] Capture error:', event.detail);
            setIsCapturing(false);
        };

        window.addEventListener('audio:capture-started', handleCaptureStarted);
        window.addEventListener('audio:capture-stopped', handleCaptureStopped);
        window.addEventListener('audio:capture-error', handleCaptureError);

        return () => {
            window.removeEventListener('audio:capture-started', handleCaptureStarted);
            window.removeEventListener('audio:capture-stopped', handleCaptureStopped);
            window.removeEventListener('audio:capture-error', handleCaptureError);
        };
    }, [isElectron]);

    // Fetch audio sources on mount
    useEffect(() => {
        if (isElectron) {
            getAudioSources();
        }
    }, [isElectron, getAudioSources]);

    return {
        isElectron,
        audioSources,
        selectedSource,
        setSelectedSource,
        isCapturing,
        captureMetrics,
        startCapture,
        stopCapture,
        getAudioSources,
        getMetrics
    };
};

export default useElectronAudio;