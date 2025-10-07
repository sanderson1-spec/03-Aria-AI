#!/usr/bin/env node

const { setupServices } = require('./setupServices');

async function testProactiveSchema() {
    try {
        console.log('🔧 Setting up services...');
        const serviceFactory = await setupServices();
        
        console.log('✅ Services ready. Testing proactive intelligence schema...');
        const proactiveIntelligence = serviceFactory.get('proactiveIntelligence');
        
        // Get the schema that the proactive intelligence service uses
        const schema = proactiveIntelligence.getProactiveAnalysisSchema();
        console.log('📋 Proactive Intelligence Schema:');
        console.log(JSON.stringify(schema, null, 2));
        
        console.log('\n🧠 Testing with the exact schema...');
        const structuredResponse = serviceFactory.get('structuredResponse');
        
        const testPrompt = `You are Aria, an AI assistant. Analyze this conversation for proactive engagement opportunities:

User: "I am feeling extremely overwhelmed and stressed about work. Please check on me later today."
AI: "I understand you are stressed. Let me help you."

Based on this conversation, determine if you should proactively engage with the user later. Consider:
- The user's emotional state (overwhelmed, stressed)
- Their explicit request for follow-up ("check on me later today")
- The supportive nature of your relationship

Respond with a JSON object following this exact schema.`;
        
        const result = await structuredResponse.generateStructuredResponse(
            testPrompt, 
            schema, 
            { temperature: 0.7, maxTokens: 1000 }
        );
        
        console.log('📥 Result with exact schema:');
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('❌ Error in schema test:', error);
    }
    
    process.exit(0);
}

testProactiveSchema();
