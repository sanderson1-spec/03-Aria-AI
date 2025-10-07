# Cursor Implementation Prompts - Copy-Paste Ready

**Purpose:** Exact prompts to feed Cursor for implementing proactive messaging system  
**Usage:** Copy each prompt in sequence, validate after each step

---

## 🚀 Phase 2: Proactive Message Delivery

### Step 1: Create SchedulingService

**Cursor Prompt:**
```
Create a new file backend/services/infrastructure/CORE_SchedulingService.js

Requirements:
1. Extend AbstractService from '../base/CORE_AbstractService'
2. Accept dependencies: database, logger, errorHandling, messageDelivery
3. Implement background polling that:
   - Runs every 30 seconds
   - Queries proactive_engagements table via DAL for messages where scheduled_for <= NOW() AND status = 'pending'
   - For each due message, call deliverProactiveMessage()
   - Update message status to 'delivered' after successful delivery
4. Key methods:
   - async onInitialize() - Start polling
   - async startPolling() - Begin the polling loop
   - async stopPolling() - Graceful shutdown
   - async checkScheduledMessages() - Main polling logic
   - async deliverProactiveMessage(engagement) - Trigger message delivery
5. Use this.logger for all logging (no console.log)
6. Use this.errorHandler to wrap all errors
7. Store pollingInterval ID for cleanup on shutdown
8. Follow the pattern from CORE_PsychologyService.js for service structure

Reference project knowledge for AbstractService patterns and clean architecture guidelines.
```

**After Generation - Validation:**
```bash
node validate-architecture.js
npm run test -- tests/services/SchedulingService.test.js
```

---

### Step 2: Create Unit Tests for SchedulingService

**Cursor Prompt:**
```
Create a new file tests/services/SchedulingService.test.js

Requirements:
1. Follow the testing pattern from tests/services/PsychologyService.test.js
2. Mock dependencies: database (with DAL), logger, errorHandling, messageDelivery
3. Test suites:
   - Architecture Compliance (extends AbstractService, has required methods)
   - Polling Mechanism (starts polling, stops polling, handles errors)
   - Message Detection (finds due messages, ignores future messages)
   - Message Delivery (calls messageDelivery service, updates status)
   - Error Handling (gracefully handles database errors, continues polling)
   - Health Check (reports healthy when polling active)

Use Jest mocking patterns. Mock timers with jest.useFakeTimers() for testing polling intervals.
```

---

### Step 3: Create MessageDeliveryService

**Cursor Prompt:**
```
Create a new file backend/services/infrastructure/CORE_MessageDeliveryService.js

Requirements:
1. Extend AbstractService from '../base/CORE_AbstractService'
2. Accept dependencies: database, logger, errorHandling
3. Manage WebSocket connections:
   - Store connections in a Map<userId, WebSocket>
   - Handle connection registration from WebSocket server
   - Handle connection cleanup on disconnect
4. Key methods:
   - async registerConnection(userId, websocket) - Register user's websocket
   - async unregisterConnection(userId) - Clean up disconnected user
   - async deliverMessage(userId, message) - Push message via WebSocket
   - async deliverProactiveMessage(engagement) - Deliver scheduled proactive message
   - async handleOfflineUser(userId, messageId) - Queue message for later delivery
   - async getConnectionStatus(userId) - Check if user is connected
5. Message delivery logic:
   - If user connected: push via WebSocket
   - If user offline: message stays in DB with status='pending'
   - On user reconnect: check for pending messages and deliver
6. Use structured logging for all connection events
7. Follow clean architecture - no direct database access (use DAL)

Reference CORE_ConfigurationService.js for service patterns.
```

**After Generation - Validation:**
```bash
node validate-architecture.js
npm run test -- tests/services/MessageDeliveryService.test.js
```

---

### Step 4: Create Unit Tests for MessageDeliveryService

**Cursor Prompt:**
```
Create a new file tests/services/MessageDeliveryService.test.js

Requirements:
1. Follow testing pattern from tests/services/PsychologyService.test.js
2. Mock WebSocket connections using mock objects
3. Test suites:
   - Architecture Compliance (extends AbstractService, proper dependencies)
   - Connection Management (register, unregister, handle multiple users)
   - Message Delivery (deliver to connected user, handle offline user)
   - Error Handling (handle WebSocket errors, continue operations)
   - Reconnection (deliver pending messages on reconnect)
   - Health Check (reports connection count and status)

Mock WebSocket with: { send: jest.fn(), readyState: 1, close: jest.fn() }
```

---

### Step 5: Create WebSocket Server

