import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import { SplashScreen } from './components/SplashScreen';
import { AnimatePresence } from 'motion/react';
import { initPwaInstallPrompt } from './utils/notification';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // PWA Manifest and Meta Tags Injection
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = 'data:application/manifest+json,' + JSON.stringify({
      name: "공당: 공병반 당직 관리",
      short_name: "공당",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#030213",
      icons: [
        {
          src: "https://api.dicebear.com/7.x/avataaars/svg?seed=gongdang&backgroundColor=030213",
          sizes: "192x192",
          type: "image/svg+xml"
        },
        {
          src: "https://api.dicebear.com/7.x/avataaars/svg?seed=gongdang&backgroundColor=030213",
          sizes: "512x512",
          type: "image/svg+xml"
        }
      ]
    });
    document.head.appendChild(manifestLink);

    // iOS/Android Mobile Optimization Tags
    const metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    metaTheme.content = '#030213';
    document.head.appendChild(metaTheme);

    const metaMobileWeb = document.createElement('meta');
    metaMobileWeb.name = 'mobile-web-app-capable';
    metaMobileWeb.content = 'yes';
    document.head.appendChild(metaMobileWeb);

    const metaAppleMobileWeb = document.createElement('meta');
    metaAppleMobileWeb.name = 'apple-mobile-web-app-capable';
    metaAppleMobileWeb.content = 'yes';
    document.head.appendChild(metaAppleMobileWeb);

    const metaAppleStatusBar = document.createElement('meta');
    metaAppleStatusBar.name = 'apple-mobile-web-app-status-bar-style';
    metaAppleStatusBar.content = 'black-translucent';
    document.head.appendChild(metaAppleStatusBar);

    // Initialize PWA Install Prompt Listener
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          },
          (err) => {
            console.log('ServiceWorker registration failed: ', err);
          }
        );
      });
    }

    // Show splash screen for 2.5 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      document.head.removeChild(manifestLink);
      document.head.removeChild(metaTheme);
      document.head.removeChild(metaMobileWeb);
      document.head.removeChild(metaAppleMobileWeb);
      document.head.removeChild(metaAppleStatusBar);
    };
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash && <SplashScreen key="splash" />}
      </AnimatePresence>
      <RouterProvider router={router} />
      <Toaster 
        position="top-center" 
        expand={true}
        visibleToasts={1}
        toastOptions={{
          style: {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            margin: 0,
            borderRadius: '28px',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.25), 0 18px 36px -18px rgba(0, 0, 0, 0.3)',
            padding: '24px 36px',
            fontSize: '17px',
            fontWeight: '700',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(16px)',
            maxWidth: '85vw',
            width: 'max-content',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#1a1a1a',
            zIndex: 9999,
          }
        }}
      />
    </>
  );
}
