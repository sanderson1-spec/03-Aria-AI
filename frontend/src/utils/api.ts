import { API_BASE_URL } from '../config/api';

/**
 * Make an authenticated API request
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  sessionToken?: string | null
): Promise<Response> {
  const token = sessionToken || localStorage.getItem('aria-session-token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url.startsWith('http') ? url : `${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });
}

/**
 * Make an authenticated API request and parse JSON response
 */
export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {},
  sessionToken?: string | null
): Promise<T> {
  const response = await authenticatedFetch(url, options, sessionToken);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}
