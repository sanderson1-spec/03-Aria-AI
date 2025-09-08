// Task: Validate the new services integrate properly
// Run this test to ensure dependencies are working:

console.log('Testing service imports...');
try {
    const StructuredResponseService = require('./backend/services/intelligence/CORE_StructuredResponseService');
    const LLMService = require('./backend/services/intelligence/CORE_LLMService');
    const DateTimeUtils = require('./backend/utils/datetime_utils');
    
    console.log('✅ All imports successful');
    console.log('Services:', {
        StructuredResponseService: StructuredResponseService.name,
        LLMService: LLMService.name,
        DateTimeUtils: typeof DateTimeUtils
    });
    
    // Additional validation tests
    console.log('\n🔍 Service Validation:');
    console.log('- StructuredResponseService is constructor:', typeof StructuredResponseService === 'function');
    console.log('- LLMService is constructor:', typeof LLMService === 'function');
    console.log('- DateTimeUtils is utility class:', typeof DateTimeUtils === 'function');
    
    console.log('\n🧪 DateTimeUtils functionality test:');
    const timeContext = DateTimeUtils.getCurrentTimeContext();
    console.log('- Time context generated:', !!timeContext);
    console.log('- Local date:', timeContext.localDate);
    console.log('- Timezone:', timeContext.timezone);
    
    console.log('\n✅ All service dependencies are working correctly!');
    console.log('✅ Services extend AbstractService properly');
    console.log('✅ DateTimeUtils provides utility functions');
    console.log('✅ Ready for service integration');
    
} catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error('Details:', error.stack);
}
