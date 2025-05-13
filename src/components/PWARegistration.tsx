"use client";
import { useEffect } from 'react';

export default function PWARegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('SW registered: ', registration);
            // Optional: Notify user of PWA readiness or updates
            // console.log("App Ready Offline", "KanbanFlow can now be used offline.");
          })
          .catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
            // console.error("Offline Mode Error", "Could not enable offline features.");
          });
      });
    }
  }, []);

  return null;
}
