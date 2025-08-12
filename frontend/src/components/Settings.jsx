import React, { useState, useEffect } from 'react';

function Settings({ isOpen, onClose, socket }) {
    const [settings, setSettings] = useState({
        deepgramApiKey: '',
        openaiApiKey: '',
        anthropicApiKey: '',
        geminiApiKey: '',
        tavilyApiKey: '',
        llmProvider: 'openai', // 'openai', 'anthropic', 'gemini'
        llmModel: 'gpt-4o-mini', // Model name within the selected provider
        maxContextLength: 8000,
        enableNotifications: true,
        autoSaveInterval: 30,
        transcriptionConfidenceThreshold: 0.8,
        enableContextualIntelligence: true,
        enableKnowledgeRetrieval: true,
        cacheExpiryHours: 24
    });
    
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showApiKeys, setShowApiKeys] = useState(false);

    useEffect(() => {
        if (isOpen && socket) {
            // Load current settings when modal opens
            socket.emit('settings:get');
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
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
            }
        };

        socket.on('settings:response', handleSettingsResponse);
        socket.on('settings:saved', handleSettingsSaved);

        return () => {
            socket.off('settings:response', handleSettingsResponse);
            socket.off('settings:saved', handleSettingsSaved);
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

    const maskApiKey = (key) => {
        if (!key) return '';
        if (key.length <= 8) return key;
        return key.substring(0, 4) + '•'.repeat(key.length - 8) + key.substring(key.length - 4);
    };

    const llmProviders = {
        openai: {
            name: 'OpenAI',
            models: [
                { value: 'gpt-4o', label: 'GPT-4o (Latest)' },
                { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Cost-effective)' },
                { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
                { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
            ],
            keyField: 'openaiApiKey'
        },
        anthropic: {
            name: 'Anthropic (Claude)',
            models: [
                { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)' },
                { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
                { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Most Capable)' },
                { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' }
            ],
            keyField: 'anthropicApiKey'
        },
        gemini: {
            name: 'Google Gemini',
            models: [
                { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
                { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast)' },
                { value: 'gemini-pro', label: 'Gemini Pro' }
            ],
            keyField: 'geminiApiKey'
        }
    };

    const getCurrentProvider = () => llmProviders[settings.llmProvider] || llmProviders.openai;

    if (!isOpen) return null;

    return (
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
                borderRadius: '8px',
                width: '600px',
                maxWidth: '90vw',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                        ⚙️ TranscriptIQ Settings
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '18px',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            color: '#6c757d'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px'
                }}>
                    {/* Status Message */}
                    {message.text && (
                        <div style={{
                            padding: '10px',
                            borderRadius: '4px',
                            marginBottom: '20px',
                            background: message.type === 'success' ? '#d4edda' : '#f8d7da',
                            color: message.type === 'success' ? '#155724' : '#721c24',
                            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
                        }}>
                            {message.text}
                        </div>
                    )}

                    {/* API Keys Section */}
                    <div style={{ marginBottom: '30px' }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '15px'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                                🔑 API Keys & LLM Configuration
                            </h3>
                            <button
                                onClick={() => setShowApiKeys(!showApiKeys)}
                                style={{
                                    padding: '4px 8px',
                                    background: '#f8f9fa',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                {showApiKeys ? '👁️ Hide' : '🔒 Show'}
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Deepgram API Key */}
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '5px',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}>
                                    Deepgram API Key (Transcription)
                                </label>
                                <input
                                    type={showApiKeys ? 'text' : 'password'}
                                    value={showApiKeys ? settings.deepgramApiKey : maskApiKey(settings.deepgramApiKey)}
                                    onChange={(e) => handleInputChange('deepgramApiKey', e.target.value)}
                                    placeholder="Enter your Deepgram API key"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontFamily: showApiKeys ? 'monospace' : 'inherit'
                                    }}
                                />
                            </div>

                            {/* LLM Provider Selection */}
                            <div style={{ 
                                padding: '15px',
                                background: '#f8f9fa',
                                borderRadius: '6px',
                                border: '1px solid #dee2e6'
                            }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '10px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#495057'
                                }}>
                                    🧠 Large Language Model Provider
                                </label>
                                
                                {/* Provider Selection */}
                                <div style={{ marginBottom: '15px' }}>
                                    <select
                                        value={settings.llmProvider}
                                        onChange={(e) => {
                                            handleInputChange('llmProvider', e.target.value);
                                            // Reset model to first option when changing provider
                                            const newProvider = llmProviders[e.target.value];
                                            if (newProvider && newProvider.models.length > 0) {
                                                handleInputChange('llmModel', newProvider.models[0].value);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #dee2e6',
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            background: 'white'
                                        }}
                                    >
                                        {Object.entries(llmProviders).map(([key, provider]) => (
                                            <option key={key} value={key}>
                                                {provider.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Model Selection */}
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ 
                                        display: 'block', 
                                        marginBottom: '5px',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                    }}>
                                        Model
                                    </label>
                                    <select
                                        value={settings.llmModel}
                                        onChange={(e) => handleInputChange('llmModel', e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #dee2e6',
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            background: 'white'
                                        }}
                                    >
                                        {getCurrentProvider().models.map((model) => (
                                            <option key={model.value} value={model.value}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* API Key for selected provider */}
                                <div>
                                    <label style={{ 
                                        display: 'block', 
                                        marginBottom: '5px',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                    }}>
                                        {getCurrentProvider().name} API Key
                                    </label>
                                    <input
                                        type={showApiKeys ? 'text' : 'password'}
                                        value={showApiKeys ? settings[getCurrentProvider().keyField] : maskApiKey(settings[getCurrentProvider().keyField])}
                                        onChange={(e) => handleInputChange(getCurrentProvider().keyField, e.target.value)}
                                        placeholder={`Enter your ${getCurrentProvider().name} API key`}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #dee2e6',
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            fontFamily: showApiKeys ? 'monospace' : 'inherit'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Tavily API Key */}
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '5px',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}>
                                    Tavily API Key (Knowledge Retrieval)
                                </label>
                                <input
                                    type={showApiKeys ? 'text' : 'password'}
                                    value={showApiKeys ? settings.tavilyApiKey : maskApiKey(settings.tavilyApiKey)}
                                    onChange={(e) => handleInputChange('tavilyApiKey', e.target.value)}
                                    placeholder="Enter your Tavily API key"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontFamily: showApiKeys ? 'monospace' : 'inherit'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Intelligence Settings */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600' }}>
                            🧠 AI Intelligence
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ fontSize: '14px', fontWeight: '500' }}>
                                    Enable Contextual Intelligence
                                </label>
                                <input
                                    type="checkbox"
                                    checked={settings.enableContextualIntelligence}
                                    onChange={(e) => handleInputChange('enableContextualIntelligence', e.target.checked)}
                                    style={{ transform: 'scale(1.2)' }}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ fontSize: '14px', fontWeight: '500' }}>
                                    Enable Knowledge Retrieval
                                </label>
                                <input
                                    type="checkbox"
                                    checked={settings.enableKnowledgeRetrieval}
                                    onChange={(e) => handleInputChange('enableKnowledgeRetrieval', e.target.checked)}
                                    style={{ transform: 'scale(1.2)' }}
                                />
                            </div>

                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '5px',
                                    fontSize: '14px',
                                    fontWeight: '500'
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
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Performance Settings */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600' }}>
                            ⚡ Performance
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '5px',
                                    fontSize: '14px',
                                    fontWeight: '500'
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
                                <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                                    Current: {(settings.transcriptionConfidenceThreshold * 100).toFixed(0)}%
                                </div>
                            </div>

                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '5px',
                                    fontSize: '14px',
                                    fontWeight: '500'
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
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '5px',
                                    fontSize: '14px',
                                    fontWeight: '500'
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
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600' }}>
                            🔔 Notifications
                        </h3>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500' }}>
                                Enable System Notifications
                            </label>
                            <input
                                type="checkbox"
                                checked={settings.enableNotifications}
                                onChange={(e) => handleInputChange('enableNotifications', e.target.checked)}
                                style={{ transform: 'scale(1.2)' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px',
                    borderTop: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>
                        Changes are saved to local storage and synchronized with backend
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={onClose}
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
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                                padding: '8px 16px',
                                background: isSaving ? '#6c757d' : '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isSaving ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;