# Aria AI - Complete Requirements Specification

**Project Type:** Hobby/Family AI Chat Application  
**Last Updated:** October 6, 2025  
**Version:** 1.0

---

## 1. Project Vision & Core Principles

### Vision Statement
Create an AI chat application where characters develop authentic personalities, learn from conversations, remember what matters, and proactively engage like real people - making interactions feel natural and meaningful rather than scripted.

### Core Design Principles

1. **Character Authenticity**: Characters should feel like real individuals with unique personalities, not chatbots following rigid rules
2. **Intelligence-Driven Behavior**: Rely on LLM intelligence for decisions rather than hard-coded logic
3. **Complete Data Isolation**: Each user's data is completely separate - no sharing between users or chats
4. **Natural Memory**: Characters remember important moments and forget trivial details, just like humans
5. **Proactive Engagement**: Characters can initiate contact when it makes sense, like a real friend would
6. **Device Agnostic**: Seamless conversation continuity across web browsers and future iOS app
7. **Server as Truth**: Single source of truth on server, clients are just views into that data
8. **Simplicity First**: Start simple, add complexity only when real usage data demands it

---

## 2. Feature Overview

### 2.1 Character System
- **Free-text character definition** (similar to character.ai) - no rigid forms
- **Dynamic personality development** through conversation
- **Psychological state tracking** (emotions, energy, stress, motivations)
- **Learning system** - characters learn user preferences, communication styles, likes/dislikes
- **Character export/import** to JSON files for backup and sharing

### 2.2 Conversation System
- **Real-time streaming responses** for immediate feedback
- **Multi-user support** with complete data isolation
- **Multi-device support** - start on laptop, continue on phone
- **Conversation history** with intelligent context management
- **Chat-scoped isolation** - each chat is completely independent

### 2.3 Memory System
- **Intelligent memory weighting** based on:
  - Emotional impact
  - Relationship relevance
  - Personal significance
  - Contextual importance
- **Long-term retention** - remember important conversations months later
- **Natural forgetting** - low-significance memories become less accessible over time
- **Memory recall tracking** - frequently referenced memories stay accessible

### 2.4 Proactive Intelligence
- **Character-initiated contact** - reach out when it makes sense
- **Context-aware timing** - consider conversation flow, emotional state, time of day
- **Personality-driven decisions** - each character decides based on their unique psychology
- **Learning patterns** - improve proactive engagement based on user responses

### 2.5 Task & Event Management
- **Character-assigned tasks** (e.g., homework from a teacher character)
- **Deadline tracking** and reminders
- **Task verification** - character checks if task was completed correctly
- **Chat-scoped tasks** - tied to specific character conversations
- **Event scheduling** with proactive reminders

### 2.6 Multi-Device Experience
- **Web client** (primary interface)
- **Future iOS app** with:
  - Native push notifications
  - HealthKit integration
  - Calendar integration
  - Native iOS features
- **Seamless handoff** between devices
- **Real-time sync** via WebSocket when active

---

## 3. Technical Architecture Requirements

### 3.1 System Architecture

**Architecture Style:** Clean Architecture with Service-Oriented Design

**Core Patterns:**
- AbstractService base class for all services
- Dependency injection through ServiceFactory
- Repository pattern for all data access
- Data Access Layer (DAL) as infrastructure boundary
- No direct SQL outside repositories

**Technology Stack:**
- **Backend:** Node.js
- **Database:** SQLite
- **LLM Server:** Local LMStudio or Ollama
- **Frontend:** Web (current), iOS (future)
- **Communication:** REST API + WebSocket for real-time

### 3.2 LLM Architecture

**Dual LLM System:**

**LLM1 (Conversation - Llama):**
- Handles all user-facing communication
- Maintains character voice and personality
- Streams responses in real-time
- Focused on natural conversation

**LLM2 (Analysis - Qwen):**
- Processes structured analysis tasks
- Updates psychological state
- Makes proactive engagement decisions
- Analyzes memory significance
- Operates asynchronously in background

