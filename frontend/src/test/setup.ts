import '@testing-library/jest-dom'

// Mock fetch globally for tests
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Mock DOM methods that aren't available in jsdom
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
})

// Mock window.confirm
global.confirm = vi.fn(() => true)

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log/warn/error in tests
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Setup default fetch responses
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()
  
  // Reset DOM mocks
  vi.mocked(Element.prototype.scrollIntoView).mockClear()
  vi.mocked(global.confirm).mockReturnValue(true)
  
  // Default successful responses
  ;(global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  })
})
