# 🔄 Persistent State - Quick Reference

This cheat sheet provides copy-paste ready examples for implementing persistent state in React.

---

## 📦 Import Statements

```typescript
// localStorage persistence
import { usePersistentState } from '../hooks/usePersistentState';

// sessionStorage (cleared on tab close)
import { useSessionState } from '../hooks/usePersistentState';

// URL parameters (shareable links)
import { useURLState } from '../hooks/usePersistentState';

// Direct storage operations
import { 
  getStorageItem, 
  setStorageItem, 
  removeStorageItem,
  clearStorageByPrefix
} from '../utils/storage';
```

---

## 🎯 Basic Usage Examples

### String State
```typescript
const [name, setName] = usePersistentState('user-name', '');
```

### Number State
```typescript
const [count, setCount] = usePersistentState('counter', 0);
```

### Boolean State
```typescript
const [isEnabled, setIsEnabled] = usePersistentState('feature-enabled', false);
```

### Object State
```typescript
const [user, setUser] = usePersistentState('user-data', { 
  name: '', 
  age: 0,
  email: ''
});
```

### Array State
```typescript
const [items, setItems] = usePersistentState<string[]>('items-list', []);
```

### Union Type State
```typescript
const [theme, setTheme] = usePersistentState<'light' | 'dark'>('app-theme', 'light');
```

---

## 📊 Real-World Patterns

### Pattern 1: Table Filters
```typescript
function DataTable() {
  const [page, setPage] = usePersistentState('table-page', 1);
  const [pageSize, setPageSize] = usePersistentState('table-size', 10);
  const [search, setSearch] = usePersistentState('table-search', '');
  const [sortBy, setSortBy] = usePersistentState('table-sort', 'id');
  const [sortDir, setSortDir] = usePersistentState<'ASC' | 'DESC'>('table-dir', 'DESC');
  
  // All filters persist on page refresh ✅
}
```

### Pattern 2: User Preferences
```typescript
function Settings() {
  const [notifications, setNotifications] = usePersistentState('pref-notifications', true);
  const [language, setLanguage] = usePersistentState<'en' | 'es'>('pref-lang', 'en');
  const [pageSize, setPageSize] = usePersistentState('pref-page-size', 25);
}
```

### Pattern 3: Form Draft (Session)
```typescript
function FormDraft() {
  const [draft, setDraft] = useSessionState('form-draft', {
    step: 1,
    data: {}
  });
  // Persists through refresh but cleared when tab closes
}
```

### Pattern 4: Shareable Search
```typescript
function SearchPage() {
  const [query, setQuery] = useURLState('search', '');
  const [page, setPage] = useURLState('page', '1');
  // URL: ?search=value&page=2
  // Users can bookmark and share this URL!
}
```

---

## 🛠️ Direct Storage Operations

### Get with Default Fallback
```typescript
const preferences = getStorageItem('user-preferences', {
  theme: 'dark',
  notifications: true
});
```

### Set with Error Handling
```typescript
const success = setStorageItem('user-data', {
  name: 'John',
  age: 30
});
```

### Remove Item
```typescript
removeStorageItem('temp-data');
```

### Clear by Prefix
```typescript
// Clear all dashboard-related keys
clearStorageByPrefix('dashboard-');
```

---

## 🎨 TypeScript Interface Examples

```typescript
// Define an interface for complex state
interface DashboardFilters {
  page: number;
  pageSize: 10 | 25 | 50 | 100;
  search: string;
  sortBy: 'id' | 'name' | 'date';
  sortDir: 'ASC' | 'DESC';
}

// Use with usePersistentState
const [filters, setFilters] = usePersistentState<DashboardFilters>(
  'dashboard-filters',
  {
    page: 1,
    pageSize: 10,
    search: '',
    sortBy: 'id',
    sortDir: 'DESC'
  }
);
```

---

## ✅ Migration: useState → usePersistentState

### Before (Resets on Refresh)
```typescript
import { useState } from 'react';

function Component() {
  const [page, setPage] = useState(1);
  // State resets on refresh ❌
}
```

### After (Persists on Refresh)
```typescript
import { usePersistentState } from '../hooks/usePersistentState';

function Component() {
  const [page, setPage] = usePersistentState('component-page', 1);
  // State persists on refresh ✅
}
```

---

## ⚠️ Best Practices

### ✅ DO
```typescript
// Use namespaced keys
const [value, setValue] = usePersistentState('dashboard-page', 1);

// Provide sensible defaults
const [prefs, setPrefs] = usePersistentState('preferences', {
  theme: 'light',
  notifications: true
});

// Use for UI state and filters
const [search, setSearch] = usePersistentState('search-query', '');
```

### ❌ DON'T
```typescript
// Don't use generic keys (may conflict)
const [page, setPage] = usePersistentState('page', 1); // ❌

// Don't store sensitive data
const [password, setPassword] = usePersistentState('password', ''); // ❌

// Don't store large datasets
const [allData, setAllData] = usePersistentState('huge-array', []); // ❌
```

---

## 🔍 Debugging Commands (Browser Console)

```javascript
// View all localStorage
console.table(localStorage);

// Get specific value
console.log(localStorage.getItem('dashboard-page'));

// Parse JSON value
console.log(JSON.parse(localStorage.getItem('dashboard-filters')));

// Clear specific key
localStorage.removeItem('dashboard-page');

// Clear all localStorage
localStorage.clear();

// Check storage size
let total = 0;
for (let key in localStorage) {
  if (localStorage.hasOwnProperty(key)) {
    total += (localStorage[key].length + key.length) * 2;
  }
}
console.log(`Storage used: ${total / 1024}KB`);
```

---

## 🎯 Currently Implemented

- ✅ **ThemeContext**: Dark/light mode preference
- ✅ **AuthContext**: User session (cookies)
- ✅ **Dashboard**: All filters, pagination, active tab

---

## 📚 Advanced: Conditional Persistence

```typescript
function SmartComponent() {
  const shouldPersist = useUserPreference('remember-me');
  
  // Dynamically choose persistence strategy
  const [value, setValue] = shouldPersist
    ? usePersistentState('key', 'default')
    : useState('default');
}
```

---

## 🚀 Performance Tip

```typescript
// Only persist on user action, not every keystroke
const [search, setSearch] = useState('');
const [persistedSearch, setPersistedSearch] = usePersistentState('search', '');

const handleSearchSubmit = () => {
  setPersistedSearch(search); // Save only when user submits
};
```

---

**Quick Links:**
- [Full Implementation Guide](./PERSISTENT-STATE-GUIDE.md)
- [Hook Source Code](../src/hooks/usePersistentState.ts)
- [Storage Utilities](../src/utils/storage.ts)
