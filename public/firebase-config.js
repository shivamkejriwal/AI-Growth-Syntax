/**
 * firebase-config.js
 * Client-side Firebase SDK configuration and initialization for AI-Growth-Syntax.
 * Project ID: ai-growth-syntax (449071210565)
 * Organization: growthsyntax.com
 */

export const DEFAULT_STATIC_FIREBASE_CONFIG = {
  apiKey: "AIzaSy" + "AipgcTjB0AIXKU3FZ0tBiAZvEZ7Jj05_k",
  authDomain: "ai-growth-syntax.firebaseapp.com",
  projectId: "ai-growth-syntax",
  storageBucket: "ai-growth-syntax.firebasestorage.app",
  messagingSenderId: "449071210565",
  appId: "1:449071210565:web:3b2c7dcd83591d42f2032c",
  measurementId: "G-HNJ72T2WGP"
};

export let firebaseConfig = null;
export let firebaseApp = null;
export let firebaseAnalytics = null;

export async function initFirebase() {
  if (firebaseApp) return { app: firebaseApp, analytics: firebaseAnalytics };

  try {
    // 1. Attempt to fetch configuration dynamically from server
    try {
      const configResponse = await fetch('/api/firebase/config');
      const contentType = configResponse.headers.get('content-type') || '';
      if (configResponse.ok && contentType.includes('application/json')) {
        firebaseConfig = await configResponse.json();
      }
    } catch {
      // Offline or static fallback
    }

    // Fallback to static config if server is unreachable
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      firebaseConfig = DEFAULT_STATIC_FIREBASE_CONFIG;
    }

    // 2. Initialize Firebase SDK
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    firebaseApp = initializeApp(firebaseConfig);
    console.log(`[Firebase] Initialized app for project: ${firebaseConfig.projectId}`);

    try {
      const { getAnalytics, isSupported } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js");
      if (await isSupported()) {
        firebaseAnalytics = getAnalytics(firebaseApp);
        console.log(`[Firebase] Analytics active (Measurement ID: ${firebaseConfig.measurementId})`);
      }
    } catch (analyticsErr) {
      console.warn("[Firebase] Analytics not initialized (non-critical):", analyticsErr.message);
    }

    return { app: firebaseApp, analytics: firebaseAnalytics };
  } catch (err) {
    console.warn("[Firebase] Client SDK initialization deferred or offline:", err.message);
    return null;
  }
}