**Processing Flow:**
1. User sends message
2. LLM1 generates response (streamed to user immediately)
3. LLM2 analyzes exchange in background (parallel, non-blocking)
4. LLM2 updates psychology state and memory weights
5. LLM2 decides if proactive follow-up needed
6. If yes, schedules proactive message delivery
7. When scheduled time arrives, LLM1 generates the actual message

### 3.3 Asynchronous Processing

**Requirements:**
- User receives LLM1 response within 3-5 seconds
- LLM2 analysis happens asynchronously after every message
- No blocking on analysis completion
- Simple fire-and-forget async calls (no complex job queue initially)
- Trust natural conversation pacing to prevent race conditions

**Analysis Triggers:**
- After every user message + character response pair
- Not batched, not periodic - immediate analysis

### 3.4 Proactive Message Delivery

**Scheduling Architecture:**
- **Storage:** Database-backed with `scheduled_for` timestamp
- **Polling:** Background worker checks every 10-30 seconds for due messages
- **Accuracy:** Within 10-30 seconds of scheduled time (not millisecond-precise)
- **Delivery:** Messages appear as normal conversation messages

**Timing Options:**
- Immediate (0 seconds)
- Wait 30 seconds
- Wait 2 minutes
- Wait 5 minutes
- Wait later (10+ minutes, hours, days)

**Delivery Mechanisms:**
- **Active user (WebSocket connected):** Push message via WebSocket
- **Inactive user:** Message waits in database, delivered when user next opens app
- **Future iOS:** Push notification when app closed

**Decision Authority:**
- LLM2 decides if and when to send proactive message
- LLM2 provides reasoning and context
- LLM1 generates actual message content when delivery time arrives

---

## 4. Data Model Requirements

### 4.1 Core Entities

#### Users
- `id` - unique identifier
- `username` - login credential (unique)
- `password_hash` - hashed password (add to schema)
- `display_name` - friendly name
- `email` - optional
- `created_at`, `updated_at`
- `last_active` - for presence tracking
- `is_active` - soft delete flag

#### Chats
- `id` - unique identifier
- `user_id` - foreign key (REQUIRED on all queries)
- `personality_id` - which character
- `title` - chat name
- `created_at`, `updated_at`
- `is_active` - soft delete flag
- **Isolation Rule:** All chat queries MUST filter by `user_id`

#### Personalities (Characters)
- `id` - unique identifier
- `user_id` - owner of this character definition
- `name` - character name
- `description` - free-text character definition
- `traits` - JSON object with personality traits
- `communication_style` - JSON object with style preferences
- `created_at`, `updated_at`
- `usage_count` - how many chats use this character
- `is_active` - soft delete flag

#### Conversation Logs
- `id` - unique identifier
- `chat_id` - which conversation
- `user_id` - foreign key (REQUIRED)
- `role` - 'user' or 'assistant'
- `content` - message text
- `timestamp` - when sent
- `is_proactive` - flag for character-initiated messages
- **Isolation Rule:** All queries MUST filter by `user_id`

### 4.2 Psychology System

#### Character Psychological State
- `session_id` - unique per chat session (maps to chat_id)
- `personality_id` - which character
- `user_id` - REQUIRED for isolation
- `current_emotion` - character's current emotional state
- `emotional_intensity` - 1-10 scale
- `energy_level` - 1-10 scale
- `stress_level` - 1-10 scale
- `current_motivations` - JSON array
- `relationship_dynamic` - how character sees this relationship
- `active_interests` - JSON array
- `communication_mode` - current expression style
- `internal_state_notes` - freeform character mindset
- `last_updated`, `change_reason`, `state_version`

#### Character Psychological Frameworks
- `personality_id` - which character (reusable across users)
- `framework_data` - JSON structure defining character psychology
- `analysis_version` - framework iteration
- `updated_at`

#### Character Memory Weights
- `id` - unique identifier
- `session_id` - which chat session
- `user_id` - REQUIRED for isolation
- `message_id` - reference to conversation log
- **Significance Scores** (1-10 scale each):
  - `emotional_impact_score`
  - `relationship_relevance`
  - `personal_significance`
  - `contextual_importance`
- `memory_type` - conversational, emotional, factual, relational
- `memory_tags` - JSON array of topics
- `recall_frequency` - how often referenced
- `last_recalled` - timestamp
- `accessibility_score` - future decay calculation (default 1.0)
- `created_at`, `updated_at`

**Memory Retention Strategy:**
- No deletion initially - collect real usage data
- `accessibility_score` column ready for future decay implementation
- High-significance memories remain accessible indefinitely
- Low-significance memories decay over time (future feature)

#### Psychology Evolution Log
- `id` - unique identifier
- `session_id` - which chat session
- `personality_id` - which character
- `user_id` - REQUIRED for isolation
- `previous_state` - JSON snapshot before change
- `new_state` - JSON snapshot after change
- `trigger_message` - what caused the change
- `analysis_reasoning` - LLM's reasoning
- `emotional_shift_magnitude` - how much emotion changed
- `motivation_stability` - how stable motivations are
- `relationship_progression` - relationship development score
- `created_at`

### 4.3 Proactive Intelligence System

#### Proactive Engagements (Scheduled Messages)
- `id` - unique identifier
- `user_id` - REQUIRED for isolation
- `chat_id` - which conversation
- `personality_id` - which character
- `engagement_type` - type of proactive message
- `trigger_analysis` - JSON with LLM2's decision reasoning
- `scheduled_for` - when to deliver (timestamp)
- `created_at` - when scheduled
- `delivered_at` - when actually delivered (NULL if pending)
- `status` - pending, delivered, responded, ignored, cancelled
- `message_content` - the actual message (generated by LLM1 at delivery time)
- `engagement_success_score` - user response quality (0-10)

**Delivery Logic:**
- Background worker polls every 10-30 seconds
- Check for `scheduled_for <= NOW() AND status = 'pending'`
- When due: Call LLM1 to generate message content
- Insert into conversation_logs with `is_proactive = true`
- Update status to 'delivered'
- Notify via WebSocket if user connected

#### Proactive Learning Patterns
- `id` - unique identifier
- `personality_id` - which character learns
- `user_id` - REQUIRED for isolation
- `pattern_type` - timing, topic, emotional_state, etc.
- `pattern_data` - JSON with pattern details
- `success_rate` - effectiveness of this pattern
- `sample_size` - how many examples
- `confidence_score` - statistical confidence
- `created_at`, `updated_at`

### 4.4 Task & Event System

#### Tasks
- `id` - unique identifier
- `chat_id` - which conversation (chat-scoped)
- `user_id` - REQUIRED for isolation
- `personality_id` - which character assigned it
- `title` - task name
- `description` - task details
- `assigned_at` - when created
- `due_at` - deadline (timestamp)
- `completed_at` - when user finished (NULL if pending)
- `verified_at` - when character verified completion (NULL if not verified)
- `status` - pending, completed, verified, failed, overdue
- `verification_notes` - character's feedback on completion
- `reminder_times` - JSON array of reminder timestamps
- `created_at`, `updated_at`

**Task Isolation:**
- Tasks tied to specific chat conversation
- If you start new chat with same character, tasks don't carry over
- Clean separation - no cross-chat task awareness

#### Events
- `id` - unique identifier
- `chat_id` - which conversation (chat-scoped)
- `user_id` - REQUIRED for isolation
- `personality_id` - which character set it
- `title` - event name
- `description` - event details
- `event_time` - when event happens (timestamp)
- `reminder_time` - when to remind (timestamp)
- `status` - upcoming, reminded, completed, cancelled
- `created_at`, `updated_at`

### 4.5 Additional Tables

#### Sessions
- `id` - unique identifier
- `user_id` - foreign key
- `chat_id` - current chat
- `device_info` - JSON with device details
- `created_at`, `last_active_at`
- `is_active` - currently connected flag

#### Configuration
- `key` - setting name
- `value` - setting value
- `type` - data type (string, number, boolean)
- `description` - what it does
- `category` - grouping
- `is_user_configurable` - can users change it

#### Schema Versions
- Track database migrations and versions

---

## 5. API Requirements

