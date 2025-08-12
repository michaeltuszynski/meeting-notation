// Test script for the global corrections feature
const { io } = require('socket.io-client');

console.log('Testing Global Corrections Feature...\n');

// Connect to the backend
const socket = io('http://localhost:9000');

socket.on('connect', () => {
    console.log('✓ Connected to backend server');
    
    // Test 1: Add a correction
    console.log('\n1. Testing correction addition...');
    socket.emit('corrections:add', {
        original: 'Sirena',
        corrected: 'Serena MCP',
        options: {
            category: 'technical',
            autoApply: true
        }
    });
});

socket.on('corrections:add-response', (response) => {
    if (response.success) {
        console.log('✓ Correction added successfully:', response.correction);
        
        // Test 2: Get all corrections
        console.log('\n2. Testing get all corrections...');
        socket.emit('corrections:get-all');
    } else {
        console.log('✗ Failed to add correction:', response.error);
    }
});

socket.on('corrections:all-response', (corrections) => {
    console.log('✓ Retrieved corrections:', corrections.length, 'total');
    corrections.forEach(c => {
        console.log(`  - "${c.original_term}" → "${c.corrected_term}" (${c.category})`);
    });
    
    // Test 3: Get suggestions
    console.log('\n3. Testing suggestions...');
    socket.emit('corrections:get-suggestions', 'Sirena');
});

socket.on('corrections:suggestions-response', (response) => {
    console.log('✓ Got suggestions for:', response.term);
    response.suggestions.forEach(s => {
        console.log(`  - "${s.original}" → "${s.corrected}" (confidence: ${Math.round(s.confidence * 100)}%)`);
    });
    
    console.log('\n✓ All tests completed successfully!');
    process.exit(0);
});

socket.on('corrections:applied', (data) => {
    console.log('✓ Real-time correction applied:', data);
});

socket.on('connect_error', (error) => {
    console.error('✗ Connection failed:', error.message);
    console.log('Make sure the backend server is running on port 9000');
    process.exit(1);
});

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\nCleaning up...');
    socket.disconnect();
    process.exit(0);
});