/**
 * Integration Tests for Task Verification Workflow
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Tests complete verification lifecycle with real services
 * - Tests LLM-driven verification with mocked responses
 * - Tests all verification outcomes (approved, needs_revision, rejected, not_verifiable)
 * - Tests revision workflow and timing analysis
 * - Tests character personality in verification feedback
 */

const { setupServices } = require('../../setupServices');

describe('Task Verification Workflow Integration', () => {
    let serviceFactory;
    let mockLLMResponses = new Map();

    beforeEach(async () => {
        // Create fresh service factory for each test
        serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });

        // Mock StructuredResponseService to return predefined responses
        const structuredResponseService = serviceFactory.get('structuredResponse');
        const originalGenerateStructuredResponse = structuredResponseService.generateStructuredResponse.bind(structuredResponseService);
        
        structuredResponseService.generateStructuredResponse = jest.fn(async (prompt, schema, options) => {
            // Check if we have a mocked response for this test
            const mockResponse = mockLLMResponses.get('current');
            
            if (mockResponse) {
                return mockResponse;
            }
            
            // Fallback to original implementation
            return originalGenerateStructuredResponse(prompt, schema, options);
        });
    });

    afterEach(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
            serviceFactory = null;
        }
        mockLLMResponses.clear();
    });

    it('Scenario A: Verifiable Task - Approved', async () => {
        const dal = serviceFactory.get('database').getDAL();
        const taskVerification = serviceFactory.get('taskVerification');

        // Step 1: Set up user and Spanish teacher character
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `spanish_user_${timestamp}`,
            email: `spanish_${timestamp}@test.com`,
            display_name: 'Spanish Student'
        });

        const character = await dal.personalities.createCharacter({
            id: `spanish_teacher_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'María',
            display: 'Spanish Teacher',
            description: 'A friendly Spanish teacher who helps students learn',
            personality_traits: JSON.stringify(['patient', 'encouraging', 'detail-oriented'])
        });

        const sessionId = `spanish_session_${timestamp}`;

        // Step 2: Create commitment for Spanish writing task
        const assignedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'language_practice',
            description: 'Write 5 sentences in Spanish about your day',
            context: 'Spanish writing practice',
            assigned_at: assignedAt,
            status: 'active'
        });

        // Step 3: User submits correct Spanish text
        const submissionContent = 'Hoy fue un día maravilloso. Me desperté temprano y desayuné café con tostadas. Trabajé en mi oficina toda la mañana. Por la tarde, salí a caminar por el parque. Finalmente, cociné una deliciosa cena con mi familia.';
        
        // Submit commitment
        const submittedCommitment = await dal.commitments.submitCommitment(commitment.id, submissionContent);
        expect(submittedCommitment.status).toBe('submitted');
        expect(submittedCommitment.verification_requested_at).toBeDefined();

        // Step 4: Mock LLM response for approval
        mockLLMResponses.set('current', {
            is_verifiable: true,
            verification_decision: 'approved',
            character_feedback: '¡Excelente trabajo! Your sentences are grammatically correct and show good vocabulary use. I particularly like how you used "maravilloso" and "deliciosa" - great descriptive words! Keep up this excellent work! 🎉',
            reasoning: 'User submitted exactly 5 sentences in Spanish with correct grammar, proper accents, and varied vocabulary. The content is coherent and demonstrates understanding of past tense verbs.',
            timing_assessment: 'plausible',
            quality_assessment: 'excellent',
            detected_ai_generation: false
        });

        // Step 5: Run verification
        const verificationResult = await taskVerification.verifySubmission(commitment.id, user.id);

        // Step 6: Verify results
        expect(verificationResult).toBeDefined();
        expect(verificationResult.success).toBe(true);
        expect(verificationResult.verification.decision).toBe('approved');
        expect(verificationResult.verification.feedback).toContain('Excelente');
        expect(verificationResult.verification.isVerifiable).toBe(true);
        expect(verificationResult.verification.timingAssessment).toBe('plausible');
        expect(verificationResult.verification.qualityAssessment).toBe('excellent');

        // Step 7: Verify database state
        const verifiedCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(verifiedCommitment.status).toBe('completed');
        expect(verifiedCommitment.verification_decision).toBe('approved');
        expect(verifiedCommitment.verification_result).toContain('Excelente');
        expect(verifiedCommitment.verified_at).toBeDefined();
        expect(verifiedCommitment.revision_count).toBe(0);

        // Step 8: Verify character's name appears in response
        expect(verificationResult.character).toBeDefined();
        expect(verificationResult.character.name).toBe('María');
    }, 20000);

    it('Scenario B: Verifiable Task - Needs Revision with Resubmission', async () => {
        const dal = serviceFactory.get('database').getDAL();
        const taskVerification = serviceFactory.get('taskVerification');

        // Step 1: Set up user and character
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `revision_user_${timestamp}`,
            email: `revision_${timestamp}@test.com`,
            display_name: 'Revision Test User'
        });

        const character = await dal.personalities.createCharacter({
            id: `revision_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Professor Chen',
            display: 'Writing Coach',
            description: 'A thorough writing coach who provides detailed feedback',
            personality_traits: JSON.stringify(['meticulous', 'constructive', 'supportive'])
        });

        const sessionId = `revision_session_${timestamp}`;

        // Step 2: Create commitment
        const assignedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'writing',
            description: 'Write a 200-word essay about climate change',
            assigned_at: assignedAt,
            status: 'active'
        });

        // Step 3: First submission - subpar work
        const firstSubmission = 'Climate change is bad. It makes the weather hot. We should do something about it. The end.';
        
        await dal.commitments.submitCommitment(commitment.id, firstSubmission);

        // Step 4: Mock LLM response for needs_revision
        mockLLMResponses.set('current', {
            is_verifiable: true,
            verification_decision: 'needs_revision',
            character_feedback: 'I can see you understand the topic, but this needs more development. Your essay is only 22 words, not 200. Please expand on:\n\n1. Specific causes of climate change\n2. Real-world impacts\n3. Potential solutions\n\nAdd examples and details. You can do better than this! 📝',
            reasoning: 'Submission is far too short (22 words vs 200 required). Lacks depth, examples, and structured argumentation. Shows minimal effort.',
            timing_assessment: 'too_fast',
            quality_assessment: 'poor',
            detected_ai_generation: false
        });

        // Step 5: First verification
        const firstResult = await taskVerification.verifySubmission(commitment.id, user.id);

        expect(firstResult.success).toBe(true);
        expect(firstResult.verification.decision).toBe('needs_revision');
        expect(firstResult.verification.qualityAssessment).toBe('poor');

        // Verify database state after first submission
        let currentCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(currentCommitment.status).toBe('needs_revision');
        expect(currentCommitment.revision_count).toBe(1);

        // Step 6: Save revision feedback to conversation
        await dal.conversations.saveMessage(
            sessionId,
            'assistant',
            firstResult.verification.feedback,
            'chat',
            { 
                user_id: user.id,
                message_type: 'verification_feedback',
                commitment_id: commitment.id
            }
        );

        // Step 7: Second submission - improved work
        const secondSubmission = `Climate change is one of the most pressing challenges of our time, caused primarily by human activities that release greenhouse gases into the atmosphere. The burning of fossil fuels for energy, deforestation, and industrial processes contribute significantly to rising global temperatures.

The impacts are already visible worldwide: melting polar ice caps, rising sea levels, more frequent extreme weather events, and disruption of ecosystems. These changes threaten food security, water availability, and human health across all continents.

However, solutions exist. Transitioning to renewable energy sources like solar and wind power can reduce emissions dramatically. Protecting and restoring forests helps absorb carbon dioxide. Individual actions matter too: reducing consumption, using public transportation, and supporting sustainable practices all contribute to positive change.

Addressing climate change requires global cooperation and immediate action. The choices we make today will determine the world we leave for future generations. While the challenge is immense, human innovation and determination give us hope for a sustainable future.`;

        // Update submission with new content
        await dal.execute(
            'UPDATE commitments SET submission_content = ?, submitted_at = ?, status = ?, verification_requested_at = ?, updated_at = ? WHERE id = ?',
            [secondSubmission, new Date().toISOString(), 'submitted', new Date().toISOString(), new Date().toISOString(), commitment.id]
        );

        // Step 8: Mock LLM response for approval
        mockLLMResponses.set('current', {
            is_verifiable: true,
            verification_decision: 'approved',
            character_feedback: 'Excellent improvement! Your essay now has depth, structure, and concrete examples. You addressed all my feedback points:\n\n✅ Specific causes explained\n✅ Real-world impacts detailed\n✅ Solutions proposed\n\nThe word count is appropriate (~200 words), and your writing flows well. This is exactly the kind of revision I was hoping to see. Great work! 🌟',
            reasoning: 'Second submission shows significant improvement. Essay is well-structured with proper length (~200 words), includes specific examples, and demonstrates understanding of the topic. Clear evidence of learning from feedback.',
            timing_assessment: 'plausible',
            quality_assessment: 'good',
            detected_ai_generation: false
        });

        // Step 9: Second verification
        const secondResult = await taskVerification.verifySubmission(commitment.id, user.id);

        expect(secondResult.success).toBe(true);
        expect(secondResult.verification.decision).toBe('approved');
        expect(secondResult.verification.feedback).toContain('Excellent improvement');
        expect(secondResult.verification.qualityAssessment).toBe('good');

        // Step 10: Verify final database state
        currentCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(currentCommitment.status).toBe('completed');
        expect(currentCommitment.verification_decision).toBe('approved');
        expect(currentCommitment.revision_count).toBe(1); // Should still be 1, not incremented on approval

        // Step 11: Verify conversation history includes both verifications
        const messages = await dal.query(
            'SELECT * FROM conversation_logs WHERE chat_id = ? AND user_id = ? ORDER BY timestamp ASC',
            [sessionId, user.id]
        );

        expect(messages.length).toBeGreaterThanOrEqual(1);
    }, 25000);

    it('Scenario C: Verifiable Task - Rejected', async () => {
        const dal = serviceFactory.get('database').getDAL();
        const taskVerification = serviceFactory.get('taskVerification');

        // Step 1: Set up user and strict character
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `reject_user_${timestamp}`,
            email: `reject_${timestamp}@test.com`,
            display_name: 'Reject Test User'
        });

        const character = await dal.personalities.createCharacter({
            id: `strict_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Dr. Williams',
            display: 'Strict Professor',
            description: 'A demanding professor with high standards',
            personality_traits: JSON.stringify(['strict', 'precise', 'uncompromising'])
        });

        const sessionId = `reject_session_${timestamp}`;

        // Step 2: Create commitment
        const assignedAt = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'academic',
            description: 'Solve 10 calculus problems from Chapter 5',
            assigned_at: assignedAt,
            status: 'active'
        });

        // Step 3: User submits completely wrong work
        const submissionContent = 'I looked at the problems but they were too hard. I tried problem 1 and got x=5 but I\'m not sure if that\'s right. Didn\'t attempt the rest.';
        
        await dal.commitments.submitCommitment(commitment.id, submissionContent);

        // Step 4: Mock LLM response for rejection
        mockLLMResponses.set('current', {
            is_verifiable: true,
            verification_decision: 'rejected',
            character_feedback: 'This is unacceptable. You were assigned 10 problems and attempted only one - incompletely. The answer "x=5" shows no work or reasoning.\n\nThis commitment required genuine effort, not excuses. I cannot accept this submission. You need to take these assignments seriously if you want to succeed in this course.\n\nPlease see me during office hours to discuss your approach to the material.',
            reasoning: 'Student attempted only 1 of 10 required problems. No work shown, no methodology demonstrated. Submission indicates lack of effort rather than lack of understanding. This does not meet minimum requirements.',
            timing_assessment: 'plausible',
            quality_assessment: 'unacceptable',
            detected_ai_generation: false
        });

        // Step 5: Run verification
        const verificationResult = await taskVerification.verifySubmission(commitment.id, user.id);

        // Step 6: Verify results
        expect(verificationResult.success).toBe(true);
        expect(verificationResult.verification.decision).toBe('rejected');
        expect(verificationResult.verification.feedback).toContain('unacceptable');
        expect(verificationResult.verification.qualityAssessment).toBe('unacceptable');

        // Step 7: Verify database state
        const rejectedCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(rejectedCommitment.status).toBe('rejected');
        expect(rejectedCommitment.verification_decision).toBe('rejected');
        expect(rejectedCommitment.verified_at).toBeDefined();

        // Step 8: Verify character's strict personality reflected in feedback
        expect(verificationResult.character.name).toBe('Dr. Williams');
        expect(verificationResult.verification.feedback).toMatch(/unacceptable|not acceptable|cannot accept/i);
    }, 20000);

    it('Scenario D: Non-Verifiable Task', async () => {
        const dal = serviceFactory.get('database').getDAL();
        const taskVerification = serviceFactory.get('taskVerification');

        // Step 1: Set up user and supportive character
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `walk_user_${timestamp}`,
            email: `walk_${timestamp}@test.com`,
            display_name: 'Walk Test User'
        });

        const character = await dal.personalities.createCharacter({
            id: `wellness_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Wellness Coach Amy',
            display: 'Wellness Coach',
            description: 'A supportive wellness coach focused on healthy habits',
            personality_traits: JSON.stringify(['supportive', 'understanding', 'motivational'])
        });

        const sessionId = `walk_session_${timestamp}`;

        // Step 2: Create commitment for physical activity
        const assignedAt = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'wellness',
            description: 'Go for a 20-minute walk outside',
            assigned_at: assignedAt,
            status: 'active'
        });

        // Step 3: User submits
        const submissionContent = 'I went for a walk in the park for about 25 minutes. The weather was nice and I felt refreshed afterwards.';
        
        await dal.commitments.submitCommitment(commitment.id, submissionContent);

        // Step 4: Mock LLM response for not_verifiable
        mockLLMResponses.set('current', {
            is_verifiable: false,
            verification_decision: 'not_verifiable',
            character_feedback: 'Thank you for sharing! While I can\'t physically verify that you went for a walk, I trust your word. 🚶‍♀️\n\nPhysical activities like walks are hard for me to verify since I can\'t see photos or track your steps. But I believe in the honor system here - if you say you did it, that\'s good enough for me!\n\nHow did the walk make you feel? Did you notice any benefits from getting outside?',
            reasoning: 'Physical activity commitment cannot be verified remotely without fitness tracker data or photos. This type of task relies on user honesty. The submission sounds genuine and includes experiential details.',
            timing_assessment: 'plausible',
            quality_assessment: 'acceptable',
            detected_ai_generation: false
        });

        // Step 5: Run verification
        const verificationResult = await taskVerification.verifySubmission(commitment.id, user.id);

        // Step 6: Verify results
        expect(verificationResult.success).toBe(true);
        expect(verificationResult.verification.decision).toBe('not_verifiable');
        expect(verificationResult.verification.isVerifiable).toBe(false);
        expect(verificationResult.verification.feedback).toContain('trust your word');
        expect(verificationResult.verification.feedback).toMatch(/honor system|can't verify|cannot verify/i);

        // Step 7: Verify database state - should be marked as not_verifiable (honor system)
        const completedCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(completedCommitment.status).toBe('not_verifiable');
        expect(completedCommitment.verification_decision).toBe('not_verifiable');
        expect(completedCommitment.verified_at).toBeDefined();

        // Step 8: Verify character's supportive tone
        expect(verificationResult.character.name).toBe('Wellness Coach Amy');
        expect(verificationResult.verification.feedback).toMatch(/trust|believe/i);
    }, 20000);

    it('Scenario E: Timing Plausibility Detection', async () => {
        const dal = serviceFactory.get('database').getDAL();
        const taskVerification = serviceFactory.get('taskVerification');

        // Step 1: Set up user and character
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `timing_user_${timestamp}`,
            email: `timing_${timestamp}@test.com`,
            display_name: 'Timing Test User'
        });

        const character = await dal.personalities.createCharacter({
            id: `timing_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Ms. Rodriguez',
            display: 'English Teacher',
            description: 'An experienced English teacher',
            personality_traits: JSON.stringify(['observant', 'fair', 'thorough'])
        });

        const sessionId = `timing_session_${timestamp}`;

        // Step 2: Create commitment assigned 6 minutes ago
        const assignedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 minutes ago
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'writing',
            description: 'Write a 500-word essay analyzing the themes in "To Kill a Mockingbird"',
            assigned_at: assignedAt,
            status: 'active'
        });

        // Step 3: User submits suspiciously quickly
        const submissionContent = `To Kill a Mockingbird, written by Harper Lee, explores several profound themes that remain relevant today. The most prominent theme is racial injustice, exemplified through Tom Robinson's trial. Despite clear evidence of his innocence, Tom is convicted solely because of his race, highlighting the deeply ingrained prejudice in Maycomb society.

Another central theme is the loss of innocence. Scout and Jem begin the novel with naive perceptions of their world, believing in the inherent goodness of people. Through their father Atticus's defense of Tom Robinson and their encounters with Boo Radley, they learn that the world contains both good and evil, and that moral courage sometimes means standing alone.

The theme of moral education is embodied in Atticus Finch, who teaches his children to consider situations from others' perspectives. His famous quote about walking in someone else's shoes demonstrates the importance of empathy and understanding in combating prejudice.

Class and social hierarchy also play significant roles. The Finch family's position allows them certain privileges, while families like the Ewells represent how poverty and ignorance can perpetuate cycles of hatred and violence.

Finally, the symbolism of the mockingbird itself - representing innocence and the idea that it's sinful to harm those who only bring beauty into the world - ties together these themes, particularly in the characters of Tom Robinson and Boo Radley.`;
        
        await dal.commitments.submitCommitment(commitment.id, submissionContent);

        // Step 4: Mock LLM response flagging suspicious timing
        mockLLMResponses.set('current', {
            is_verifiable: true,
            verification_decision: 'needs_revision',
            character_feedback: 'I notice you submitted this 500-word literary analysis just 6 minutes after I assigned it. That\'s... remarkably fast. 🤔\n\nWhile your essay covers the main themes and is well-structured, I\'m concerned about the timing. A thoughtful analysis of this depth typically requires:\n- 10-15 minutes to organize thoughts\n- 20-30 minutes to write\n- 5-10 minutes to revise\n\nI\'d like you to add:\n1. Specific quotes from the text to support your points\n2. Personal reflection on how these themes connect to modern issues\n\nThis will demonstrate deeper engagement with the material.',
            reasoning: 'Essay quality is good, but timing is highly suspicious. 500 words of literary analysis in 6 minutes suggests possible use of AI or pre-written material. Requesting revision with specific evidence to ensure authentic student work.',
            timing_assessment: 'too_fast',
            quality_assessment: 'good',
            detected_ai_generation: true
        });

        // Step 5: Run verification
        const verificationResult = await taskVerification.verifySubmission(commitment.id, user.id);

        // Step 6: Verify results emphasize timing concerns
        expect(verificationResult.success).toBe(true);
        expect(verificationResult.verification.decision).toBe('needs_revision');
        expect(verificationResult.verification.timingAssessment).toBe('too_fast');
        expect(verificationResult.verification.feedback).toMatch(/6 minutes|remarkably fast|timing|suspicious/i);

        // Step 7: Verify database state
        const currentCommitment = await dal.commitments.getCommitmentById(commitment.id);
        expect(currentCommitment.status).toBe('needs_revision');
        expect(currentCommitment.revision_count).toBe(1);

        // Step 8: Verify timing is calculated and mentioned
        expect(verificationResult.verification.timingAssessment).toBeDefined();
        expect(['too_fast', 'suspicious']).toContain(verificationResult.verification.timingAssessment);
    }, 20000);

    it('should handle verification with full context including psychology and conversation', async () => {
        const dal = serviceFactory.get('database').getDAL();
        const taskVerification = serviceFactory.get('taskVerification');

        // Step 1: Set up complete scenario
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `context_user_${timestamp}`,
            email: `context_${timestamp}@test.com`,
            display_name: 'Context Test User'
        });

        const character = await dal.personalities.createCharacter({
            id: `context_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Mentor Alex',
            display: 'Programming Mentor',
            description: 'A patient programming mentor',
            personality_traits: JSON.stringify(['patient', 'encouraging', 'technical'])
        });

        const sessionId = `context_session_${timestamp}`;

        // Step 2: Create conversation history
        await dal.conversations.saveMessage(
            sessionId,
            'user',
            'I want to learn Python better',
            'chat',
            { user_id: user.id }
        );

        await dal.conversations.saveMessage(
            sessionId,
            'assistant',
            'Great! Let me give you a coding exercise to practice loops and conditionals.',
            'chat',
            { user_id: user.id }
        );

        // Step 3: Create commitment with context
        const assignedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: sessionId,
            character_id: character.id,
            commitment_type: 'coding',
            description: 'Write a Python function that prints the Fibonacci sequence up to n terms',
            assigned_at: assignedAt,
            status: 'active'
        });

        // Step 4: Submit solution
        const submissionContent = `def fibonacci(n):
    a, b = 0, 1
    for i in range(n):
        print(a)
        a, b = b, a + b

fibonacci(10)`;
        
        await dal.commitments.submitCommitment(commitment.id, submissionContent);

        // Step 5: Mock LLM response
        mockLLMResponses.set('current', {
            is_verifiable: true,
            verification_decision: 'approved',
            character_feedback: 'Perfect solution! ✨ Your code:\n\n✅ Uses correct Fibonacci logic\n✅ Implements clean variable swapping\n✅ Prints each term as requested\n✅ Works correctly for n=10\n\nYou clearly understand loops and the Fibonacci sequence. Ready for the next challenge?',
            reasoning: 'Code is correct, efficient, and demonstrates understanding of the assignment. Clean implementation with proper variable names.',
            timing_assessment: 'plausible',
            quality_assessment: 'excellent',
            detected_ai_generation: false
        });

        // Step 6: Run verification
        const verificationResult = await taskVerification.verifySubmission(commitment.id, user.id);

        // Step 7: Verify complete result structure
        expect(verificationResult).toBeDefined();
        expect(verificationResult.success).toBe(true);
        expect(verificationResult.verification.decision).toBe('approved');
        expect(verificationResult.verification.feedback).toBeDefined();
        expect(verificationResult.character).toBeDefined();
        expect(verificationResult.character.name).toBe('Mentor Alex');
        expect(verificationResult.verification.timingAssessment).toBeDefined();
        expect(verificationResult.verification.qualityAssessment).toBe('excellent');

        // Step 8: Verify enriched commitment data was fetched
        const enrichedCommitment = await dal.commitments.getCommitmentWithContext(commitment.id);
        expect(enrichedCommitment).toBeDefined();
        expect(enrichedCommitment.character).toBeDefined();
        expect(enrichedCommitment.assignmentContext).toBeDefined();
        expect(enrichedCommitment.assignmentContext.messages.length).toBeGreaterThan(0);
    }, 20000);

    it('should handle error recovery gracefully', async () => {
        const dal = serviceFactory.get('database').getDAL();
        const taskVerification = serviceFactory.get('taskVerification');

        // Test verification of non-existent commitment
        await expect(
            taskVerification.verifySubmission('non-existent-id', 'fake-user')
        ).rejects.toThrow();

        // Test verification without user context
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `error_user_${timestamp}`,
            email: `error_${timestamp}@test.com`
        });

        const character = await dal.personalities.createCharacter({
            id: `error_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Error Test Character'
        });

        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: 'error_session',
            character_id: character.id,
            commitment_type: 'task',
            description: 'Test task',
            status: 'active'
        });

        // Try to verify without submitting first (should fail gracefully)
        await expect(
            taskVerification.verifySubmission(commitment.id, user.id)
        ).rejects.toThrow();
    }, 15000);

    it('should verify revision_count increments correctly', async () => {
        const dal = serviceFactory.get('database').getDAL();

        // Set up user and character
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `revcount_user_${timestamp}`,
            email: `revcount_${timestamp}@test.com`
        });

        const character = await dal.personalities.createCharacter({
            id: `revcount_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Rev Count Character'
        });

        const commitment = await dal.commitments.createCommitment({
            user_id: user.id,
            chat_id: 'revcount_session',
            character_id: character.id,
            commitment_type: 'task',
            description: 'Test task',
            status: 'active'
        });

        // Initial revision_count should be 0
        let current = await dal.commitments.getCommitmentById(commitment.id);
        expect(current.revision_count).toBe(0);

        // Submit and request revision
        await dal.commitments.submitCommitment(commitment.id, 'First attempt');
        await dal.commitments.recordVerification(commitment.id, {
            verification_decision: 'needs_revision',
            verification_result: 'Needs work',
            verification_reasoning: 'Not good enough'
        });

        current = await dal.commitments.getCommitmentById(commitment.id);
        expect(current.revision_count).toBe(1);
        expect(current.status).toBe('needs_revision');

        // Request another revision
        await dal.commitments.recordVerification(commitment.id, {
            verification_decision: 'needs_revision',
            verification_result: 'Still needs work',
            verification_reasoning: 'Better but not there yet'
        });

        current = await dal.commitments.getCommitmentById(commitment.id);
        expect(current.revision_count).toBe(2);

        // Approve - revision_count should not increment
        await dal.commitments.recordVerification(commitment.id, {
            verification_decision: 'approved',
            verification_result: 'Good work',
            verification_reasoning: 'Meets requirements'
        });

        current = await dal.commitments.getCommitmentById(commitment.id);
        expect(current.revision_count).toBe(2); // Should stay at 2
        expect(current.status).toBe('completed');
    }, 15000);
});

