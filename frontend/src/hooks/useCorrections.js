import { useState, useEffect, useCallback } from 'react';

export function useCorrections(socket) {
    const [corrections, setCorrections] = useState([]);
    const [loading, setLoading] = useState(false);

    // Load all corrections on initialization
    useEffect(() => {
        if (socket) {
            socket.emit('corrections:get-all');
            
            // Listen for corrections responses
            socket.on('corrections:all-response', (data) => {
                setCorrections(data);
            });

            // Listen for real-time correction updates
            socket.on('corrections:added', (correction) => {
                setCorrections(prev => [...prev, correction]);
            });

            socket.on('corrections:removed', (correction) => {
                setCorrections(prev => prev.filter(c => c.id !== correction.id));
            });

            socket.on('corrections:add-response', (response) => {
                setLoading(false);
                if (!response.success) {
                    console.error('Failed to add correction:', response.error);
                }
            });

            socket.on('corrections:remove-response', (response) => {
                setLoading(false);
                if (!response.success) {
                    console.error('Failed to remove correction:', response.error);
                }
            });

            return () => {
                socket.off('corrections:all-response');
                socket.off('corrections:added');
                socket.off('corrections:removed');
                socket.off('corrections:add-response');
                socket.off('corrections:remove-response');
            };
        }
    }, [socket]);

    const addCorrection = useCallback(async (original, corrected, options = {}) => {
        if (!socket) return false;

        setLoading(true);
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                setLoading(false);
                resolve(false);
            }, 5000);

            const handleResponse = (response) => {
                clearTimeout(timeout);
                socket.off('corrections:add-response', handleResponse);
                resolve(response.success);
            };

            socket.on('corrections:add-response', handleResponse);
            socket.emit('corrections:add', { original, corrected, options });
        });
    }, [socket]);

    const removeCorrection = useCallback(async (correctionId) => {
        if (!socket) return false;

        setLoading(true);
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                setLoading(false);
                resolve(false);
            }, 5000);

            const handleResponse = (response) => {
                clearTimeout(timeout);
                socket.off('corrections:remove-response', handleResponse);
                resolve(response.success);
            };

            socket.on('corrections:remove-response', handleResponse);
            socket.emit('corrections:remove', correctionId);
        });
    }, [socket]);

    const getSuggestions = useCallback((term) => {
        if (!socket) return Promise.resolve([]);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve([]);
            }, 3000);

            const handleResponse = (response) => {
                if (response.term === term) {
                    clearTimeout(timeout);
                    socket.off('corrections:suggestions-response', handleResponse);
                    resolve(response.suggestions || []);
                }
            };

            socket.on('corrections:suggestions-response', handleResponse);
            socket.emit('corrections:get-suggestions', term);
        });
    }, [socket]);

    const findCorrection = useCallback((term) => {
        return corrections.find(c => 
            c.original_term.toLowerCase() === term.toLowerCase()
        );
    }, [corrections]);

    return {
        corrections,
        loading,
        addCorrection,
        removeCorrection,
        getSuggestions,
        findCorrection
    };
}

export default useCorrections;