**Cursor Prompt:**
```
Create a new file backend/api/websocket.js

Requirements:
1. Use 'ws' library (WebSocket)
2. Create WebSocket server function: setupWebSocketServer(server, serviceFactory)
3. On connection:
   - Extract JWT token from query params or headers
   - Verify token (basic validation - check if exists)
   - Extract userId from token
   - Register connection with MessageDeliveryService
4. On message from client:
   - Parse JSON message
   - Handle different message types (subscribe, unsubscribe, ping)
5. On disconnect:
   - Unregister connection from MessageDeliveryService
   - Clean up resources
6. Error handling:
   - Wrap all WebSocket errors
   - Log connection errors
   - Graceful disconnect on errors
7. Follow patterns from backend/api/server.js for server setup

Export setupWebSocketServer function.
```

**Integration with server.js:**
```
Update backend/api/server.js to integrate WebSocket server:

In start() method, after creating HTTP server but before listening:
1. Import: const { setupWebSocketServer } = require('./websocket');
2. After this.server = this.app.listen(...):
   - const wss = setupWebSocketServer(this.server, this.serviceFactory);
   - this.wss = wss;
3. In shutdown() method, add: if (this.wss) this.wss.close();

Follow existing patterns in server.js.
```

---

### Step 6: Create Proactive API Routes

**Cursor Prompt:**
```
Create a new file backend/api/proactiveRoutes.js

Requirements:
1. Follow the pattern from backend/api/chatRoutes.js
2. Create ProactiveRoutes class with constructor(serviceFactory)
3. Implement routes:
   - POST /schedule - Schedule a proactive message
     Request: { userId, chatId, characterId, message, scheduledFor }
     Response: { success: true, engagementId: '...' }
   
   - GET /pending - List pending proactive messages
     Query: userId (required)
     Response: { success: true, data: [...pending messages...] }
   
   - DELETE /:engagementId - Cancel scheduled message
     Params: engagementId
     Response: { success: true }
   
   - GET /history - Get proactive message history
     Query: userId, limit (optional, default 50)
     Response: { success: true, data: [...history...] }

4. All routes enforce user isolation (check userId matches authenticated user)
5. Use ProactiveIntelligenceService for scheduling logic
6. Use DAL for database access via serviceFactory.get('database').getDAL()
7. Proper error handling with try-catch and 500 responses
8. Return Express router from getRouter() method

Follow RESTful conventions and existing route patterns.
```

**After Generation - Integration:**
```
Update backend/api/server.js to add proactive routes:

In setupRoutes() method:
1. Import: const ProactiveRoutes = require('./proactiveRoutes');
2. Add after characters routes:
   const proactiveRoutes = new ProactiveRoutes(this.serviceFactory);
   this.app.use('/api/proactive', proactiveRoutes.getRouter());
```

---

### Step 7: Update Service Registration

**Cursor Prompt:**
```
Update backend/setupServices.js to register new services:

In the service registration section (after registering existing services):

1. Register SchedulingService:
   serviceFactory.registerService('scheduling', SchedulingService, [
       'database',
       'logger',
       'errorHandling',
       'messageDelivery'
   ]);

2. Register MessageDeliveryService:
   serviceFactory.registerService('messageDelivery', MessageDeliveryService, [
       'database',
       'logger',
       'errorHandling'
   ]);

3. Import statements at top of file:
   const SchedulingService = require('./backend/services/infrastructure/CORE_SchedulingService');
   const MessageDeliveryService = require('./backend/services/infrastructure/CORE_MessageDeliveryService');

Place these registrations in the INFRASTRUCTURE SERVICES section.
Follow existing registration patterns in the file.
```

---

### Step 8: Frontend WebSocket Client

**Cursor Prompt:**
```
Create a new file frontend/src/services/websocket.ts

Requirements:
1. Create WebSocketService class with TypeScript
2. Connection management:
   - Connect to ws://localhost:3001 (configurable)
   - Send JWT token on connection
   - Automatic reconnection on disconnect (exponential backoff)
   - Track connection state (connecting, connected, disconnected)
3. Message handling:
   - Listen for incoming messages
   - Type-safe message parsing using types from types/index.ts
   - Event emitter pattern for message callbacks
4. Methods:
   - connect(token: string): Promise<void>
   - disconnect(): void
   - send(message: WebSocketMessage): void
   - on(event: string, callback: Function): void
   - off(event: string, callback: Function): void
5. Handle message types:
   - 'proactive_message' - New proactive message arrived
   - 'typing' - Character is typing
   - 'error' - Error from server
6. Reconnection logic:
   - Retry with backoff: 1s, 2s, 4s, 8s, 16s (max)
   - Reset backoff on successful connection
   - Resubscribe to chat on reconnect
7. Use WebSocket API (native browser WebSocket)

Export singleton instance: export const websocketService = new WebSocketService();
```

---

### Step 9: Integrate WebSocket with ChatContext

