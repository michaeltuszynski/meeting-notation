import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import useCorrections from '../hooks/useCorrections';

const GlobalCorrections = ({ socket }) => {
    const [newOriginal, setNewOriginal] = useState('');
    const [newCorrected, setNewCorrected] = useState('');
    const [newCategory, setNewCategory] = useState('general');
    const [stats, setStats] = useState(null);

    const { 
        corrections, 
        loading, 
        addCorrection, 
        removeCorrection 
    } = useCorrections(socket);

    // Fetch correction statistics
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('http://localhost:9000/api/corrections/stats');
                if (response.ok) {
                    const statsData = await response.json();
                    setStats(statsData);
                }
            } catch (error) {
                console.error('Error fetching correction stats:', error);
            }
        };

        if (socket) {
            fetchStats();
        }
    }, [socket, corrections]);

    const handleAddCorrection = async (e) => {
        e.preventDefault();
        
        if (!newOriginal.trim() || !newCorrected.trim()) {
            return;
        }

        const success = await addCorrection(newOriginal.trim(), newCorrected.trim(), {
            category: newCategory,
            autoApply: true
        });

        if (success) {
            setNewOriginal('');
            setNewCorrected('');
            setNewCategory('general');
        }
    };

    const handleRemoveCorrection = async (correctionId) => {
        await removeCorrection(correctionId);
    };

    const getCategoryColor = (category) => {
        const colors = {
            technical: 'bg-blue-100 text-blue-800',
            company: 'bg-purple-100 text-purple-800',
            product: 'bg-green-100 text-green-800',
            proper_noun: 'bg-yellow-100 text-yellow-800',
            acronym: 'bg-red-100 text-red-800',
            general: 'bg-gray-100 text-gray-800'
        };
        return colors[category] || colors.general;
    };

    return (
        <div className="space-y-6">
            {/* Header with Statistics */}
            <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Global Transcript Corrections
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                    Manage global corrections that automatically fix transcription errors across all meetings.
                </p>
                
                {stats && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="font-semibold text-blue-800">
                                {stats.total_corrections || 0}
                            </div>
                            <div className="text-blue-600">Total Corrections</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                            <div className="font-semibold text-green-800">
                                {stats.total_applications || 0}
                            </div>
                            <div className="text-green-600">Applications</div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg">
                            <div className="font-semibold text-purple-800">
                                {stats.categories_count || 0}
                            </div>
                            <div className="text-purple-600">Categories</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add New Correction Form */}
            <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-3">Add New Correction</h4>
                <form onSubmit={handleAddCorrection} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Original (Incorrect)
                            </label>
                            <input
                                type="text"
                                value={newOriginal}
                                onChange={(e) => setNewOriginal(e.target.value)}
                                placeholder="e.g., Sirena"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Corrected
                            </label>
                            <input
                                type="text"
                                value={newCorrected}
                                onChange={(e) => setNewCorrected(e.target.value)}
                                placeholder="e.g., Serena MCP"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category
                            </label>
                            <select
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
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
                        <div className="pt-6">
                            <Button 
                                type="submit" 
                                disabled={loading || !newOriginal.trim() || !newCorrected.trim()}
                                className="min-w-[80px]"
                            >
                                {loading ? 'Adding...' : 'Add'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Existing Corrections List */}
            <div>
                <h4 className="font-medium text-gray-900 mb-3">
                    Current Corrections ({corrections.length})
                </h4>
                
                {corrections.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No corrections yet. Add your first correction above or click on words in the transcript.
                    </div>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {corrections
                            .sort((a, b) => b.usage_count - a.usage_count)
                            .map((correction) => (
                                <div 
                                    key={correction.id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                                >
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-red-600 line-through text-sm">
                                                    {correction.original_term}
                                                </span>
                                                <span className="text-gray-400">→</span>
                                                <span className="text-green-600 font-medium">
                                                    {correction.corrected_term}
                                                </span>
                                                <Badge 
                                                    variant="secondary" 
                                                    className={`text-xs ${getCategoryColor(correction.category)}`}
                                                >
                                                    {correction.category}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Used {correction.usage_count} times
                                                {correction.last_used && (
                                                    <span className="ml-2">
                                                        • Last used: {new Date(correction.last_used).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRemoveCorrection(correction.id)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        disabled={loading}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* Top Corrections */}
            {stats && stats.topCorrections && stats.topCorrections.length > 0 && (
                <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Most Used Corrections</h4>
                    <div className="flex flex-wrap gap-2">
                        {stats.topCorrections.slice(0, 10).map((correction, index) => (
                            <Badge key={index} variant="outline" className="text-sm">
                                {correction.original_term} → {correction.corrected_term}
                                <span className="ml-1 text-xs text-gray-500">
                                    ({correction.usage_count}x)
                                </span>
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalCorrections;