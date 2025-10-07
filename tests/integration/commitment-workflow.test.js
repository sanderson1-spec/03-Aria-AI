/**
 * Integration Tests for Commitment Workflow
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Tests complete commitment lifecycle with real services
 * - Tests commitment creation, submission, and verification
 * - Tests chat isolation for multi-user support
 * - Tests database persistence and state transitions
 */

const { setupServices } = require('../../setupServices');

describe('Commitment Workflow Integration', () => {
    let serviceFactory;

    beforeEach(async () => {
        // Create fresh service factory for each test
        serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });
    });

    afterEach(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
            serviceFactory = null;
        }
    });

    it('should handle character assigning commitment to user', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Step 1: Create test user and character
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `commitment_user_${timestamp}`,
            email: `commitment_${timestamp}@test.com`,
            display_name: 'Commitment Test User'
        });

        const character = await dal.personalities.createCharacter({
            id: `commitment_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Commitment Test Character',
            description: 'A character that assigns tasks and commitments'
        });

        const sessionId = `commitment_session_${timestamp}`;

        // Step 2: Simulate conversation where character assigns commitment
        await dal.conversations.saveMessage(
            sessionId,
            'user',
            'Can you help me stay accountable with my goals?',
            'chat',
            { user_id: user.id, message_type: 'text' }
        );

        await dal.conversations.saveMessage(
            sessionId,
            'assistant',
            'Of course! Let me assign you a daily journaling commitment.',
            'chat',
            { user_id: user.id, message_type: 'text' }
        );

        // Step 3: Create commitment in database
        const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'task',
            description: 'Write a daily journal entry',
            context: 'Daily journaling to track thoughts and progress',
            character_notes: 'User expressed interest in staying accountable',
            due_at: dueDate,
            status: 'active'
        });

        // Step 4: Verify commitment was created correctly
        expect(commitment).toBeDefined();
        expect(commitment.id).toBeDefined();
        expect(commitment.user_id).toBe(user.id);
        expect(commitment.chat_id).toBe(sessionId);
        expect(commitment.character_id).toBe(character.id);
        expect(commitment.commitment_type).toBe('task');
        expect(commitment.description).toBe('Write a daily journal entry');
        expect(commitment.status).toBe('active');
        expect(commitment.due_at).toBe(dueDate);
        expect(commitment.submission_content).toBeNull();
        expect(commitment.verification_result).toBeNull();

        // Step 5: Verify commitment appears in active commitments list
        const activeCommitments = await dal.commitments.getActiveCommitments(user.id, sessionId);
        expect(activeCommitments).toHaveLength(1);
        expect(activeCommitments[0].id).toBe(commitment.id);

        // Step 6: Verify proactive follow-up could be scheduled (test data setup)
        const dueSoonCommitments = await dal.commitments.getCommitmentsDueSoon(user.id, 48);
        expect(dueSoonCommitments).toHaveLength(1);
        expect(dueSoonCommitments[0].id).toBe(commitment.id);
    }, 15000);

    it('should handle user submitting commitment', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Step 1: Set up user, character, and commitment
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `submit_user_${timestamp}`,
            email: `submit_${timestamp}@test.com`,
            display_name: 'Submit Test User'
        });

        const character = await dal.personalities.createCharacter({
            id: `submit_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Submit Test Character',
            description: 'A character for testing submissions'
        });

        const sessionId = `submit_session_${timestamp}`;

        // Create initial commitment
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'task',
            description: 'Complete morning workout',
            due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            status: 'active'
        });

        expect(commitment.status).toBe('active');
        expect(commitment.submitted_at).toBeNull();

        // Step 2: User submits completion evidence
        const submissionContent = 'I completed a 30-minute workout this morning, including cardio and strength training.';
        const submitResult = await dal.commitments.submitCommitment(commitment.id, submissionContent);

        expect(submitResult).toBeDefined();
        expect(submitResult.submitted).toBe(true);

        // Step 3: Verify commitment status updated to 'submitted'
        const updatedCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(updatedCommitment).toBeDefined();
        expect(updatedCommitment.status).toBe('submitted');
        expect(updatedCommitment.submission_content).toBe(submissionContent);
        expect(updatedCommitment.submitted_at).toBeDefined();
        expect(updatedCommitment.submitted_at).not.toBeNull();

        // Step 4: Verify commitment no longer in active list
        const activeCommitments = await dal.commitments.getActiveCommitments(user.id, sessionId);
        expect(activeCommitments).toHaveLength(0);

        // Step 5: Verify submission conversation flow
        await dal.conversations.saveMessage(
            sessionId,
            'user',
            `I completed my commitment: ${submissionContent}`,
            'chat',
            { 
                user_id: user.id, 
                message_type: 'commitment_submission',
                commitment_id: commitment.id
            }
        );

        const messages = await dal.query(
            'SELECT * FROM conversation_logs WHERE chat_id = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 1',
            [sessionId, user.id]
        );

        expect(messages).toHaveLength(1);
        expect(messages[0].content).toContain(submissionContent);
    }, 15000);

    it('should handle character verifying submission', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Step 1: Set up user, character, and submitted commitment
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `verify_user_${timestamp}`,
            email: `verify_${timestamp}@test.com`,
            display_name: 'Verify Test User'
        });

        const character = await dal.personalities.createCharacter({
            id: `verify_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Verify Test Character',
            description: 'A character that verifies commitments'
        });

        const sessionId = `verify_session_${timestamp}`;

        // Create and submit commitment
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'task',
            description: 'Read 20 pages of a book',
            status: 'active'
        });

        await dal.commitments.submitCommitment(
            commitment.id,
            'I read 25 pages of "Atomic Habits" today, focusing on chapter 3 about habit formation.'
        );

        // Step 2: Character verifies the submission (positive verification)
        const verificationReasoning = 'User provided specific details about the reading material and exceeded the required pages. Excellent work!';
        const verifyResult = await dal.commitments.verifyCommitment(
            commitment.id,
            'verified',
            verificationReasoning
        );

        expect(verifyResult).toBeDefined();
        expect(verifyResult.verified).toBe(true);

        // Step 3: Verify commitment status updated to 'completed'
        const verifiedCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(verifiedCommitment).toBeDefined();
        expect(verifiedCommitment.status).toBe('completed');
        expect(verifiedCommitment.verification_result).toBe('verified');
        expect(verifiedCommitment.verification_reasoning).toBe(verificationReasoning);
        expect(verifiedCommitment.verified_at).toBeDefined();
        expect(verifiedCommitment.verified_at).not.toBeNull();

        // Step 4: Test rejection workflow
        const rejectedCommitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'task',
            description: 'Practice meditation for 10 minutes',
            status: 'active'
        });

        await dal.commitments.submitCommitment(
            rejectedCommitment.id,
            'I tried but only managed 3 minutes.'
        );

        const rejectReasoning = 'While I appreciate your honesty, you only completed 30% of the commitment. Let\'s try again tomorrow!';
        await dal.commitments.verifyCommitment(
            rejectedCommitment.id,
            'partial',
            rejectReasoning
        );

        const rejectedResult = await dal.commitments.getCommitmentById(rejectedCommitment.id);
        expect(rejectedResult.status).toBe('rejected');
        expect(rejectedResult.verification_result).toBe('partial');
        expect(rejectedResult.verification_reasoning).toBe(rejectReasoning);
    }, 15000);

    it('should maintain chat isolation for commitments', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Step 1: Create user and two characters
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `isolation_user_${timestamp}`,
            email: `isolation_${timestamp}@test.com`,
            display_name: 'Isolation Test User'
        });

        const characterA = await dal.personalities.createCharacter({
            id: `isolation_char_a_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Character A',
            description: 'First character for isolation testing'
        });

        const characterB = await dal.personalities.createCharacter({
            id: `isolation_char_b_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Character B',
            description: 'Second character for isolation testing'
        });

        const sessionA = `isolation_session_a_${timestamp}`;
        const sessionB = `isolation_session_b_${timestamp}`;

        // Step 2: Create commitments in Chat A
        const commitmentA1 = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionA,
            character_id: characterA.id,
            commitment_type: 'task',
            description: 'Complete workout routine',
            status: 'active'
        });

        const commitmentA2 = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionA,
            character_id: characterA.id,
            commitment_type: 'habit',
            description: 'Drink 8 glasses of water',
            status: 'active'
        });

        // Step 3: Create commitments in Chat B
        const commitmentB1 = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionB,
            character_id: characterB.id,
            commitment_type: 'task',
            description: 'Write blog post',
            status: 'active'
        });

        // Step 4: Verify Chat A only sees its commitments
        const commitmentsInA = await dal.commitments.getActiveCommitments(user.id, sessionA);
        expect(commitmentsInA).toHaveLength(2);
        expect(commitmentsInA.map(c => c.id)).toContain(commitmentA1.id);
        expect(commitmentsInA.map(c => c.id)).toContain(commitmentA2.id);
        expect(commitmentsInA.map(c => c.id)).not.toContain(commitmentB1.id);

        // Step 5: Verify Chat B only sees its commitments
        const commitmentsInB = await dal.commitments.getActiveCommitments(user.id, sessionB);
        expect(commitmentsInB).toHaveLength(1);
        expect(commitmentsInB[0].id).toBe(commitmentB1.id);
        expect(commitmentsInB.map(c => c.id)).not.toContain(commitmentA1.id);
        expect(commitmentsInB.map(c => c.id)).not.toContain(commitmentA2.id);

        // Step 6: Verify submission in Chat A doesn't affect Chat B
        await dal.commitments.submitCommitment(commitmentA1.id, 'Completed 30-minute workout');

        const updatedCommitmentsA = await dal.commitments.getActiveCommitments(user.id, sessionA);
        expect(updatedCommitmentsA).toHaveLength(1); // Only commitmentA2 remains active
        expect(updatedCommitmentsA[0].id).toBe(commitmentA2.id);

        const updatedCommitmentsB = await dal.commitments.getActiveCommitments(user.id, sessionB);
        expect(updatedCommitmentsB).toHaveLength(1); // Chat B unaffected
        expect(updatedCommitmentsB[0].id).toBe(commitmentB1.id);

        // Step 7: Verify direct commitment lookup maintains isolation
        const retrievedA1 = await dal.commitments.getCommitmentById(commitmentA1.id);
        expect(retrievedA1.chat_id).toBe(sessionA);
        expect(retrievedA1.character_id).toBe(characterA.id);

        const retrievedB1 = await dal.commitments.getCommitmentById(commitmentB1.id);
        expect(retrievedB1.chat_id).toBe(sessionB);
        expect(retrievedB1.character_id).toBe(characterB.id);
    }, 15000);

    it('should handle complete commitment lifecycle with proactive follow-ups', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Step 1: Set up complete scenario
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `lifecycle_user_${timestamp}`,
            email: `lifecycle_${timestamp}@test.com`,
            display_name: 'Lifecycle Test User'
        });

        const character = await dal.personalities.createCharacter({
            id: `lifecycle_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Lifecycle Character',
            description: 'A character that guides through commitment lifecycle'
        });

        const sessionId = `lifecycle_session_${timestamp}`;

        // Step 2: Initial conversation - character assigns commitment
        await dal.conversations.saveMessage(
            sessionId,
            'user',
            'I want to develop better habits',
            'chat',
            { user_id: user.id, message_type: 'text' }
        );

        await dal.conversations.saveMessage(
            sessionId,
            'assistant',
            'Great! Let me help you with that. I\'ll assign you a morning routine commitment.',
            'chat',
            { user_id: user.id, message_type: 'text' }
        );

        // Step 3: Create commitment with future due date
        const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12 hours from now
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'habit',
            description: 'Complete morning routine: exercise, meditation, and journaling',
            context: 'Building healthy morning habits',
            character_notes: 'User is motivated to improve daily routine',
            due_at: dueDate,
            status: 'active'
        });

        expect(commitment.status).toBe('active');

        // Step 4: Verify commitment appears in "due soon" queries (for proactive reminders)
        const dueSoon = await dal.commitments.getCommitmentsDueSoon(user.id, 24);
        expect(dueSoon).toHaveLength(1);
        expect(dueSoon[0].id).toBe(commitment.id);

        // Step 5: User submits completion
        const submissionContent = 'I completed my morning routine today! Did 20 minutes of exercise, 10 minutes of meditation, and wrote in my journal for 15 minutes.';
        await dal.commitments.submitCommitment(commitment.id, submissionContent);

        await dal.conversations.saveMessage(
            sessionId,
            'user',
            submissionContent,
            'chat',
            { 
                user_id: user.id, 
                message_type: 'commitment_submission',
                commitment_id: commitment.id
            }
        );

        // Verify status changed
        let updatedCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(updatedCommitment.status).toBe('submitted');

        // Step 6: Character verifies submission
        await dal.conversations.saveMessage(
            sessionId,
            'assistant',
            'Excellent work! You completed all three parts of your morning routine. This is exactly the kind of consistency that builds lasting habits!',
            'chat',
            { 
                user_id: user.id, 
                message_type: 'commitment_verification',
                commitment_id: commitment.id
            }
        );

        const verificationReasoning = 'User completed all three components with good time investment. Shows strong commitment.';
        await dal.commitments.verifyCommitment(commitment.id, 'verified', verificationReasoning);

        // Step 7: Verify final state
        updatedCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(updatedCommitment.status).toBe('completed');
        expect(updatedCommitment.verification_result).toBe('verified');
        expect(updatedCommitment.verified_at).toBeDefined();

        // Step 8: Verify complete conversation history
        const conversationHistory = await dal.query(
            'SELECT * FROM conversation_logs WHERE chat_id = ? AND user_id = ? ORDER BY timestamp ASC',
            [sessionId, user.id]
        );

        expect(conversationHistory.length).toBeGreaterThanOrEqual(4);
        
        // Verify conversation flow includes all phases
        const contentArray = conversationHistory.map(msg => msg.content);
        expect(contentArray.some(content => content.includes('develop better habits'))).toBe(true);
        expect(contentArray.some(content => content.includes('morning routine commitment'))).toBe(true);
        expect(contentArray.some(content => content.includes('completed my morning routine'))).toBe(true);
        expect(contentArray.some(content => content.includes('Excellent work'))).toBe(true);
    }, 20000);

    it('should handle commitment status transitions correctly', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Set up test data
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `status_user_${timestamp}`,
            email: `status_${timestamp}@test.com`
        });

        const character = await dal.personalities.createCharacter({
            id: `status_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Status Test Character'
        });

        const sessionId = `status_session_${timestamp}`;

        // Test transition: active -> submitted -> completed
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'task',
            description: 'Test task',
            status: 'active'
        });

        expect(commitment.status).toBe('active');

        // Transition to submitted
        await dal.commitments.submitCommitment(commitment.id, 'Completed the task');
        let current = await dal.commitments.getCommitmentById(commitment.id);
        expect(current.status).toBe('submitted');

        // Transition to completed
        await dal.commitments.verifyCommitment(commitment.id, 'verified', 'Good work');
        current = await dal.commitments.getCommitmentById(commitment.id);
        expect(current.status).toBe('completed');

        // Test transition: active -> submitted -> rejected
        const commitment2 = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'task',
            description: 'Another test task',
            status: 'active'
        });

        await dal.commitments.submitCommitment(commitment2.id, 'Partial completion');
        await dal.commitments.verifyCommitment(commitment2.id, 'partial', 'Not fully completed');
        
        current = await dal.commitments.getCommitmentById(commitment2.id);
        expect(current.status).toBe('rejected');

        // Verify status update helper method
        await dal.commitments.updateCommitmentStatus(
            commitment2.id,
            'active',
            { verification_result: null, verification_reasoning: null }
        );

        current = await dal.commitments.getCommitmentById(commitment2.id);
        expect(current.status).toBe('active');
    }, 15000);

    it('should handle error recovery gracefully', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Test getting non-existent commitment
        const nonExistent = await dal.commitments.getCommitmentById('non-existent-id');
        expect(nonExistent).toBeUndefined();

        // Test getting active commitments for user with no commitments
        const noCommitments = await dal.commitments.getActiveCommitments('fake-user', 'fake-chat');
        expect(noCommitments).toEqual([]);

        // Test getting commitments due soon with no results
        const noDue = await dal.commitments.getCommitmentsDueSoon('fake-user', 24);
        expect(noDue).toEqual([]);

        // Verify system remains functional after errors
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `error_recovery_${timestamp}`,
            email: `error_${timestamp}@test.com`
        });

        expect(user).toBeDefined();
    }, 10000);
});

