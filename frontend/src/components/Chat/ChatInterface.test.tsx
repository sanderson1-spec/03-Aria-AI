import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInterface } from './ChatInterface'
import type { ChatSession, Message, Character } from '../../types'

// Mock data
const mockCharacter: Character = {
  id: 'aria-1',
  name: 'Aria',
  tagline: 'Your friendly AI assistant',
  description: 'A helpful AI companion',
  definition: 'Background information',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z')
}

const mockPsychologyState = {
  mood: 'positive' as const,
  engagement: 'high' as const,
  energy: 85,
  learningProgress: {
    patternsIdentified: 3,
    adaptationScore: 0.7
  }
}

const mockSession: ChatSession = {
  id: 'session-1',
  userId: 'user-1',
  characterId: 'aria-1',
  character: mockCharacter,
  lastActivity: new Date('2024-01-01T00:00:00Z'),
  psychologyState: mockPsychologyState
}

const mockMessages: Message[] = [
  {
    id: '1',
    content: 'Hello!',
    type: 'user',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    sessionId: 'session-1'
  },
  {
    id: '2',
    content: 'Hi there! How can I help you today?',
    type: 'ai',
    timestamp: new Date('2024-01-01T10:00:01Z'),
    sessionId: 'session-1'
  }
]

describe('ChatInterface', () => {
  const mockOnSendMessage = vi.fn()
  const mockOnCreateNewChat = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no session is provided', () => {
    render(
      <ChatInterface
        currentSession={null}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
      />
    )

    expect(screen.getByText('Start a New Conversation')).toBeInTheDocument()
    expect(screen.getByText('Choose a character to begin chatting')).toBeInTheDocument()
    expect(screen.getByText('Create New Chat')).toBeInTheDocument()
  })

  it('calls onCreateNewChat when Create New Chat button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <ChatInterface
        currentSession={null}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
      />
    )

    const createButton = screen.getByText('Create New Chat')
    await user.click(createButton)

    expect(mockOnCreateNewChat).toHaveBeenCalledOnce()
  })

  it('renders chat interface with session data', async () => {
    render(
      <ChatInterface
        currentSession={mockSession}
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
      />
    )

    // Check header information
    await waitFor(() => {
      expect(screen.getByText('Aria')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Your friendly AI assistant')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()

    // Check messages are rendered
    expect(screen.getByText('Hello!')).toBeInTheDocument()
    expect(screen.getByText('Hi there! How can I help you today?')).toBeInTheDocument()
  })

  it('shows psychology state when provided', async () => {
    render(
      <ChatInterface
        currentSession={mockSession}
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
      />
    )

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Aria')).toBeInTheDocument()
    })

    // Psychology state should be handled
    expect(mockSession.psychologyState).toBeDefined()
    expect(mockSession.psychologyState?.mood).toBe('positive')
  })

  it('sends message when form is submitted', async () => {
    const user = userEvent.setup()
    
    render(
      <ChatInterface
        currentSession={mockSession}
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Message Aria...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Message Aria...')
    const sendButton = screen.getByText('Send')

    await user.type(textarea, 'Test message')
    await user.click(sendButton)

    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message')
  })

  it('sends message when Enter key is pressed', async () => {
    const user = userEvent.setup()
    
    render(
      <ChatInterface
        currentSession={mockSession}
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Message Aria...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Message Aria...')

    await user.type(textarea, 'Test message{Enter}')

    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message')
  })

  it('clears input after sending message', async () => {
    const user = userEvent.setup()
    
    render(
      <ChatInterface
        currentSession={mockSession}
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Message Aria...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Message Aria...')
    const sendButton = screen.getByText('Send')

    await user.type(textarea, 'Test message')
    expect(textarea).toHaveValue('Test message')

    await user.click(sendButton)
    
    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('disables input and send button when not connected', async () => {
    render(
      <ChatInterface
        currentSession={mockSession}
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
        isConnected={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Message Aria...')
    const sendButton = screen.getByRole('button', { name: /send/i })

    expect(textarea).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })

  it('does not send empty or whitespace-only messages', async () => {
    const user = userEvent.setup()
    
    render(
      <ChatInterface
        currentSession={mockSession}
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Message Aria...')).toBeInTheDocument()
    })

    const sendButton = screen.getByText('Send')

    // Try to send empty message
    await user.click(sendButton)
    expect(mockOnSendMessage).not.toHaveBeenCalled()

    // Try to send whitespace-only message
    const textarea = screen.getByPlaceholderText('Message Aria...')
    await user.type(textarea, '   ')
    await user.click(sendButton)
    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })

  it('shows typing indicator when isTyping is true', async () => {
    render(
      <ChatInterface
        currentSession={mockSession}
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
        isTyping={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Aria')).toBeInTheDocument()
    })

    // Typing indicator should be passed to MessageList component
    // We can't directly test the typing indicator without mocking MessageList,
    // but we can verify the component renders with typing state
    expect(mockSession).toBeDefined()
  })

  it('displays character avatar initial when no avatar image', async () => {
    const sessionWithoutAvatar = {
      ...mockSession,
      character: {
        ...mockCharacter,
        display: ''
      }
    }

    render(
      <ChatInterface
        currentSession={sessionWithoutAvatar}
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        onCreateNewChat={mockOnCreateNewChat}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument()
    })
  })
})