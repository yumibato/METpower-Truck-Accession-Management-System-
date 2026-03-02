/**
 * Safe localStorage utility module
 * Handles quota exceeded errors, SSR compatibility, and corruption
 */

/**
 * Safely get an item from localStorage with JSON parsing
 * @param {string} key - The localStorage key
 * @param {T} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {T} - The parsed value or default value
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    // Check if localStorage is available (SSR compatibility)
    if (typeof window === 'undefined' || !window.localStorage) {
      return defaultValue;
    }

    const item = localStorage.getItem(key);
    
    if (item === null) {
      return defaultValue;
    }

    // Try to parse as JSON
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Failed to get "${key}" from localStorage:`, error);
    // Remove corrupted data
    removeStorageItem(key);
    return defaultValue;
  }
}

/**
 * Safely set an item in localStorage with JSON stringification
 * @param {string} key - The localStorage key
 * @param {T} value - The value to store
 * @returns {boolean} - True if successful, false otherwise
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded! Consider clearing old data.');
    } else {
      console.warn(`Failed to set "${key}" in localStorage:`, error);
    }
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 * @param {string} key - The localStorage key
 */
export function removeStorageItem(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove "${key}" from localStorage:`, error);
  }
}

/**
 * Clear all items in localStorage (use with caution!)
 */
export function clearStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    localStorage.clear();
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }
}

/**
 * Get the approximate size of localStorage in bytes
 * @returns {number} - Size in bytes
 */
export function getStorageSize(): number {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }

    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += (localStorage[key].length + key.length) * 2; // UTF-16 = 2 bytes per char
      }
    }
    return total;
  } catch (error) {
    console.warn('Failed to calculate storage size:', error);
    return 0;
  }
}

/**
 * Check if localStorage is available and working
 * @returns {boolean} - True if available
 */
export function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all keys in localStorage with a specific prefix
 * @param {string} prefix - The prefix to filter keys
 * @returns {string[]} - Array of matching keys
 */
export function getStorageKeys(prefix: string = ''): string[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return keys;
  } catch (error) {
    console.warn('Failed to get storage keys:', error);
    return [];
  }
}

/**
 * Remove all items with a specific prefix (useful for cleanup)
 * @param {string} prefix - The prefix to filter keys
 */
export function clearStorageByPrefix(prefix: string): void {
  const keys = getStorageKeys(prefix);
  keys.forEach(key => removeStorageItem(key));
}