### 5.1 Authentication Endpoints

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

**Authentication Method:**
- Simple username/password
- JWT tokens for session management
- Extract `user_id` from token for all subsequent requests

### 5.2 Chat Endpoints

```
GET    /api/chats                    # List user's chats
POST   /api/chats                    # Create new chat
GET    /api/chats/:chatId            # Get specific chat
PUT    /api/chats/:chatId            # Update chat
DELETE /api/chats/:chatId            # Delete chat
GET    /api/chats/:chatId/messages   # Get conversation history
POST   /api/chats/:chatId/messages   # Send message (returns streaming response)
```

**Key Requirements:**
- All endpoints automatically filter by `user_id` from auth token
- POST message endpoint streams LLM1 response in real-time
- Response includes conversation context and character state

### 5.3 Character Endpoints

```
GET    /api/personalities            # List user's characters
POST   /api/personalities            # Create new character
GET    /api/personalities/:id        # Get character details
PUT    /api/personalities/:id        # Update character
DELETE /api/personalities/:id        # Delete character
POST   /api/personalities/import     # Import from JSON
GET    /api/personalities/:id/export # Export to JSON
```

### 5.4 Task & Event Endpoints

```
GET    /api/chats/:chatId/tasks      # List tasks for chat
POST   /api/chats/:chatId/tasks      # Create task
PUT    /api/tasks/:taskId            # Update task status
DELETE /api/tasks/:taskId            # Delete task

GET    /api/chats/:chatId/events     # List events for chat
POST   /api/chats/:chatId/events     # Create event
PUT    /api/events/:eventId          # Update event
DELETE /api/events/:eventId          # Delete event
```

### 5.5 WebSocket Protocol

```
Connection: ws://server/ws?token={jwt_token}

Client -> Server:
{
  "type": "subscribe",
  "chatId": "chat-123"
}

Server -> Client (proactive message):
{
  "type": "message",
  "chatId": "chat-123",
  "message": {
    "id": "msg-456",
    "role": "assistant",
    "content": "Hey! I've been thinking about...",
    "timestamp": "2025-10-06T14:30:00Z",
    "is_proactive": true
  }
}

Server -> Client (task reminder):
{
  "type": "task_reminder",
  "chatId": "chat-123",
  "task": {
    "id": "task-789",
    "title": "Spanish homework",
    "due_at": "2025-10-07T18:00:00Z"
  }
}
```

---

## 6. Service Architecture Requirements

### 6.1 Foundation Services (CORE - Do Not Modify)

These services form the architectural foundation:

- **AbstractService** - Base class for all services
- **ServiceFactory** - Dependency injection and lifecycle management
- **LoggerService** - Centralized logging
- **ErrorHandlingService** - Standardized error wrapping
- **ConfigurationService** - System configuration
- **DataAccessLayer** - Database abstraction
- **BaseRepository** - Repository pattern base
- **StructuredResponseService** - JSON schema validation
- **LLMService** - Centralized LLM communication

### 6.2 Domain Services

**PsychologyService:**
- Manage character psychological state
- Update emotional states, energy, stress levels
- Track motivations and relationship dynamics
- Apply psychological frameworks
- Log state evolution

**ConversationMemoryService:**
- Weight memory significance
- Track recall frequency
- Calculate accessibility scores
- Provide context-appropriate memory retrieval
- Manage long-term memory retention

**ProactiveIntelligenceService:**
- Analyze conversation for proactive opportunities
- Make engagement timing decisions
- Schedule proactive messages
- Track engagement success
- Interface with LLM2 for analysis

**ProactiveLearningService:**
- Extract patterns from successful engagements
- Learn optimal timing preferences
- Identify topic triggers
- Build character-specific engagement strategies
- Improve decision confidence over time

**TaskManagementService:**
- Create and track tasks
- Schedule reminders
- Verify task completion
- Interface with character for feedback

**ConversationAnalyzer:**
- Analyze conversation sentiment
- Detect conversation flow changes
- Identify significant moments
- Provide context for memory weighting

### 6.3 Infrastructure Services

