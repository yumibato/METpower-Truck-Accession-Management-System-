# 🔄 Persistent State Implementation Guide

## Overview
This document explains the **Persistent State** pattern implementation in the METPower Admin Dashboard to prevent state reset on page refresh.

---

## 🎯 Problem Solved
**Before:** Dashboard filters, pagination, and user preferences were lost on page refresh.  
**After:** All critical UI state persists across browser refreshes and sessions.

---

## 📦 Implementation Methods

### 1. ✅ localStorage (Implemented)
**Best For:** Settings, filters, pagination that should persist indefinitely  
**Storage Duration:** Persists until explicitly cleared  
**Currently Used In:**
- `ThemeContext.tsx` - Dark/light mode preference
- `Dashboard.tsx` - Page, pageSize, search, sort, active tab

### 2. ✅ Cookies (Implemented)
**Best For:** Authentication tokens, server-side accessible data  
**Storage Duration:** Configurable expiration (1 day in our case)  
**Currently Used In:**
- `AuthContext.tsx` - User authentication state

### 3. 🔧 sessionStorage (Available)
**Best For:** Temporary form drafts, wizard steps  
**Storage Duration:** Cleared when browser tab closes  
**Use Case:** Multi-step forms that should reset per session

### 4. 🔗 URL Parameters (Available)
**Best For:** Shareable search results, deep linking  
**Storage Duration:** Persists in browser history  
**Use Case:** Transaction searches that users can share via URL

---

## 🛠️ Usage Guide

### Basic Usage - `usePersistentState` Hook

```tsx
import { usePersistentState } from '../hooks/usePersistentState';

function MyComponent() {
  // Just like useState, but it persists!
  const [count, setCount] = usePersistentState('counter', 0);
  const [user, setUser] = usePersistentState('user-data', { name: '', age: 0 });
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      {/* State survives page refresh! */}
    </div>
  );
}
```

### Session-Based State (Temporary)

```tsx
import { useSessionState } from '../hooks/usePersistentState';

function FormWizard() {
  // Cleared when tab closes
  const [formDraft, setFormDraft] = useSessionState('form-draft', {
    step: 1,
    data: {}
  });
  
  return (
    <div>
      <p>Current Step: {formDraft.step}</p>
      {/* Data persists on refresh but not after closing tab */}
    </div>
  );
}
```

### URL-Based State (Shareable)

```tsx
import { useURLState } from '../hooks/usePersistentState';

function SearchPage() {
  const [searchTerm, setSearchTerm] = useURLState('search', '');
  const [page, setPage] = useURLState('page', '1');
  
  // URL will be: ?search=truck&page=2
  // Users can share this exact URL with others!
  
  return (
    <input 
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

---

## 🔒 Safe Storage Utilities

### Direct localStorage Operations

```tsx
import { getStorageItem, setStorageItem, removeStorageItem } from '../utils/storage';

// Get with type safety and default value
const preferences = getStorageItem('user-preferences', {
  notifications: true,
  theme: 'dark'
});

// Set with automatic error handling
const success = setStorageItem('user-preferences', {
  notifications: false,
  theme: 'light'
});

// Remove when needed
removeStorageItem('user-preferences');
```

### Advanced Operations

```tsx
import { 
  isStorageAvailable, 
  getStorageSize, 
  getStorageKeys,
  clearStorageByPrefix 
} from '../utils/storage';

// Check if localStorage is available
if (isStorageAvailable()) {
  console.log('localStorage is working!');
}

// Monitor storage usage
const sizeInBytes = getStorageSize();
console.log(`Using ${sizeInBytes / 1024}KB of storage`);

// Get all dashboard-related keys
const dashboardKeys = getStorageKeys('dashboard-');
// ['dashboard-page', 'dashboard-pageSize', 'dashboard-search']

// Clear all dashboard filters
clearStorageByPrefix('dashboard-');
```

---

## 🎨 Real-World Examples

### Example 1: Persistent Table Filters

```tsx
import { usePersistentState } from '../hooks/usePersistentState';

function DataTable() {
  const [page, setPage] = usePersistentState('table-page', 1);
  const [pageSize, setPageSize] = usePersistentState('table-pageSize', 10);
  const [search, setSearch] = usePersistentState('table-search', '');
  const [sortBy, setSortBy] = usePersistentState('table-sortBy', 'id');
  const [sortDir, setSortDir] = usePersistentState<'ASC' | 'DESC'>('table-sortDir', 'DESC');
  
  // All filters persist on refresh! ✅
  
  return (
    <div>
      <input 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
        placeholder="Search..."
      />
      {/* Table content */}
    </div>
  );
}
```

### Example 2: Multi-Step Form with Session Storage

```tsx
import { useSessionState } from '../hooks/usePersistentState';
import { useState } from 'react';

