import React, { useState, useCallback } from 'react';
import CorrectionModal from './CorrectionModal';
import useCorrections from '../hooks/useCorrections';

const CorrectableTranscript = ({ transcript, socket, className = "" }) => {
    const [selectedText, setSelectedText] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    const { addCorrection, getSuggestions, findCorrection, loading } = useCorrections(socket);

    const handleWordClick = useCallback(async (word, event) => {
        event.preventDefault();
        event.stopPropagation();

        // Clean the word (remove punctuation)
        const cleanWord = word.replace(/[.,!?;:"'\(\)\[\]]/g, '');
        
        if (!cleanWord.trim() || cleanWord.length < 2) {
            return;
        }

        setSelectedText(cleanWord);
        setIsModalOpen(true);
        
        // Get suggestions for this word
        setLoadingSuggestions(true);
        try {
            const wordSuggestions = await getSuggestions(cleanWord);
            setSuggestions(wordSuggestions);
        } catch (error) {
            console.error('Error getting suggestions:', error);
            setSuggestions([]);
        } finally {
            setLoadingSuggestions(false);
        }
    }, [getSuggestions]);

    const handleCorrection = useCallback(async (original, corrected, options) => {
        const success = await addCorrection(original, corrected, options);
        if (success) {
            console.log(`Added correction: "${original}" → "${corrected}"`);
        }
        return success;
    }, [addCorrection]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedText('');
        setSuggestions([]);
    }, []);

    const renderTranscriptItem = useCallback((item, index) => {
        if (!item.text) return null;

        // Split text into words for individual correction
        const words = item.text.split(/(\s+)/);
        
        return (
            <div key={index} className={`mb-2 ${item.isFinal ? 'text-gray-900' : 'text-gray-500 italic'}`}>
                <div className="flex items-start space-x-2">
                    <span className="text-xs text-gray-400 mt-1">
                        {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex-1">
                        {words.map((word, wordIndex) => {
                            // Don't make whitespace clickable
                            if (/^\s+$/.test(word)) {
                                return <span key={wordIndex}>{word}</span>;
                            }

                            const cleanWord = word.replace(/[.,!?;:"'\(\)\[\]]/g, '');
                            const existingCorrection = findCorrection(cleanWord);

                            return (
                                <span
                                    key={wordIndex}
                                    className={`
                                        cursor-pointer hover:bg-blue-100 rounded px-1 transition-colors
                                        ${existingCorrection ? 'border-b border-dotted border-green-500 bg-green-50' : ''}
                                    `}
                                    onClick={(e) => handleWordClick(word, e)}
                                    title={existingCorrection ? 
                                        `Corrected from: "${existingCorrection.original_term}"` : 
                                        'Click to correct this word'
                                    }
                                >
                                    {word}
                                </span>
                            );
                        })}
                        
                        {/* Show corrections applied indicator */}
                        {item.corrections && item.corrections.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                                {item.corrections.map((correction, corrIndex) => (
                                    <span 
                                        key={corrIndex}
                                        className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full"
                                        title={`Auto-corrected: "${correction.original}" → "${correction.corrected}"`}
                                    >
                                        ✓ {correction.original} → {correction.corrected}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Show metrics */}
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                            {item.confidence && (
                                <span>
                                    Confidence: {Math.round(item.confidence * 100)}%
                                </span>
                            )}
                            {item.latency && (
                                <span>
                                    Latency: {item.latency}ms
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [handleWordClick, findCorrection]);

    return (
        <>
            <div className={`space-y-2 ${className}`}>
                {transcript.map(renderTranscriptItem)}
            </div>

            <CorrectionModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                selectedText={selectedText}
                onCorrect={handleCorrection}
                suggestions={suggestions}
                loading={loading || loadingSuggestions}
            />
        </>
    );
};

export default CorrectableTranscript;