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
    // Set Light Mode as Default
    document.documentElement.classList.remove('dark');

    // PWA Manifest and Meta Tags Injection
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = 'data:application/manifest+json,' + JSON.stringify({
      name: "공당: 공병반 당직 관리",
      short_name: "공당",
      start_url: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#6366f1",
      icons: [
        {
          src: "https://api.dicebear.com/7.x/avataaars/svg?seed=공당&backgroundColor=6366f1",
          sizes: "192x192",
          type: "image/svg+xml",
          purpose: "any maskable"
        },
        {
          src: "https://api.dicebear.com/7.x/avataaars/svg?seed=공당&backgroundColor=6366f1",
          sizes: "512x512",
          type: "image/svg+xml",
          purpose: "any maskable"
        }
      ]
    });
    document.head.appendChild(manifestLink);

    // iOS/Android Mobile Optimization Tags
    const metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    metaTheme.content = '#ffffff';
    document.head.appendChild(metaTheme);

    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover');
    }

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
        expand={false}
        visibleToasts={1}
        duration={500}
        toastOptions={{
          style: {
            borderRadius: '28px',
            border: 'none',
            boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.4)',
            padding: '24px 36px',
            fontSize: '16px',
            fontWeight: '900',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            maxWidth: '320px',
            width: 'calc(100vw - 64px)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1a1a1a',
            borderBottom: '6px solid #6366f1',
            margin: 0,
          }
        }}
      />
    </>
  );
}