function RegistrationWizard() {
  const [currentStep, setCurrentStep] = useSessionState('wizard-step', 1);
  const [formData, setFormData] = useSessionState('wizard-data', {
    personalInfo: {},
    address: {},
    payment: {}
  });
  
  const handleNext = () => {
    setCurrentStep(currentStep + 1);
  };
  
  const handleSubmit = async () => {
    await api.submitForm(formData);
    // Clear after successful submission
    sessionStorage.clear();
  };
  
  // If user refreshes, they stay on the same step with their data!
  return <div>Step {currentStep} of 3</div>;
}
```

### Example 3: Shareable Search Results

```tsx
import { useURLState } from '../hooks/usePersistentState';
import { useEffect, useState } from 'react';

function TransactionSearch() {
  const [searchQuery, setSearchQuery] = useURLState('q', '');
  const [page, setPage] = useURLState('page', '1');
  const [results, setResults] = useState([]);
  
  useEffect(() => {
    // Fetch results based on URL parameters
    if (searchQuery) {
      fetchResults(searchQuery, parseInt(page));
    }
  }, [searchQuery, page]);
  
  // URL: /search?q=truck&page=2
  // Users can bookmark or share this exact search!
  
  return (
    <div>
      <input 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search transactions..."
      />
      {/* Share this URL: {window.location.href} */}
    </div>
  );
}
```

---

## 🏪 Global Store Options (Optional)

### Option A: Redux Persist

If you need a global store with persistence:

```bash
npm install redux react-redux @reduxjs/toolkit redux-persist
```

```tsx
// store.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // localStorage
import rootReducer from './reducers';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['dashboard', 'preferences'] // Only persist these reducers
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    })
});

export const persistor = persistStore(store);
```

```tsx
// App.tsx
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
        <YourApp />
      </PersistGate>
    </Provider>
  );
}
```

### Option B: Zustand with Persist Middleware

Simpler alternative to Redux:

```bash
npm install zustand
```

```tsx
// store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DashboardState {
  page: number;
  pageSize: number;
  search: string;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSearch: (search: string) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      page: 1,
      pageSize: 10,
      search: '',
      setPage: (page) => set({ page }),
      setPageSize: (pageSize) => set({ pageSize }),
      setSearch: (search) => set({ search })
    }),
    {
      name: 'dashboard-storage' // localStorage key
    }
  )
);
```

```tsx
// Usage in components
import { useDashboardStore } from './store';

function Dashboard() {
  const { page, pageSize, setPage, setPageSize } = useDashboardStore();
  
  // State automatically persists! ✅
  return (
    <div>
      <p>Page: {page}</p>
      <button onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}
```

---

## ⚠️ Best Practices

### 1. Use Unique Keys
```tsx
// ❌ BAD - Generic key, might conflict
const [page, setPage] = usePersistentState('page', 1);

// ✅ GOOD - Namespaced key
const [page, setPage] = usePersistentState('dashboard-page', 1);
```

### 2. Don't Store Sensitive Data
```tsx
// ❌ BAD - Never store passwords in localStorage!
const [password, setPassword] = usePersistentState('password', '');

// ✅ GOOD - Use secure cookies or memory-only state
const [token, setToken] = useState<string | null>(null);
// Then use httpOnly cookies for auth tokens
```

### 3. Handle Large Data Carefully
```tsx
// ❌ BAD - Storing huge datasets
const [allTransactions, setAllTransactions] = usePersistentState('transactions', []);

// ✅ GOOD - Store only IDs or filters
const [selectedIds, setSelectedIds] = usePersistentState('selected-ids', []);
```

### 4. Provide Fallback Values
```tsx
// ✅ ALWAYS provide sensible defaults
const [preferences, setPreferences] = usePersistentState('prefs', {
  theme: 'light',
  notifications: true,
  pageSize: 10
});
```

---

## 🔍 Debugging Tips

### Check Stored Values
```javascript
// In browser console
console.log(localStorage.getItem('dashboard-page'));
console.log(JSON.parse(localStorage.getItem('dashboard-search')));
```

### Clear All Persistent State
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
// Then refresh page
```

### Monitor Storage Usage
```tsx
import { getStorageSize } from '../utils/storage';

useEffect(() => {
  console.log(`Storage used: ${getStorageSize() / 1024}KB`);
}, []);
```

---

## 🎯 Currently Implemented

| Component | Persistent State | Storage Type |
|-----------|-----------------|--------------|
| ThemeContext | `theme` (light/dark) | localStorage |
| AuthContext | `authToken`, `userData` | Cookies |
| Dashboard | `page`, `pageSize`, `search`, `sortBy`, `sortDir`, `activeTab` | localStorage |

---

## 📚 Additional Resources

- [MDN: Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [Redux Persist](https://github.com/rt2zz/redux-persist)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Router: URL State](https://reactrouter.com/en/main/hooks/use-search-params)

---

**Last Updated:** March 2, 2026  
**Author:** METPower Development Team
