import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * Custom hook for persistent state management using localStorage
 * 
 * @template T - The type of the state value
 * @param {string} key - The localStorage key to store the value
 * @param {T} defaultValue - The default value if nothing is stored
 * @returns {[T, Dispatch<SetStateAction<T>>]} - State and setter similar to useState
 * 
 * @example
 * const [count, setCount] = usePersistentState('counter', 0);
 * const [user, setUser] = usePersistentState('user', { name: '', age: 0 });
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // Initialize state by checking localStorage first
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      
      // If value exists in localStorage, parse and return it
      if (storedValue !== null) {
        return JSON.parse(storedValue) as T;
      }
    } catch (error) {
      console.warn(`Error loading "${key}" from localStorage:`, error);
      // If parsing fails, remove corrupted data
      localStorage.removeItem(key);
    }
    
    // Return default value if localStorage is empty or parsing failed
    return defaultValue;
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error saving "${key}" to localStorage:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

/**
 * Custom hook for session-based persistent state (cleared when tab closes)
 * 
 * @template T - The type of the state value
 * @param {string} key - The sessionStorage key to store the value
 * @param {T} defaultValue - The default value if nothing is stored
 * @returns {[T, Dispatch<SetStateAction<T>>]} - State and setter similar to useState
 * 
 * @example
 * const [formDraft, setFormDraft] = useSessionState('form-draft', { name: '', email: '' });
 */
export function useSessionState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = sessionStorage.getItem(key);
      
      if (storedValue !== null) {
        return JSON.parse(storedValue) as T;
      }
    } catch (error) {
      console.warn(`Error loading "${key}" from sessionStorage:`, error);
      sessionStorage.removeItem(key);
    }
    
    return defaultValue;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error saving "${key}" to sessionStorage:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

/**
 * Hook for URL-based state management (for shareable links)
 * Useful for search filters, pagination, etc.
 * 
 * @param {string} paramName - URL parameter name
 * @param {string} defaultValue - Default value if parameter doesn't exist
 * @returns {[string, (value: string) => void]} - Current value and setter
 * 
 * @example
 * const [searchQuery, setSearchQuery] = useURLState('search', '');
 * // URL: ?search=admin
 */
export function useURLState(
  paramName: string,
  defaultValue: string = ''
): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultValue;
    
    const params = new URLSearchParams(window.location.search);
    return params.get(paramName) || defaultValue;
  });

  const setURLValue = (newValue: string) => {
    setValue(newValue);
    
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    
    if (newValue) {
      params.set(paramName, newValue);
    } else {
      params.delete(paramName);
    }
    
    const newURL = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newURL);
  };

  return [value, setURLValue];
}
