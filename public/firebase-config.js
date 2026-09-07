/**
 * firebase-config.js
 * Client-side Firebase SDK configuration and initialization for AI-Growth-Syntax.
 * Project ID: ai-growth-syntax (449071210565)
 * Organization: growthsyntax.com
 */

export let firebaseConfig = null;
export let firebaseApp = null;
export let firebaseAnalytics = null;

export async function initFirebase() {
  if (firebaseApp) return { app: firebaseApp, analytics: firebaseAnalytics };

  try {
    // 1. Fetch the configuration dynamically from our backend which reads .env
    const configResponse = await fetch('/api/firebase/config');
    if (!configResponse.ok) throw new Error("Failed to fetch Firebase config");
    
    firebaseConfig = await configResponse.json();
    if (!firebaseConfig.apiKey) throw new Error("Firebase API Key missing from config");

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

