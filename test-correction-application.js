// Test the correction application on text
const GlobalCorrectionService = require('./backend/services/global-corrections');
const PostgresService = require('./backend/db/postgres');

async function testCorrectionApplication() {
    console.log('Testing Correction Application...\n');
    
    // Initialize services
    const db = new PostgresService();
    const correctionService = new GlobalCorrectionService(db);
    
    // Wait for corrections to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test text samples
    const testTexts = [
        "Let's discuss Sirena MCP and how it integrates with the system.",
        "Antrhopic has released a new model called Clawd that's very powerful.",
        "The API endpoint for GPT is working well in our tests.",
        "We need to set up the Kubernetes cluster for deployment.",
        "This is a test of PostgreSQL database performance."
    ];
    
    console.log('Original texts:');
    testTexts.forEach((text, i) => {
        console.log(`${i + 1}. ${text}`);
    });
    
    console.log('\nApplying corrections...\n');
    
    // Apply corrections to each text
    for (let i = 0; i < testTexts.length; i++) {
        const result = correctionService.applyCorrections(testTexts[i]);
        
        console.log(`Text ${i + 1}:`);
        console.log(`Original:  ${testTexts[i]}`);
        console.log(`Corrected: ${result.text}`);
        
        if (result.hasChanges) {
            console.log(`✓ Applied ${result.corrections.length} correction(s):`);
            result.corrections.forEach(c => {
                console.log(`  - "${c.original}" → "${c.corrected}" (${c.category})`);
            });
        } else {
            console.log('- No corrections needed');
        }
        console.log('');
    }
    
    // Test similarity matching
    console.log('Testing similarity matching...');
    const similarityTests = [
        ['Sirena', 'Serena'],
        ['Antrhopic', 'Anthropic'],
        ['Clawd', 'Claude'],
        ['kubernetes', 'Kubernetes'],
        ['postgresql', 'PostgreSQL']
    ];
    
    similarityTests.forEach(([word1, word2]) => {
        const similarity = correctionService.calculateSimilarity(word1, word2);
        console.log(`Similarity "${word1}" <-> "${word2}": ${Math.round(similarity * 100)}%`);
    });
    
    console.log('\n✓ Correction application test completed!');
    process.exit(0);
}

testCorrectionApplication().catch(error => {
    console.error('✗ Test failed:', error);
    process.exit(1);
});