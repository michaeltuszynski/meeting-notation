import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const CorrectionModal = ({ 
    isOpen, 
    onClose, 
    selectedText, 
    onCorrect, 
    suggestions = [],
    loading = false 
}) => {
    const [correctedText, setCorrectedText] = useState('');
    const [category, setCategory] = useState('general');
    const [autoApply, setAutoApply] = useState(true);

    useEffect(() => {
        if (isOpen && selectedText) {
            setCorrectedText(selectedText);
        }
    }, [isOpen, selectedText]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!correctedText.trim() || correctedText === selectedText) {
            return;
        }

        const success = await onCorrect(selectedText, correctedText.trim(), {
            category,
            autoApply,
            caseSensitive: false,
            wholeWordOnly: true
        });

        if (success) {
            onClose();
            setCorrectedText('');
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setCorrectedText(suggestion.corrected);
        setCategory(suggestion.category || 'general');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Correct Transcription</DialogTitle>
                    <p className="text-sm text-gray-600">
                        This correction will apply globally to all future meetings.
                    </p>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Original Text
                        </label>
                        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-800">
                            "{selectedText}"
                        </div>
                    </div>

                    {suggestions.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Suggestions
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((suggestion, index) => (
                                    <Badge
                                        key={index}
                                        variant="outline"
                                        className="cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                                        onClick={() => handleSuggestionClick(suggestion)}
                                    >
                                        {suggestion.corrected}
                                        {suggestion.confidence && (
                                            <span className="ml-1 text-xs opacity-70">
                                                {Math.round(suggestion.confidence * 100)}%
                                            </span>
                                        )}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="correctedText" className="block text-sm font-medium text-gray-700 mb-1">
                            Corrected Text
                        </label>
                        <input
                            id="correctedText"
                            type="text"
                            value={correctedText}
                            onChange={(e) => setCorrectedText(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter the correct text..."
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                                Category
                            </label>
                            <select
                                id="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="general">General</option>
                                <option value="technical">Technical</option>
                                <option value="company">Company</option>
                                <option value="product">Product</option>
                                <option value="proper_noun">Proper Noun</option>
                                <option value="acronym">Acronym</option>
                            </select>
                        </div>

                        <div className="flex items-center">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={autoApply}
                                    onChange={(e) => setAutoApply(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Auto-apply</span>
                            </label>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-blue-800">
                                    This correction will be applied to all future transcriptions automatically.
                                    It will also improve knowledge retrieval for this term.
                                </p>
                            </div>
                        </div>
                    </div>
                </form>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit}
                        disabled={loading || !correctedText.trim() || correctedText === selectedText}
                    >
                        {loading ? 'Adding...' : 'Add Correction'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CorrectionModal;