**Cursor Prompt:**
```
Update frontend/src/contexts/ChatContext.tsx to integrate WebSocket:

Requirements:
1. Import websocketService from '../services/websocket'
2. In ChatProvider useEffect:
   - Connect WebSocket on mount
   - Disconnect on unmount
   - Handle proactive_message events
3. When proactive_message received:
   - Add message to current chat messages
   - Update chat's lastMessage
   - Trigger notification (optional)
4. Subscribe to current chat on switchToCharacterChat
5. Handle connection status in state:
   - Add wsConnected: boolean to context state
   - Update based on WebSocket connection events
6. Error handling:
   - Log WebSocket errors
   - Show user-friendly error message if connection fails
   - Retry connection automatically

Follow existing patterns in ChatContext for state management.
Maintain backward compatibility with existing chat functionality.
```

---

### Step 10: Update ProactiveIntelligenceService Integration

**Cursor Prompt:**
```
Update backend/services/domain/CORE_ProactiveIntelligenceService.js:

Add new method: async scheduleProactiveMessage(engagement)

Requirements:
1. Accept engagement object with:
   { userId, chatId, characterId, message, reasoning, timing }
2. Calculate scheduledFor timestamp based on timing:
   - 'immediate': now
   - 'wait_30_seconds': now + 30s
   - 'wait_2_minutes': now + 2min
   - 'wait_5_minutes': now + 5min
   - 'wait_later': now + 10min
3. Create proactive_engagement record via DAL:
   await this.dal.proactive.create({
     user_id: engagement.userId,
     chat_id: engagement.chatId,
     personality_id: engagement.characterId,
     engagement_type: 'proactive_message',
     trigger_context: engagement.reasoning,
     engagement_content: engagement.message,
     scheduled_for: scheduledFor,
     status: 'pending'
   })
4. Return created engagement record
5. Log scheduling decision with context

Integrate this method into existing analyzeProactiveOpportunity method.
After LLM analysis, if should_engage_proactively === true, call scheduleProactiveMessage.
```

---

### Step 11: Integration Test - Full Proactive Flow

**Cursor Prompt:**
```
Create a new file tests/integration/proactive-message-flow.test.js

Requirements:
1. Test complete flow from analysis to delivery
2. Setup:
   - Initialize service factory with all services
   - Create test user, character, chat
   - Mock WebSocket connection
3. Test scenarios:
   a. Schedule proactive message via ProactiveIntelligenceService
   b. Verify message appears in proactive_engagements table
   c. Simulate SchedulingService polling
   d. Verify MessageDeliveryService delivers message
   e. Verify message appears in conversation_logs
   f. Verify WebSocket push was called

   b. Offline user scenario:
   - Schedule message for offline user
   - Verify message stays in DB with status='pending'
   - Simulate user coming online
   - Verify message is delivered

   c. Message cancellation:
   - Schedule message
   - Cancel before delivery
   - Verify message status='cancelled'
   - Verify message not delivered

4. Cleanup:
   - Clean up test data
   - Stop all services

Follow pattern from tests/integration/chat-workflow-integration.test.js
Use jest.useFakeTimers() for time-based testing.
```

---

## 🧪 Validation Commands

After each major step, run:

```bash
# Architecture validation
node validate-architecture.js

# Run unit tests
npm run test

# Run specific test file
npm run test -- tests/services/SchedulingService.test.js

# Run integration tests
npm run test -- tests/integration/

# Start server and manually test
npm start
```

---

## 🎯 Success Checklist

After completing all steps:

- [ ] SchedulingService polls every 30 seconds
- [ ] MessageDeliveryService manages WebSocket connections
- [ ] WebSocket server accepts connections with JWT
- [ ] Proactive API routes respond correctly
- [ ] Frontend WebSocket client connects and receives messages
- [ ] ProactiveIntelligenceService schedules messages
- [ ] Full integration test passes
- [ ] Messages appear in chat UI with proactive indicator
- [ ] Offline users receive messages on next login

---

## 🚨 Common Issues & Solutions

### Issue: "Service not found in registry"
**Solution:** Check service registration in setupServices.js. Ensure service is registered before services that depend on it.

### Issue: "Cannot find module 'ws'"
**Solution:** Install WebSocket library: `npm install ws`

### Issue: "WebSocket connection refused"
**Solution:** Ensure API server is running and WebSocket server is initialized after HTTP server.

### Issue: "Polling not starting"
**Solution:** Check onInitialize() is called. Verify no errors in startPolling(). Add debug logging.

### Issue: "Messages not delivering"
**Solution:** Check MessageDeliveryService connection map. Verify userId matches between connection and message delivery.

---

## 📝 Notes for Cursor

- Always reference project knowledge before generating code
- Follow existing service patterns exactly (especially AbstractService extension)
- Use DAL for all database access (no direct SQL)
- Use this.logger for all logging (no console.log)
- Handle errors with this.errorHandler.wrapError()
- Write tests immediately after creating service
- Validate architecture compliance after each step

---

## 🎬 Start Here

Copy the **Step 1** prompt and paste it into Cursor. After Cursor generates the code:
1. Review the generated code
2. Run validation commands
3. Move to **Step 2** (tests)
4. Continue sequentially through all steps

Good luck! 🚀