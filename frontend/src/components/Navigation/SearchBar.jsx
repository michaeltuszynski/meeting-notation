import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, FileText, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const SearchBar = ({ 
  onSearch, 
  onSelectResult,
  placeholder = "Search meetings, transcripts, and terms...",
  className 
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('transcriptiq-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading recent searches:', e);
      }
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = (searchQuery) => {
    if (!searchQuery.trim()) return;
    
    const updated = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery)
    ].slice(0, 5); // Keep only 5 recent searches
    
    setRecentSearches(updated);
    localStorage.setItem('transcriptiq-recent-searches', JSON.stringify(updated));
  };

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const searchResults = await performSearch(query);
        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const performSearch = async (searchQuery) => {
    try {
      // Search meetings
      const meetingsResponse = await fetch(
        `http://localhost:9000/api/meetings?search=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const meetingsData = await meetingsResponse.json();

      // Format results
      const searchResults = [
        ...meetingsData.meetings.map(meeting => ({
          id: meeting.id,
          type: 'meeting',
          title: meeting.title,
          subtitle: `${new Date(meeting.start_time).toLocaleDateString()} • ${meeting.duration_seconds ? formatDuration(meeting.duration_seconds) : 'In progress'}`,
          metadata: {
            status: meeting.status,
            wordCount: meeting.word_count,
            termCount: meeting.term_count
          },
          onClick: () => handleResultClick('meeting', meeting)
        }))
      ];

      return searchResults;
    } catch (error) {
      console.error('Error performing search:', error);
      return [];
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleResultClick = (type, item) => {
    saveRecentSearch(query);
    setIsOpen(false);
    setQuery('');
    onSelectResult?.(type, item);
  };

  const handleRecentSearchClick = (recentQuery) => {
    setQuery(recentQuery);
    setIsOpen(true);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('transcriptiq-recent-searches');
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'meeting': return Users;
      case 'transcript': return FileText;
      default: return Search;
    }
  };

  const getResultBadgeColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'ended': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className={cn("relative", className)} ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        
        {/* Clear Button */}
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div 
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          {/* Loading State */}
          {loading && (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              Searching...
            </div>
          )}

          {/* No Query - Show Recent Searches */}
          {!query.trim() && !loading && (
            <div className="p-4">
              {recentSearches.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Recent Searches
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearRecentSearches}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((recentQuery, index) => (
                      <button
                        key={index}
                        onClick={() => handleRecentSearchClick(recentQuery)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center space-x-2"
                      >
                        <Clock className="h-3 w-3" />
                        <span>{recentQuery}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  Start typing to search meetings and transcripts
                </div>
              )}
            </div>
          )}

          {/* Search Results */}
          {query.trim() && !loading && (
            <div className="p-2">
              {results.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No results found for "{query}"</p>
                  <p className="text-xs mt-1">Try different keywords or check spelling</p>
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-500 mb-2 px-2">
                    {results.length} result{results.length !== 1 ? 's' : ''} found
                  </div>
                  <div className="space-y-1">
                    {results.map((result, index) => {
                      const Icon = getResultIcon(result.type);
                      return (
                        <button
                          key={result.id || index}
                          onClick={() => handleResultClick(result.type, result)}
                          className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <div className="flex items-start space-x-3">
                            <Icon className="h-4 w-4 mt-1 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {result.title}
                                </h4>
                                {result.metadata?.status && (
                                  <Badge 
                                    variant="secondary"
                                    className={cn("text-xs", getResultBadgeColor(result.metadata.status))}
                                  >
                                    {result.metadata.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {result.subtitle}
                              </p>
                              {result.metadata && (
                                <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
                                  {result.metadata.wordCount && (
                                    <span>{result.metadata.wordCount.toLocaleString()} words</span>
                                  )}
                                  {result.metadata.termCount && (
                                    <span>{result.metadata.termCount} terms</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;