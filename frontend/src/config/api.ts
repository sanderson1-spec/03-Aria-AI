/**
 * API Configuration
 * 
 * This file handles API base URL configuration for different environments.
 * When accessing from a mobile device, you'll need to use your computer's
 * local IP address instead of localhost.
 */

// Helper to detect if we're likely on a mobile device accessing from network
const isLikelyMobileDevice = () => {
  const hostname = window.location.hostname;
  // If hostname is not localhost/127.0.0.1, assume we're on a real device
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
};

// Get the API base URL
export const getApiBaseUrl = (): string => {
  // Check if API_BASE_URL is set in environment
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // If accessing from network (mobile device), use the current hostname with API port
  if (isLikelyMobileDevice()) {
    const hostname = window.location.hostname;
    return `http://${hostname}:3001`;
  }

  // Default to localhost for local development
  return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();