**DatabaseService:**
- SQLite database connection management
- Transaction handling
- Migration management

**WebSocketService:**
- Manage WebSocket connections
- Route messages to correct clients
- Handle connection lifecycle
- Deliver proactive messages in real-time

**SchedulingService:**
- Background worker for polling scheduled tasks
- Execute due proactive messages
- Trigger task reminders
- Handle event notifications

**AuthenticationService:**
- User authentication
- Token generation and validation
- Session management
- User_id extraction for requests

---

## 7. Non-Functional Requirements

### 7.1 Performance

- **Response Time:** LLM1 streaming starts within 1-2 seconds
- **Message Delivery:** User sees first tokens within 3 seconds
- **Background Processing:** LLM2 analysis completes within 10 seconds
- **Proactive Accuracy:** Messages delivered within 30 seconds of scheduled time
- **Database:** Queries under 100ms for typical operations

### 7.2 Scalability

- **Users:** Designed for family use (5-10 users)
- **Concurrent Sessions:** 2-3 per user (different devices)
- **Messages:** Support 1000+ messages per chat
- **Characters:** 10-20 characters per user
- **Long-term Growth:** Database should handle months/years of data

### 7.3 Reliability

- **Data Persistence:** All data survives server restarts
- **Scheduled Messages:** Scheduled tasks survive restarts (database-backed)
- **Error Handling:** Graceful degradation - if LLM2 fails, conversation continues
- **Background Jobs:** Retry failed analysis operations

### 7.4 Security

- **Authentication:** Required for all API access
- **Data Isolation:** Enforced at repository layer
- **Password Storage:** Bcrypt hashing
- **Token Management:** JWT with reasonable expiration
- **Input Validation:** Sanitize all user inputs

### 7.5 Usability

- **Setup:** Simple installation for non-technical users
- **Configuration:** Minimal required configuration
- **Error Messages:** Clear, actionable error messages
- **Character Creation:** Intuitive free-text definition

---

## 8. Implementation Phases

### Phase 1: Foundation (COMPLETE)
✅ Clean architecture service framework  
✅ Database schema with multi-user support  
✅ Basic authentication  
✅ Chat creation and message handling  
✅ LLM integration (single LLM)  
✅ Psychology service basics  
✅ Memory weighting system  

### Phase 2: Dual LLM Architecture (PRIORITY)
- [ ] Add LLM2 (Qwen) configuration to LLMService
- [ ] Implement async analysis pipeline
- [ ] Create StructuredResponseService for LLM2 outputs
- [ ] Update chat route to trigger async analysis
- [ ] Add analysis results to psychology state updates

### Phase 3: Proactive Intelligence (PRIORITY)
- [ ] Create ProactiveIntelligenceService
- [ ] Implement LLM2 decision prompts
- [ ] Create proactive_engagements table
- [ ] Build SchedulingService with polling worker
- [ ] Implement message delivery logic
- [ ] Add WebSocket support for real-time delivery

### Phase 4: Task & Event System
- [ ] Create tasks and events tables
- [ ] Build TaskManagementService
- [ ] Implement task creation via conversation
- [ ] Add reminder scheduling
- [ ] Build task verification flow
- [ ] Create task/event API endpoints

### Phase 5: Memory Enhancement
- [ ] Implement accessibility_score calculation
- [ ] Add memory decay algorithm
- [ ] Create recall boosting on reference
- [ ] Build memory retrieval optimization
- [ ] Add memory analytics

### Phase 6: Learning System
- [ ] Create ProactiveLearningService
- [ ] Implement pattern extraction
- [ ] Build success rate tracking
- [ ] Add learning feedback loop
- [ ] Create confidence scoring

### Phase 7: Multi-Device Polish
- [ ] Enhance WebSocket stability
- [ ] Add session management
- [ ] Implement device handoff
- [ ] Add "active device" detection
- [ ] Build reconnection handling

### Phase 8: iOS App (FUTURE)
- [ ] iOS client application
- [ ] Native push notifications
- [ ] HealthKit integration
- [ ] Calendar integration
- [ ] Native file access

---

