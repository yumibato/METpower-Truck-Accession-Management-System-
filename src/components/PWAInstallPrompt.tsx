import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed (standalone mode)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    
    // Check if app is installed via navigator API
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as any).getInstalledRelatedApps().then((relatedApps: any[]) => {
        setIsInstalled(relatedApps.length > 0);
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);
      
      // Show install prompt after a delay (better UX)
      setTimeout(() => {
        if (!isStandalone && !isInstalled) {
          setShowPrompt(true);
        }
      }, 5000);
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed successfully');
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone, isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed, in standalone mode, or dismissed this session
  if (
    isStandalone || 
    isInstalled || 
    !showPrompt || 
    !deferredPrompt || 
    sessionStorage.getItem('pwa-install-dismissed')
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 p-4 transition-all duration-300 animate-slideUp">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Install METpower TAS
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Add to your home screen for quick access and offline use
            </p>
            
            <div className="flex items-center space-x-2 mt-3">
              <button
                onClick={handleInstallClick}
                className="flex items-center space-x-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200"
              >
                <Download className="w-3 h-3" />
                <span>Install</span>
              </button>
              
              <button
                onClick={handleDismiss}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-xs px-2 py-1.5 transition-colors duration-200"
              >
                Not now
              </button>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Features list */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
          <div className="text-xs text-gray-500 dark:text-slate-400">
            <div className="flex items-center space-x-2 mb-1">
              <span className="w-1 h-1 bg-green-500 rounded-full"></span>
              <span>Works offline</span>
            </div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="w-1 h-1 bg-green-500 rounded-full"></span>
              <span>Fast loading</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-1 h-1 bg-green-500 rounded-full"></span>
              <span>Push notifications</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// CSS for animation (add to your main CSS file)
const styles = `
@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out;
}
`;

export default PWAInstallPrompt;