import React, { useState, useEffect } from 'react';
import { AlertTriangle, Key, Brain } from 'lucide-react';
import GlobalCorrections from './GlobalCorrections';

function Settings({ isOpen, onClose, socket }) {
    const [activeTab, setActiveTab] = useState('api');
    const [settings, setSettings] = useState({
        // Transcription API Keys
        deepgramApiKey: '',
        assemblyaiApiKey: '',
        googleSpeechApiKey: '',
        azureSpeechKey: '',
        azureSpeechRegion: '',
        revaiApiKey: '',
        speechmaticsApiKey: '',
        
        // LLM API Keys
        openaiApiKey: '',
        anthropicApiKey: '',
        geminiApiKey: '',
        
        // Knowledge/Search API Keys
        tavilyApiKey: '',
        exaApiKey: '',
        perplexityApiKey: '',
        serpapiKey: '',
        braveApiKey: '',
        
        // Provider selections
        transcriptionProvider: 'deepgram', // 'deepgram', 'assemblyai', 'whisper', 'google', 'azure', 'revai', 'speechmatics'
        llmProvider: 'openai', // 'openai', 'anthropic', 'gemini'
        llmModel: 'gpt-4o-mini', // Model name within the selected provider
        knowledgeProvider: 'tavily', // 'tavily', 'exa', 'perplexity', 'serpapi', 'brave'
        
        // Other settings
        maxContextLength: 8000,
        enableNotifications: true,
        autoSaveInterval: 30,
        transcriptionConfidenceThreshold: 0.8,
        enableContextualIntelligence: true,
        enableKnowledgeRetrieval: true,
        cacheExpiryHours: 24,
        
        // AI Prompts
        talkingPointsPrompt: `Based on this meeting context, generate 3-5 intelligent talking points or questions about "{topic}".

CONTEXT:
{context}

MEETING GLOSSARY:
{glossary}

Generate talking points that show understanding and move the conversation forward.`
    });
    
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showApiKeys, setShowApiKeys] = useState({
        // Transcription providers
        deepgram: false,
        assemblyai: false,
        whisper: false,
        google: false,
        azure: false,
        revai: false,
        speechmatics: false,
        // LLM providers
        openai: false,
        anthropic: false,
        gemini: false,
        // Knowledge providers
        tavily: false,
        exa: false,
        perplexity: false,
        serpapi: false,
        brave: false,
    });
    
    const [availableModels, setAvailableModels] = useState({
        openai: [],
        anthropic: [],
        gemini: []
    });
    
    const [loadingModels, setLoadingModels] = useState(false);
    
    // Track which providers have valid API keys
    const [providerStatus, setProviderStatus] = useState({
        llm: {},
        transcription: {},
        knowledge: {}
    });

    useEffect(() => {
        if (isOpen && socket) {
            // Load current settings when modal opens
            socket.emit('settings:get');
            
            // Check which providers have valid API keys
            socket.emit('providers:check');
            
            // Fetch available models for each provider
            fetchModelsForProvider('openai');
            fetchModelsForProvider('anthropic');
            fetchModelsForProvider('gemini');
        }
    }, [isOpen, socket]);

    useEffect(() => {
        if (!socket) return;

        const handleSettingsResponse = (data) => {
            if (data.settings) {
                setSettings(prev => ({ ...prev, ...data.settings }));
            }
        };

        const handleSettingsSaved = (data) => {
            setIsSaving(false);
            if (data.success) {
                setMessage({ type: 'success', text: 'Settings saved successfully!' });
                // Close modal after a brief delay to show success message
                setTimeout(() => {
                    setMessage({ type: '', text: '' });
                    onClose();
                }, 500);
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
            }
        };
        
        const handleModelsResponse = (data) => {
            if (data.success && data.models) {
                setAvailableModels(prev => ({
                    ...prev,
                    [data.provider]: data.models
                }));
            }
            setLoadingModels(false);
        };
        
        const handleProvidersStatus = (data) => {
            if (!data.error) {
                setProviderStatus(data);
            }
        };

        socket.on('settings:response', handleSettingsResponse);
        socket.on('settings:saved', handleSettingsSaved);
        socket.on('models:response', handleModelsResponse);
        socket.on('providers:status', handleProvidersStatus);

        return () => {
            socket.off('settings:response', handleSettingsResponse);
            socket.off('settings:saved', handleSettingsSaved);
            socket.off('models:response', handleModelsResponse);
            socket.off('providers:status', handleProvidersStatus);
        };
    }, [socket]);

    const handleInputChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = () => {
        if (!socket) return;
        
        setIsSaving(true);
        setMessage({ type: '', text: '' });
        socket.emit('settings:save', settings);
    };

    const toggleKeyVisibility = (keyName) => {
        setShowApiKeys(prev => ({
            ...prev,
            [keyName]: !prev[keyName]
        }));
    };
    
    const fetchModelsForProvider = (provider) => {
        if (!socket) return;
        setLoadingModels(true);
        socket.emit('models:fetch', { provider });
    };

    const llmProviders = {
        openai: {
            name: 'OpenAI',
            keyField: 'openaiApiKey'
        },
        anthropic: {
            name: 'Anthropic (Claude)',
            keyField: 'anthropicApiKey'
        },
        gemini: {
            name: 'Google Gemini',
            keyField: 'geminiApiKey'
        }
    };

    const getCurrentProvider = () => llmProviders[settings.llmProvider] || llmProviders.openai;
    
    const getKnowledgeProviderLabel = (provider) => {
        const labels = {
            tavily: 'Tavily',
            exa: 'Exa.ai',
            perplexity: 'Perplexity',
            serpapi: 'SerpAPI',
            brave: 'Brave',
        };
        return labels[provider] || 'Knowledge Provider';
    };
    
    const getKnowledgeProviderKeyField = (provider) => {
        const fields = {
            tavily: 'tavilyApiKey',
            exa: 'exaApiKey',
            perplexity: 'perplexityApiKey',
            serpapi: 'serpapiKey',
            brave: 'braveApiKey',
        };
        return fields[provider] || 'tavilyApiKey';
    };
    
    const getTranscriptionProviderLabel = (provider) => {
        const labels = {
            deepgram: 'Deepgram',
            assemblyai: 'AssemblyAI',
            whisper: 'OpenAI Whisper',
            google: 'Google Speech',
            azure: 'Azure Speech',
            revai: 'Rev.ai',
            speechmatics: 'Speechmatics'
        };
        return labels[provider] || 'Transcription Provider';
    };
    
    const getTranscriptionProviderKeyField = (provider) => {
        const fields = {
            deepgram: 'deepgramApiKey',
            assemblyai: 'assemblyaiApiKey',
            whisper: 'openaiApiKey', // Uses same key as OpenAI LLM
            google: 'googleSpeechApiKey',
            azure: 'azureSpeechKey',
            revai: 'revaiApiKey',
            speechmatics: 'speechmaticsApiKey'
        };
        return fields[provider] || 'deepgramApiKey';
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Style for disabled options */}
            <style>{`
                select option:disabled {
                    color: #9ca3af;
                    background-color: #f3f4f6;
                    font-style: italic;
                }
                select:has(option:disabled:checked) {
                    color: #6b7280;
                    background-color: #fef3c7;
                    border-color: #f59e0b;
                }
            `}</style>
            
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}>
            <div style={{
                background: 'white',
                borderRadius: '12px',
                width: '700px',
                maxWidth: '90vw',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                }}>
                    <div>
                        <h2 style={{ 
                            margin: 0, 
                            fontSize: '20px', 
                            fontWeight: '600',
                            color: '#111827'
                        }}>
                            ⚙️ TranscriptIQ Settings
                        </h2>
                        <p style={{
                            margin: '4px 0 0 0',
                            fontSize: '14px',
                            color: '#6b7280'
                        }}>
                            Configure your AI providers and application preferences
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            padding: '4px',
                            color: '#9ca3af',
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = '#f3f4f6';
                            e.target.style.color = '#6b7280';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'none';
                            e.target.style.color = '#9ca3af';
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Tab Navigation */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid #e5e7eb',
                    background: '#f9fafb'
                }}>
                    <button
                        onClick={() => setActiveTab('api')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: activeTab === 'api' ? 'white' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'api' ? '2px solid #3b82f6' : 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: activeTab === 'api' ? '600' : '500',
                            color: activeTab === 'api' ? '#1e40af' : '#6b7280',
                            transition: 'all 0.2s'
                        }}
                    >
                        API Keys
                    </button>
                    <button
                        onClick={() => setActiveTab('prompts')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: activeTab === 'prompts' ? 'white' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'prompts' ? '2px solid #3b82f6' : 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: activeTab === 'prompts' ? '600' : '500',
                            color: activeTab === 'prompts' ? '#1e40af' : '#6b7280',
                            transition: 'all 0.2s'
                        }}
                    >
                        AI Prompts
                    </button>
                    <button
                        onClick={() => setActiveTab('corrections')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: activeTab === 'corrections' ? 'white' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'corrections' ? '2px solid #3b82f6' : 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: activeTab === 'corrections' ? '600' : '500',
                            color: activeTab === 'corrections' ? '#1e40af' : '#6b7280',
                            transition: 'all 0.2s'
                        }}
                    >
                        Corrections
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: activeTab === 'config' ? 'white' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'config' ? '2px solid #3b82f6' : 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: activeTab === 'config' ? '600' : '500',
                            color: activeTab === 'config' ? '#1e40af' : '#6b7280',
                            transition: 'all 0.2s'
                        }}
                    >
                        Configuration
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px'
                }}>
                    {/* Status Message */}
                    {message.text && (
                        <div style={{
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                            color: message.type === 'success' ? '#166534' : '#991b1b',
                            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                            fontSize: '14px'
                        }}>
                            {message.text}
                        </div>
                    )}

                    {/* API Keys Tab */}
                    {activeTab === 'api' && (
                    <>
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{ 
                            margin: '0 0 16px 0', 
                            fontSize: '16px', 
                            fontWeight: '600',
                            color: '#111827'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Key className="h-4 w-4" />
                                API Keys & LLM Configuration
                            </div>
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Transcription Provider Selection */}
                            <div style={{ 
                                padding: '16px',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                            }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '12px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#1e40af'
                                }}>
                                    🎙️ Speech Transcription Provider
                                </label>
                                
                                {/* Provider Selection */}
                                <div style={{ marginBottom: '12px' }}>
                                    <select
                                        value={settings.transcriptionProvider || 'deepgram'}
                                        onChange={(e) => handleInputChange('transcriptionProvider', e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            background: 'white',
                                            cursor: 'pointer',
                                            outline: 'none'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    >
                                        <option value="deepgram" disabled={!providerStatus.transcription?.deepgram}>
                                            Deepgram (Real-time, Low Latency) {!providerStatus.transcription?.deepgram && '(No API Key)'}
                                        </option>
                                        <option value="assemblyai" disabled={!providerStatus.transcription?.assemblyai}>
                                            AssemblyAI (High Accuracy + Insights) {!providerStatus.transcription?.assemblyai && '(No API Key)'}
                                        </option>
                                        <option value="whisper" disabled={!providerStatus.transcription?.whisper}>
                                            OpenAI Whisper (Best Accuracy) {!providerStatus.transcription?.whisper && '(No API Key)'}
                                        </option>
                                        <option value="google" disabled={!providerStatus.transcription?.google}>
                                            Google Speech-to-Text {!providerStatus.transcription?.google && '(No API Key)'}
                                        </option>
                                        <option value="azure" disabled={!providerStatus.transcription?.azure}>
                                            Azure Speech Services {!providerStatus.transcription?.azure && '(No API Key)'}
                                        </option>
                                        <option value="revai" disabled={!providerStatus.transcription?.revai}>
                                            Rev.ai (Professional Grade) {!providerStatus.transcription?.revai && '(No API Key)'}
                                        </option>
                                        <option value="speechmatics" disabled={!providerStatus.transcription?.speechmatics}>
                                            Speechmatics (48 Languages) {!providerStatus.transcription?.speechmatics && '(No API Key)'}
                                        </option>
                                    </select>
                                </div>

                                {/* API Key for selected transcription provider */}
                                <div>
                                    <label style={{ 
                                        display: 'block', 
                                        marginBottom: '6px',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        color: '#4b5563'
                                    }}>
                                        {getTranscriptionProviderLabel(settings.transcriptionProvider || 'deepgram')} API Key
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showApiKeys[settings.transcriptionProvider || 'deepgram'] ? 'text' : 'password'}
                                            value={settings[getTranscriptionProviderKeyField(settings.transcriptionProvider || 'deepgram')]}
                                            onChange={(e) => handleInputChange(getTranscriptionProviderKeyField(settings.transcriptionProvider || 'deepgram'), e.target.value)}
                                            placeholder={`Enter your ${getTranscriptionProviderLabel(settings.transcriptionProvider || 'deepgram')} API key`}
                                            style={{
                                                width: '100%',
                                                padding: '8px 40px 8px 12px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontFamily: showApiKeys[settings.transcriptionProvider || 'deepgram'] ? 'monospace' : 'inherit',
                                                transition: 'border-color 0.2s',
                                                outline: 'none'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleKeyVisibility(settings.transcriptionProvider || 'deepgram')}
                                            style={{
                                                position: 'absolute',
                                                right: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                color: '#6b7280',
                                                fontSize: '18px'
                                            }}
                                            title={showApiKeys[settings.transcriptionProvider || 'deepgram'] ? 'Hide API key' : 'Show API key'}
                                        >
                                            {showApiKeys[settings.transcriptionProvider || 'deepgram'] ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Warning if selected transcription provider has no API key */}
                                {settings.transcriptionProvider && !providerStatus.transcription?.[settings.transcriptionProvider] && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        background: '#fef3c7',
                                        border: '1px solid #f59e0b',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        color: '#92400e'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertTriangle className="h-4 w-4" />
                                            The selected transcription provider is not configured. Please add a valid API key or select a different provider.
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* LLM Provider Selection */}
                            <div style={{ 
                                padding: '16px',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                            }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '12px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#1e40af'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Brain className="h-4 w-4" />
                                        Large Language Model Provider
                                    </div>
                                </label>
                                
                                {/* Provider Selection */}
                                <div style={{ marginBottom: '12px' }}>
                                    <select
                                        value={settings.llmProvider}
                                        onChange={(e) => {
                                            const newProvider = e.target.value;
                                            handleInputChange('llmProvider', newProvider);
                                            
                                            // Fetch models if not already loaded
                                            if (availableModels[newProvider].length === 0) {
                                                fetchModelsForProvider(newProvider);
                                            }
                                            
                                            // Reset model to first option when changing provider
                                            const models = availableModels[newProvider];
                                            if (models && models.length > 0) {
                                                handleInputChange('llmModel', models[0].value);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            background: 'white',
                                            cursor: 'pointer',
                                            outline: 'none'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    >
                                        {Object.entries(llmProviders).map(([key, provider]) => (
                                            <option 
                                                key={key} 
                                                value={key}
                                                disabled={!providerStatus.llm[key]}
                                            >
                                                {provider.name} {!providerStatus.llm[key] && '(No API Key)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Model Selection */}
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        marginBottom: '6px'
                                    }}>
                                        <label style={{ 
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            color: '#4b5563'
                                        }}>
                                            Model
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => fetchModelsForProvider(settings.llmProvider)}
                                            disabled={loadingModels}
                                            style={{
                                                padding: '2px 8px',
                                                fontSize: '12px',
                                                background: 'none',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                cursor: loadingModels ? 'not-allowed' : 'pointer',
                                                color: '#6b7280',
                                                opacity: loadingModels ? 0.5 : 1
                                            }}
                                            title="Refresh available models"
                                        >
                                            {loadingModels ? '...' : '↻'}
                                        </button>
                                    </div>
                                    <select
                                        value={settings.llmModel}
                                        onChange={(e) => handleInputChange('llmModel', e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            background: 'white',
                                            cursor: 'pointer',
                                            outline: 'none'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    >
                                        {loadingModels && availableModels[settings.llmProvider].length === 0 ? (
                                            <option disabled>Loading models...</option>
                                        ) : availableModels[settings.llmProvider].length > 0 ? (
                                            availableModels[settings.llmProvider].map((model) => (
                                                <option key={model.value} value={model.value}>
                                                    {model.label}
                                                </option>
                                            ))
                                        ) : (
                                            <option disabled>No models available</option>
                                        )}
                                    </select>
                                </div>

                                {/* API Key for selected provider */}
                                <div>
                                    <label style={{ 
                                        display: 'block', 
                                        marginBottom: '6px',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        color: '#4b5563'
                                    }}>
                                        {getCurrentProvider().name} API Key
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showApiKeys[settings.llmProvider] ? 'text' : 'password'}
                                            value={settings[getCurrentProvider().keyField]}
                                            onChange={(e) => handleInputChange(getCurrentProvider().keyField, e.target.value)}
                                            placeholder={`Enter your ${getCurrentProvider().name} API key`}
                                            style={{
                                                width: '100%',
                                                padding: '8px 40px 8px 12px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontFamily: showApiKeys[settings.llmProvider] ? 'monospace' : 'inherit',
                                                transition: 'border-color 0.2s',
                                                outline: 'none'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleKeyVisibility(settings.llmProvider)}
                                            style={{
                                                position: 'absolute',
                                                right: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                color: '#6b7280',
                                                fontSize: '18px'
                                            }}
                                            title={showApiKeys[settings.llmProvider] ? 'Hide API key' : 'Show API key'}
                                        >
                                            {showApiKeys[settings.llmProvider] ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Warning if selected LLM provider has no API key */}
                                {settings.llmProvider && !providerStatus.llm?.[settings.llmProvider] && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        background: '#fef3c7',
                                        border: '1px solid #f59e0b',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        color: '#92400e'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertTriangle className="h-4 w-4" />
                                            The selected LLM provider is not configured. Please add a valid API key or select a different provider.
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Knowledge Provider Selection */}
                            <div style={{ 
                                padding: '16px',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                            }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '12px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#1e40af'
                                }}>
                                    🔍 Knowledge & Search Provider
                                </label>
                                
                                {/* Provider Selection */}
                                <div style={{ marginBottom: '12px' }}>
                                    <select
                                        value={settings.knowledgeProvider}
                                        onChange={(e) => handleInputChange('knowledgeProvider', e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            background: 'white',
                                            cursor: 'pointer',
                                            outline: 'none'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    >
                                        <option value="tavily" disabled={!providerStatus.knowledge?.tavily}>
                                            Tavily (AI-Optimized Search) {!providerStatus.knowledge?.tavily && '(No API Key)'}
                                        </option>
                                        <option value="exa" disabled={!providerStatus.knowledge?.exa}>
                                            Exa.ai (Neural Search) {!providerStatus.knowledge?.exa && '(No API Key)'}
                                        </option>
                                        <option value="perplexity" disabled={!providerStatus.knowledge?.perplexity}>
                                            Perplexity (AI Answer Engine) {!providerStatus.knowledge?.perplexity && '(No API Key)'}
                                        </option>
                                        <option value="serpapi" disabled={!providerStatus.knowledge?.serpapi}>
                                            Google Search (via SerpAPI) {!providerStatus.knowledge?.serpapi && '(No API Key)'}
                                        </option>
                                        <option value="brave" disabled={!providerStatus.knowledge?.brave}>
                                            Brave Search (Privacy-Focused) {!providerStatus.knowledge?.brave && '(No API Key)'}
                                        </option>
                                    </select>
                                </div>

                                {/* API Key for selected knowledge provider */}
                                <div>
                                    <label style={{ 
                                        display: 'block', 
                                        marginBottom: '6px',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        color: '#4b5563'
                                    }}>
                                        {getKnowledgeProviderLabel(settings.knowledgeProvider)} API Key
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showApiKeys[settings.knowledgeProvider] ? 'text' : 'password'}
                                            value={settings[getKnowledgeProviderKeyField(settings.knowledgeProvider)]}
                                            onChange={(e) => handleInputChange(getKnowledgeProviderKeyField(settings.knowledgeProvider), e.target.value)}
                                            placeholder={`Enter your ${getKnowledgeProviderLabel(settings.knowledgeProvider)} API key`}
                                            style={{
                                                width: '100%',
                                                padding: '8px 40px 8px 12px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontFamily: showApiKeys[settings.knowledgeProvider] ? 'monospace' : 'inherit',
                                                transition: 'border-color 0.2s',
                                                outline: 'none'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleKeyVisibility(settings.knowledgeProvider)}
                                            style={{
                                                position: 'absolute',
                                                right: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                color: '#6b7280',
                                                fontSize: '18px'
                                            }}
                                            title={showApiKeys[settings.knowledgeProvider] ? 'Hide API key' : 'Show API key'}
                                        >
                                            {showApiKeys[settings.knowledgeProvider] ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Warning if selected knowledge provider has no API key */}
                                {settings.knowledgeProvider && !providerStatus.knowledge?.[settings.knowledgeProvider] && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        background: '#fef3c7',
                                        border: '1px solid #f59e0b',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        color: '#92400e'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertTriangle className="h-4 w-4" />
                                            The selected knowledge provider is not configured. Please add a valid API key or select a different provider.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{ 
                            margin: '0 0 16px 0', 
                            fontSize: '16px', 
                            fontWeight: '600',
                            color: '#111827'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Brain className="h-4 w-4" />
                                AI Intelligence
                            </div>
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '12px',
                                background: '#f9fafb',
                                borderRadius: '6px'
                            }}>
                                <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                                    Enable Contextual Intelligence
                                </label>
                                <input
                                    type="checkbox"
                                    checked={settings.enableContextualIntelligence}
                                    onChange={(e) => handleInputChange('enableContextualIntelligence', e.target.checked)}
                                    style={{ 
                                        width: '20px', 
                                        height: '20px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>

                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '12px',
                                background: '#f9fafb',
                                borderRadius: '6px'
                            }}>
                                <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                                    Enable Knowledge Retrieval
                                </label>
                                <input
                                    type="checkbox"
                                    checked={settings.enableKnowledgeRetrieval}
                                    onChange={(e) => handleInputChange('enableKnowledgeRetrieval', e.target.checked)}
                                    style={{ 
                                        width: '20px', 
                                        height: '20px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>

                            <div style={{
                                padding: '12px',
                                background: '#f9fafb',
                                borderRadius: '6px'
                            }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#374151'
                                }}>
                                    Max Context Length (tokens)
                                </label>
                                <input
                                    type="number"
                                    value={settings.maxContextLength}
                                    onChange={(e) => handleInputChange('maxContextLength', parseInt(e.target.value))}
                                    min="1000"
                                    max="16000"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        background: 'white',
                                        outline: 'none'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Performance Settings */}
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{ 
                            margin: '0 0 16px 0', 
                            fontSize: '16px', 
                            fontWeight: '600',
                            color: '#111827'
                        }}>
                            ⚡ Performance
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{
                                padding: '12px',
                                background: '#f9fafb',
                                borderRadius: '6px'
                            }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#374151'
                                }}>
                                    Transcription Confidence Threshold
                                </label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="1.0"
                                    step="0.05"
                                    value={settings.transcriptionConfidenceThreshold}
                                    onChange={(e) => handleInputChange('transcriptionConfidenceThreshold', parseFloat(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                    Current: {(settings.transcriptionConfidenceThreshold * 100).toFixed(0)}%
                                </div>
                            </div>

                            <div style={{
                                padding: '12px',
                                background: '#f9fafb',
                                borderRadius: '6px'
                            }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#374151'
                                }}>
                                    Auto-save Interval (seconds)
                                </label>
                                <input
                                    type="number"
                                    value={settings.autoSaveInterval}
                                    onChange={(e) => handleInputChange('autoSaveInterval', parseInt(e.target.value))}
                                    min="10"
                                    max="300"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        background: 'white',
                                        outline: 'none'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                />
                            </div>

                            <div style={{
                                padding: '12px',
                                background: '#f9fafb',
                                borderRadius: '6px'
                            }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#374151'
                                }}>
                                    Cache Expiry (hours)
                                </label>
                                <input
                                    type="number"
                                    value={settings.cacheExpiryHours}
                                    onChange={(e) => handleInputChange('cacheExpiryHours', parseInt(e.target.value))}
                                    min="1"
                                    max="168"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        background: 'white',
                                        outline: 'none'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                />
                            </div>
                        </div>
                    </div>
                    </>
                    )}

                    {/* AI Prompts Tab */}
                    {activeTab === 'prompts' && (
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            marginBottom: '16px',
                            color: '#111827'
                        }}>
                            AI Prompts Customization
                        </h3>
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151'
                            }}>
                                Talking Points Generation Prompt
                            </label>
                            <p style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                marginBottom: '8px'
                            }}>
                                Customize the prompt used to generate talking points. Use {'{topic}'} for the user's topic, {'{context}'} for meeting context, and {'{glossary}'} for terms.
                            </p>
                            <textarea
                                value={settings.talkingPointsPrompt}
                                onChange={(e) => handleInputChange('talkingPointsPrompt', e.target.value)}
                                rows="8"
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontFamily: 'monospace',
                                    background: 'white',
                                    outline: 'none',
                                    resize: 'vertical'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                            />
                            <button
                                onClick={() => {
                                    const defaultPrompt = `Based on this meeting context, generate 3-5 intelligent talking points or questions about "{topic}".

CONTEXT:
{context}

MEETING GLOSSARY:
{glossary}

Generate talking points that show understanding and move the conversation forward.`;
                                    handleInputChange('talkingPointsPrompt', defaultPrompt);
                                    setMessage({ type: 'info', text: 'Restored default talking points prompt' });
                                }}
                                style={{
                                    marginTop: '8px',
                                    padding: '6px 12px',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                Restore Default
                            </button>
                        </div>
                    </div>
                    )}

                    {/* Corrections Tab */}
                    {activeTab === 'corrections' && (
                    <div style={{ marginBottom: '32px' }}>
                        <GlobalCorrections socket={socket} />
                    </div>
                    )}

                    {/* Configuration Tab */}
                    {activeTab === 'config' && (
                    <div>
                        <h3 style={{ 
                            margin: '0 0 16px 0', 
                            fontSize: '16px', 
                            fontWeight: '600',
                            color: '#111827'
                        }}>
                            🔔 Notifications
                        </h3>
                        
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '12px',
                            background: '#f9fafb',
                            borderRadius: '6px'
                        }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                                Enable System Notifications
                            </label>
                            <input
                                type="checkbox"
                                checked={settings.enableNotifications}
                                onChange={(e) => handleInputChange('enableNotifications', e.target.checked)}
                                style={{ 
                                    width: '20px', 
                                    height: '20px',
                                    cursor: 'pointer'
                                }}
                            />
                        </div>
                    </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <p style={{ 
                        margin: 0,
                        fontSize: '12px', 
                        color: '#6b7280' 
                    }}>
                        Changes are saved to local storage and synchronized with backend
                    </p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '8px 16px',
                                background: 'white',
                                color: '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = '#f9fafb';
                                e.target.style.borderColor = '#9ca3af';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'white';
                                e.target.style.borderColor = '#d1d5db';
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                                padding: '8px 16px',
                                background: isSaving ? '#93c5fd' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                opacity: isSaving ? 0.7 : 1,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (!isSaving) {
                                    e.target.style.background = '#2563eb';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isSaving) {
                                    e.target.style.background = '#3b82f6';
                                }
                            }}
                        >
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}

export default Settings;