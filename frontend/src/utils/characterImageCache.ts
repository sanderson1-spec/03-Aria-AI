import { API_BASE_URL } from '../config/api';

// Cache for character images
const imageCache = new Map<string, string>();

/**
 * Get character image URL - handles uploaded images stored in DB
 * @param characterAvatar - Either a URL, path, or character-{id} reference
 * @param characterId - The character ID
 * @param userId - The user ID for authentication
 * @returns Promise<string> - The image URL (data URL for uploaded images)
 */
export async function getCharacterImageUrl(
  characterAvatar: string | undefined,
  characterId: string,
  userId: string
): Promise<string> {
  // If no avatar, return empty string
  if (!characterAvatar) {
    return '';
  }

  // If it's a full URL (http/https), return as-is
  if (characterAvatar.startsWith('http://') || characterAvatar.startsWith('https://')) {
    return characterAvatar;
  }

  // If it's a data URL, return as-is
  if (characterAvatar.startsWith('data:')) {
    return characterAvatar;
  }

  // If it's a character-{id} reference, fetch from API
  if (characterAvatar.startsWith('character-')) {
    // Check cache first
    const cacheKey = `${userId}-${characterId}`;
    if (imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey)!;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/characters/${characterId}/image?userId=${userId}`
      );
      const data = await response.json();

      if (data.success && data.data.imageUrl) {
        // Cache the image
        imageCache.set(cacheKey, data.data.imageUrl);
        return data.data.imageUrl;
      }
    } catch (error) {
      console.error('Failed to fetch character image:', error);
    }
  }

  // Default: return as-is (assume it's a path like /avatars/something)
  return characterAvatar;
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}

/**
 * Remove a specific image from cache
 */
export function removeFromCache(characterId: string, userId: string): void {
  const cacheKey = `${userId}-${characterId}`;
  imageCache.delete(cacheKey);
}

