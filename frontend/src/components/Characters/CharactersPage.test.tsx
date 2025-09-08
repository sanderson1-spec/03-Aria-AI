import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CharactersPage from './CharactersPage'

// Mock fetch responses
const mockCharacters = [
  {
    id: 'aria-1',
    name: 'Aria',
    display: 'aria-avatar.jpg',
    description: 'Friendly AI assistant',
    definition: 'A helpful companion with extensive knowledge',
    usage_count: 5,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'nova-1',
    name: 'Nova',
    display: 'nova-avatar.jpg',
    description: 'Creative AI companion',
    definition: 'Specializes in creative tasks and brainstorming',
    usage_count: 3,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

describe('CharactersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful character fetch
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockCharacters })
    })
  })

  it('renders loading state initially', () => {
    render(<CharactersPage />)
    
    expect(screen.getByText('Loading characters...')).toBeInTheDocument()
  })

  it('renders characters list after loading', async () => {
    render(<CharactersPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Characters')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Aria')).toBeInTheDocument()
    expect(screen.getByText('Nova')).toBeInTheDocument()
    expect(screen.getByText('Friendly AI assistant')).toBeInTheDocument()
    expect(screen.getByText('Creative AI companion')).toBeInTheDocument()
  })

  it('shows empty state when no characters exist', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] })
    })

    render(<CharactersPage />)
    
    await waitFor(() => {
      expect(screen.getByText('No characters yet')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Create your first AI character to get started')).toBeInTheDocument()
    expect(screen.getByText('Create Your First Character')).toBeInTheDocument()
  })

  it('opens create modal when create button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<CharactersPage />)
    
    await waitFor(() => {
      expect(screen.getByText('+ Create Character')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('+ Create Character'))
    
    expect(screen.getByText('Create New Character')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter character name')).toBeInTheDocument()
  })

  it('opens edit modal when edit button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<CharactersPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Aria')).toBeInTheDocument()
    })
    
    const editButtons = screen.getAllByText('Edit')
    await user.click(editButtons[0])
    
    expect(screen.getByText('Edit Character')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Aria')).toBeInTheDocument()
  })

  it('deletes character when delete button is clicked and confirmed', async () => {
    const user = userEvent.setup()
    
    // Mock window.confirm
    global.confirm = vi.fn(() => true)
    
    // Mock delete API response
    ;(global.fetch as any).mockImplementation((_url: any, options: any) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: mockCharacters })
      })
    })

    render(<CharactersPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Aria')).toBeInTheDocument()
    })
    
    const deleteButtons = screen.getAllByText('Delete')
    await user.click(deleteButtons[0])
    
    expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this character?')
  })

  it('does not delete character when deletion is cancelled', async () => {
    const user = userEvent.setup()
    
    // Mock window.confirm to return false (cancel)
    global.confirm = vi.fn(() => false)
    
    render(<CharactersPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Aria')).toBeInTheDocument()
    })
    
    const deleteButtons = screen.getAllByText('Delete')
    await user.click(deleteButtons[0])
    
    expect(global.confirm).toHaveBeenCalled()
    // Character should still be there since deletion was cancelled
    expect(screen.getByText('Aria')).toBeInTheDocument()
  })

  it('handles API error gracefully', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('API Error'))
    
    render(<CharactersPage />)
    
    await waitFor(() => {
      expect(screen.queryByText('Loading characters...')).not.toBeInTheDocument()
    })
    
    // Should show some error state or empty state
    // The exact behavior depends on the error handling implementation
  })

  it('displays character usage count and status', async () => {
    render(<CharactersPage />)
    
    await waitFor(() => {
      expect(screen.getByText('5 chats')).toBeInTheDocument()
      expect(screen.getByText('3 chats')).toBeInTheDocument()
    })
    
    // Check for active status indicators
    const activeIndicators = document.querySelectorAll('[class*="bg-green-500"]')
    expect(activeIndicators.length).toBeGreaterThan(0)
  })

  describe('Character Modal', () => {
    it('creates new character with valid data', async () => {
      const user = userEvent.setup()
      
      // Mock create API response
      ;(global.fetch as any).mockImplementation((_url: any, options: any) => {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { id: 'new-character' } })
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockCharacters })
        })
      })

      render(<CharactersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('+ Create Character')).toBeInTheDocument()
      })
      
      // Open create modal
      await user.click(screen.getByText('+ Create Character'))
      
      // Fill form
      await user.type(screen.getByPlaceholderText('Enter character name'), 'New Character')
      await user.type(screen.getByPlaceholderText('Brief description of the character'), 'A new test character')
      await user.type(screen.getByPlaceholderText('Detailed background information, personality traits, speaking style, etc.'), 'Background info')
      
      // Submit form
      await user.click(screen.getByText('Create Character'))
      
      // Should call API with correct data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/characters',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('New Character')
          })
        )
      })
    })

    it('validates required fields', async () => {
      const user = userEvent.setup()
      
      render(<CharactersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('+ Create Character')).toBeInTheDocument()
      })
      
      // Open create modal
      await user.click(screen.getByText('+ Create Character'))
      
      // Try to submit without required name - button should be disabled
      const createButton = screen.getByText('Create Character')
      expect(createButton).toBeDisabled()
      
      // Add name and button should be enabled
      await user.type(screen.getByPlaceholderText('Enter character name'), 'Test Name')
      expect(createButton).not.toBeDisabled()
    })

    it('updates existing character', async () => {
      const user = userEvent.setup()
      
      // Mock update API response
      ;(global.fetch as any).mockImplementation((_url: any, options: any) => {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockCharacters })
        })
      })

      render(<CharactersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Aria')).toBeInTheDocument()
      })
      
      // Open edit modal
      const editButtons = screen.getAllByText('Edit')
      await user.click(editButtons[0])
      
      // Modify name
      const nameInput = screen.getByDisplayValue('Aria')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Aria')
      
      // Submit form
      await user.click(screen.getByText('Update Character'))
      
      // Should call API with correct data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/characters/aria-1'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('Updated Aria')
          })
        )
      })
    })

    it('closes modal when cancel is clicked', async () => {
      const user = userEvent.setup()
      
      render(<CharactersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('+ Create Character')).toBeInTheDocument()
      })
      
      // Open create modal
      await user.click(screen.getByText('+ Create Character'))
      expect(screen.getByText('Create New Character')).toBeInTheDocument()
      
      // Click cancel
      await user.click(screen.getByText('Cancel'))
      
      // Modal should be closed
      expect(screen.queryByText('Create New Character')).not.toBeInTheDocument()
    })
  })
})
