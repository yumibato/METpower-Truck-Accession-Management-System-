import { usePersistentState } from '../hooks/usePersistentState';

/**
 * Example Component: User Preferences
 * Demonstrates persistent state for app settings
 */
export default function UserPreferences() {
  // ✅ All preferences persist across page refreshes
  const [notifications, setNotifications] = usePersistentState('pref-notifications', true);
  const [emailAlerts, setEmailAlerts] = usePersistentState('pref-email-alerts', false);
  const [pageSize, setPageSize] = usePersistentState('pref-page-size', 25);
  const [language, setLanguage] = usePersistentState<'en' | 'es' | 'fr'>('pref-language', 'en');
  const [autoRefresh, setAutoRefresh] = usePersistentState('pref-auto-refresh', false);
  const [refreshInterval, setRefreshInterval] = usePersistentState('pref-refresh-interval', 30);

  // Reset all preferences to defaults
  const handleResetDefaults = () => {
    setNotifications(true);
    setEmailAlerts(false);
    setPageSize(25);
    setLanguage('en');
    setAutoRefresh(false);
    setRefreshInterval(30);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-midnight-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-enterprise-text mb-6">
        User Preferences
      </h2>
      
      <div className="space-y-6">
        {/* Notification Settings */}
        <div className="border-b dark:border-midnight-700 pb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-enterprise-silver mb-3">
            Notifications
          </h3>
          
          <label className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-enterprise-text">Enable Notifications</span>
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 dark:border-midnight-600"
            />
          </label>
          
          <label className="flex items-center justify-between mt-2">
            <span className="text-gray-700 dark:text-enterprise-text">Email Alerts</span>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              disabled={!notifications}
              className="w-5 h-5 rounded border-gray-300 dark:border-midnight-600 disabled:opacity-50"
            />
          </label>
        </div>

        {/* Display Settings */}
        <div className="border-b dark:border-midnight-700 pb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-enterprise-silver mb-3">
            Display
          </h3>
          
          <div>
            <label className="block text-gray-700 dark:text-enterprise-text mb-2">
              Rows per page
            </label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg dark:bg-midnight-700 dark:text-enterprise-text"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="mt-4">
            <label className="block text-gray-700 dark:text-enterprise-text mb-2">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'es' | 'fr')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg dark:bg-midnight-700 dark:text-enterprise-text"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>

        {/* Auto-Refresh Settings */}
        <div className="pb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-enterprise-silver mb-3">
            Auto-Refresh
          </h3>
          
          <label className="flex items-center justify-between mb-4">
            <span className="text-gray-700 dark:text-enterprise-text">Enable Auto-Refresh</span>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 dark:border-midnight-600"
            />
          </label>

          {autoRefresh && (
            <div>
              <label className="block text-gray-700 dark:text-enterprise-text mb-2">
                Refresh Interval (seconds)
              </label>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 dark:text-enterprise-muted mt-1">
                <span>10s</span>
                <span className="font-semibold">{refreshInterval}s</span>
                <span>5min</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4 pt-4">
          <button
            onClick={handleResetDefaults}
            className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
          
          <button
            onClick={() => alert('Preferences saved! (Already auto-saved via localStorage)')}
            className="px-6 py-2 bg-neon-cyan-glow hover:bg-neon-cyan-bright dark:shadow-neon-cyan text-white rounded-lg transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-neon-cyan-glow/10 border border-blue-200 dark:border-neon-cyan-glow/30 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-neon-cyan-glow">
          💡 <strong>Tip:</strong> All your preferences are automatically saved to your browser. 
          They will persist even if you close and reopen the app!
        </p>
      </div>
    </div>
  );
}

/**
 * Example Component: Shopping Cart (Session-based)
 * Cart persists through refresh but clears when tab closes
 */
export function ShoppingCartExample() {
  const [cart, setCart] = usePersistentState<Array<{ id: number; name: string; qty: number }>>('cart-items', []);

  const clearCart = () => {
    setCart([]);
  };

  const addSampleItem = () => {
    const newItem = {
      id: Date.now(),
      name: `Item ${cart.length + 1}`,
      qty: 1
    };
    setCart([...cart, newItem]);
  };

  return (
    <div className="p-6 bg-white dark:bg-midnight-800 rounded-lg">
      <h2 className="text-2xl font-bold dark:text-enterprise-text mb-4">
        Shopping Cart ({cart.length} items)
      </h2>
      
      <div className="space-y-2">
        {cart.map((item) => (
          <div key={item.id} className="flex justify-between dark:text-enterprise-silver">
            <span>{item.name}</span>
            <span>Qty: {item.qty}</span>
          </div>
        ))}
      </div>

      <div className="flex space-x-2 mt-4">
        <button
          onClick={addSampleItem}
          className="px-4 py-2 bg-neon-cyan-glow hover:bg-neon-cyan-bright text-white rounded-lg"
        >
          Add Item
        </button>
        <button
          onClick={clearCart}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
        >
          Clear Cart
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-enterprise-muted mt-4">
        ✅ Your cart persists through page refresh!
      </p>
    </div>
  );
}
