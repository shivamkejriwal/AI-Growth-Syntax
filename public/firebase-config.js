/**
 * firebase-config.js
 * Client-side Firebase SDK configuration and initialization for AI-Growth-Syntax.
 * Project ID: ai-growth-syntax (449071210565)
 * Organization: growthsyntax.com
 */

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSy" + "AipgcTjB0AIXKU3FZ0tBiAZvEZ7Jj05_k",
  authDomain: "ai-growth-syntax.firebaseapp.com",
  projectId: "ai-growth-syntax",
  storageBucket: "ai-growth-syntax.firebasestorage.app",
  messagingSenderId: "449071210565",
  appId: "1:449071210565:web:3b2c7dcd83591d42f2032c",
  measurementId: "G-HNJ72T2WGP"
};

export let firebaseApp = null;
export let firebaseAnalytics = null;

export async function initFirebase() {
  if (firebaseApp) return { app: firebaseApp, analytics: firebaseAnalytics };

  try {
    // Dynamic import from Google's official CDN ESM modules
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    firebaseApp = initializeApp(firebaseConfig);
    console.log("[Firebase] Initialized app for project: ai-growth-syntax (449071210565)");

    try {
      const { getAnalytics, isSupported } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js");
      if (await isSupported()) {
        firebaseAnalytics = getAnalytics(firebaseApp);
        console.log("[Firebase] Analytics active (Measurement ID: G-HNJ72T2WGP)");
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