## 9. Testing Requirements

### 9.1 Unit Tests
- All services must have unit tests
- Mock dependencies for isolation
- Test error handling paths
- Validate state management

### 9.2 Integration Tests
- Test service interactions
- Validate database operations
- Test LLM integration
- Verify async processing

### 9.3 End-to-End Tests
- Complete conversation flows
- Proactive message delivery
- Task creation and completion
- Multi-device scenarios
- Character learning over time

### 9.4 Performance Tests
- Measure response times
- Test concurrent users
- Validate memory usage
- Check database performance

---

## 10. Future Enhancements (Post-MVP)

### 10.1 Advanced Memory
- Episodic memory (remember specific events)
- Semantic memory (general knowledge about user)
- Memory consolidation (combine related memories)
- Memory visualization (show what character remembers)

### 10.2 Advanced Psychology
- Mood tracking over time
- Relationship progression metrics
- Personality drift detection
- Character development arcs

### 10.3 Enhanced Proactivity
- Multi-turn proactive conversations
- Proactive question asking
- Check-in patterns based on user schedule
- Celebration of user achievements

### 10.4 Character Collaboration
- Optional shared context between characters
- Character-to-character communication
- Group conversations
- Character recommendations

### 10.5 Analytics
- Conversation quality metrics
- Character engagement analytics
- User satisfaction tracking
- Usage pattern insights

### 10.6 Advanced Features
- Voice input/output
- Image understanding
- File attachments in conversations
- Conversation search and filtering
- Export conversation history

---

## 11. Success Criteria

### Must Have (MVP)
✅ Users can create custom characters with free-text definitions  
✅ Characters maintain conversation and respond naturally  
✅ Characters remember important information from conversations  
✅ Characters can proactively send messages when appropriate  
✅ Tasks can be assigned and tracked within conversations  
✅ Multi-device access with seamless handoff  
✅ Complete data isolation between users  

### Should Have (V1.0)
- Character personality develops based on conversations
- Proactive messages feel natural and timely
- Memory system distinguishes important vs trivial information
- Task reminders work reliably
- Characters learn from user responses

### Nice to Have (Future)
- iOS app with push notifications
- Voice interaction
- Advanced analytics
- Character collaboration features
- Memory visualization

---

## 12. Technical Debt & Known Limitations

### Current Limitations
- Single server instance (no horizontal scaling)
- SQLite (not suitable for high concurrency)
- Local LLM requirement (no cloud fallback)
- No backup/restore functionality
- Limited error recovery for failed background jobs

### Acceptable Trade-offs for Hobby Project
- No multi-server support needed
- No high-availability requirements
- Manual data backup acceptable
- Best-effort delivery for proactive messages
- Simple authentication (no OAuth, 2FA, etc.)

### Future Considerations
- If usage grows: Consider PostgreSQL migration
- If going public: Add proper authentication
- If scaling needed: Add message queue (Bull/Redis)
- If mobile-first: Optimize for mobile network conditions

---

## Appendix A: Key Architectural Decisions

### Decision 1: Dual LLM Architecture
**Rationale:** Separates user-facing communication from analytical processing. Allows each LLM to specialize and prevents analysis from slowing down user experience.

### Decision 2: Database-Backed Scheduling
**Rationale:** Simple, restart-safe, no external dependencies. Polling every 10-30 seconds is sufficient for natural conversation timing.

### Decision 3: Chat-Scoped Tasks
**Rationale:** Maintains clean separation and avoids complex cross-chat state management. Simpler to reason about and debug.

### Decision 4: Repository Layer Isolation
**Rationale:** Enforcing user_id filtering at the lowest level prevents accidental data leaks. Makes security a structural property, not a behavioral one.

### Decision 5: No Memory Deletion Initially
**Rationale:** Optimize based on real data rather than assumptions. Storage is cheap, and actual usage patterns will inform the right strategy.

### Decision 6: Server as Single Source of Truth
**Rationale:** Simplifies multi-device synchronization. Clients are thin views, reducing client-side complexity and state management.

---

**END OF REQUIREMENTS SPECIFICATION**