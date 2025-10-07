/**
 * Simple test to verify server and WebSocket startup
 */

const { setupServices } = require('./setupServices');
const APIServer = require('./backend/api/server');

(async () => {
    try {
        console.log('🧪 Testing server and WebSocket startup...\n');
        
        // Setup services
        console.log('1️⃣  Setting up services...');
        const serviceFactory = await setupServices();
        console.log('✅ Services initialized\n');
        
        // Start API server (which includes WebSocket)
        console.log('2️⃣  Starting API server...');
        const apiServer = new APIServer(serviceFactory, 3001);
        await apiServer.start();
        console.log('✅ API server started with WebSocket support\n');
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Shutdown
        console.log('3️⃣  Shutting down...');
        await apiServer.stop();
        await serviceFactory.shutdown();
        console.log('✅ Shutdown complete\n');
        
        console.log('🎉 Server startup test passed!');
        console.log('💡 You can now run the WebSocket client test with: node test-websocket.js');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Server startup test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
})();

