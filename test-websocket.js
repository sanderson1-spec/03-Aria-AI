/**
 * Simple WebSocket Connection Test
 * Tests that the WebSocket server can accept connections and handle messages
 */

const WebSocket = require('ws');

console.log('🧪 Starting WebSocket connection test...\n');

// Test 1: Connect with token in query params
console.log('Test 1: Connecting with token in query params...');
const ws1 = new WebSocket('ws://localhost:3001?token=test-user-123');

ws1.on('open', () => {
    console.log('✅ Connection 1 established');
    
    // Test ping
    console.log('📤 Sending ping...');
    ws1.send(JSON.stringify({ type: 'ping' }));
});

ws1.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', message);
    
    if (message.type === 'pong') {
        console.log('✅ Ping-pong test passed');
        
        // Test subscription
        console.log('📤 Sending subscribe...');
        ws1.send(JSON.stringify({ 
            type: 'subscribe', 
            subscription: 'proactive-messages' 
        }));
    }
    
    if (message.type === 'subscribed') {
        console.log('✅ Subscription test passed');
        console.log('🔌 Closing connection...');
        ws1.close();
    }
});

ws1.on('close', (code, reason) => {
    console.log(`🔌 Connection 1 closed (code: ${code}, reason: ${reason})`);
    
    // Test 2: Connect with token in Authorization header
    setTimeout(() => {
        console.log('\nTest 2: Connecting with Authorization header...');
        const ws2 = new WebSocket('ws://localhost:3001', {
            headers: {
                'Authorization': 'Bearer test-user-456'
            }
        });
        
        ws2.on('open', () => {
            console.log('✅ Connection 2 established');
            console.log('📤 Sending ping...');
            ws2.send(JSON.stringify({ type: 'ping' }));
        });
        
        ws2.on('message', (data) => {
            const message = JSON.parse(data.toString());
            console.log('📨 Received:', message);
            
            if (message.type === 'pong') {
                console.log('✅ Authorization header test passed');
                console.log('🔌 Closing connection...');
                ws2.close();
            }
        });
        
        ws2.on('close', () => {
            console.log('🔌 Connection 2 closed');
            
            // Test 3: Connection without token (should fail)
            setTimeout(() => {
                console.log('\nTest 3: Connecting without token (should fail)...');
                const ws3 = new WebSocket('ws://localhost:3001');
                
                ws3.on('open', () => {
                    console.log('❌ Connection 3 should have been rejected!');
                    ws3.close();
                });
                
                ws3.on('close', (code, reason) => {
                    if (code === 1008) {
                        console.log('✅ Unauthorized connection properly rejected');
                        console.log(`   Close code: ${code}, reason: ${reason}`);
                    }
                    
                    console.log('\n🎉 All WebSocket tests completed!');
                    process.exit(0);
                });
                
                ws3.on('error', (error) => {
                    console.log('✅ Connection error as expected:', error.message);
                });
                
            }, 500);
        });
        
        ws2.on('error', (error) => {
            console.error('❌ Connection 2 error:', error.message);
            process.exit(1);
        });
        
    }, 500);
});

ws1.on('error', (error) => {
    console.error('❌ Connection 1 error:', error.message);
    console.log('\n⚠️  Make sure the server is running first!');
    console.log('   Run: node start.js');
    process.exit(1);
});

// Timeout safety
setTimeout(() => {
    console.log('\n⏱️  Test timeout reached');
    process.exit(1);
}, 10000);

