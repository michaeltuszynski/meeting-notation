import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Brain, Lightbulb, Bot, BookOpen, FileText, Info } from 'lucide-react';
import ContextualInsights from './ContextualInsights';
import DefinitionHistory from './DefinitionHistory';
import CorrectableTranscript from './CorrectableTranscript';

function MeetingIntelligence({ 
    intelligenceView, 
    setIntelligenceView, 
    isRecording,
    recordingStartTime,
    useElectronBridge,
    metrics,
    activeMeeting,
    socket,
    extractedTerms,
    termDefinitions,
    transcript,
    transcriptEndRef,
    formatDuration,
    formatLatency
}) {
    return (
        <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full flex flex-col">
                {/* Recording Status Bar */}
                {isRecording && (
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200">
                        <div className="px-6 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                                        <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold text-red-700">
                                            Recording Active
                                        </span>
                                        <Badge variant="outline" className="text-xs bg-white">
                                            {useElectronBridge ? 'System Audio' : 'Microphone'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="text-gray-600">
                                        <span className="font-medium">Duration:</span> {formatDuration(Math.floor((Date.now() - (recordingStartTime || Date.now())) / 1000))}
                                    </div>
                                    {metrics && (
                                        <div className="text-gray-600">
                                            <span className="font-medium">Latency:</span> {formatLatency(Math.round(metrics.avgLatency))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Meeting Intelligence Panel */}
                <div className="flex-1 p-6 min-h-0">
                    <Card className="h-full flex flex-col shadow-lg overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-2xl flex items-center gap-3">
                                        <Brain className="h-7 w-7 text-blue-600" />
                                        <span>Meeting Intelligence</span>
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Real-time insights, proactive assistance, and terminology extraction
                                    </CardDescription>
                                </div>
                                {activeMeeting && (
                                    <div className="flex flex-col items-end gap-2">
                                        <Badge variant="success" className="text-sm px-3 py-1">
                                            {activeMeeting.title}
                                        </Badge>
                                        {!isRecording && (
                                            <span className="text-xs text-gray-500">
                                                Ready to record
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        
                        <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                            {/* Tab Navigation - Fixed at top */}
                            <div className="border-b bg-white sticky top-0 z-10">
                                <div className="flex">
                                    <button
                                        onClick={() => setIntelligenceView('insights')}
                                        className={`flex-1 px-6 py-4 text-sm font-medium transition-all border-b-2 ${
                                            intelligenceView === 'insights'
                                                ? 'border-blue-600 text-blue-600 bg-blue-50'
                                                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <Lightbulb className="h-5 w-5" />
                                            <span>Insights</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setIntelligenceView('assistant')}
                                        className={`flex-1 px-6 py-4 text-sm font-medium transition-all border-b-2 ${
                                            intelligenceView === 'assistant'
                                                ? 'border-blue-600 text-blue-600 bg-blue-50'
                                                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <Bot className="h-5 w-5" />
                                            <span>Assistant</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setIntelligenceView('glossary')}
                                        className={`flex-1 px-6 py-4 text-sm font-medium transition-all border-b-2 ${
                                            intelligenceView === 'glossary'
                                                ? 'border-blue-600 text-blue-600 bg-blue-50'
                                                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <BookOpen className="h-5 w-5" />
                                            <span>Glossary</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setIntelligenceView('transcript')}
                                        className={`flex-1 px-6 py-4 text-sm font-medium transition-all border-b-2 ${
                                            intelligenceView === 'transcript'
                                                ? 'border-blue-600 text-blue-600 bg-blue-50'
                                                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <FileText className="h-5 w-5" />
                                            <span>Transcript</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Tab Content - Scrollable area with proper constraints */}
                            <div className="flex-1 overflow-y-auto bg-gray-50 relative" style={{ minHeight: 0 }}>
                                {intelligenceView === 'insights' && (
                                    <div className="p-6">
                                        <div className="bg-white rounded-lg p-6 shadow-sm">
                                            <ContextualInsights 
                                                socket={socket}
                                                currentTopic={activeMeeting?.title}
                                                view="insights"
                                            />
                                        </div>
                                    </div>
                                )}
                                {intelligenceView === 'assistant' && (
                                    <div className="p-6">
                                        <div className="bg-white rounded-lg p-6 shadow-sm">
                                            <ContextualInsights 
                                                socket={socket}
                                                currentTopic={activeMeeting?.title}
                                                view="assistant"
                                            />
                                        </div>
                                    </div>
                                )}
                                {intelligenceView === 'glossary' && (
                                    <div className="p-6">
                                        <div className="bg-white rounded-lg p-6 shadow-sm">
                                            <h3 className="text-lg font-semibold mb-4">Meeting-Specific Terms</h3>
                                            {extractedTerms.length === 0 && termDefinitions.length === 0 ? (
                                                <div className="text-center py-8 text-gray-500">
                                                    <div className="text-4xl mb-3">📖</div>
                                                    <p className="text-sm">No terms defined yet in this meeting context.</p>
                                                    <p className="text-xs mt-2">Terms will appear here as they're mentioned 3+ times.</p>
                                                </div>
                                            ) : (
                                                <DefinitionHistory 
                                                    definitions={termDefinitions}
                                                    terms={extractedTerms}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                                {intelligenceView === 'transcript' && (
                                    <div className="p-6">
                                        <div className="bg-white rounded-lg p-6 shadow-sm">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold">Live Transcript</h3>
                                                {transcript.length > 0 && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {transcript.length} segments
                                                    </Badge>
                                                )}
                                            </div>
                                            {transcript.length === 0 ? (
                                                <div className="text-center py-12 text-gray-500">
                                                    <div className="text-4xl mb-3">🎙️</div>
                                                    <p className="text-sm">
                                                        {isRecording ? 'Listening... Speak to see transcript' : 'Start recording to see live transcript'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <CorrectableTranscript 
                                                        transcript={transcript} 
                                                        socket={socket}
                                                        className="space-y-2"
                                                    />
                                                    <div ref={transcriptEndRef} />
                                                </div>
                                            )}
                                            {transcript.length > 0 && (
                                                <div className="mt-6 pt-4 border-t text-xs text-gray-500 text-center">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Info className="h-4 w-4" />
                                                        Click on any word to correct it globally across all meetings
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default MeetingIntelligence;