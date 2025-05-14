
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; // Removido GoogleAuthProvider
import { getFirestore } from 'firebase/firestore';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

let missingKeys = false;
if (!apiKey) {
  console.error(
    '🔴 Firebase API Key is MISSING. Please check your .env.local file and ensure NEXT_PUBLIC_FIREBASE_API_KEY is correctly set. You also need to restart your development server after changing .env.local.'
  );
  missingKeys = true;
}
if (!authDomain) {
  console.error(
    '🔴 Firebase Auth Domain is MISSING. Please check your .env.local file and ensure NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is correctly set. You also need to restart your development server after changing .env.local.'
  );
  missingKeys = true;
}
if (!projectId) {
  console.error(
    '🔴 Firebase Project ID is MISSING. Please check your .env.local file and ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID is correctly set. You also need to restart your development server after changing .env.local.'
  );
  missingKeys = true;
}
// Add checks for other keys if they become problematic, though apiKey, authDomain, and projectId are most critical for initialization.

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

let app: FirebaseApp;

// Initialize Firebase only if all critical keys are present
if (!missingKeys && !getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("🔴 Firebase initialization failed:", error);
    // Prevent further Firebase calls if initialization fails
    // @ts-ignore
    app = null; 
  }
} else if (!missingKeys) {
  app = getApps()[0];
} else {
  console.error("🔴 Firebase was not initialized due to missing configuration keys.");
  // @ts-ignore
  app = null; // Ensure app is null if not initialized
}

// Conditionally initialize auth and db only if app was successfully initialized
// @ts-ignore
const auth = app ? getAuth(app) : null;
// @ts-ignore
const db = app ? getFirestore(app) : null;
// googleProvider removido

// @ts-ignore
export { app, auth, db }; // googleProvider removido da exportação
