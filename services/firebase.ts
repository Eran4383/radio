// Firebase is imported via <script> tags in index.html, creating a global 'firebase' object.
// This declaration prevents TypeScript errors.
// FIX: Import firebase types to resolve namespace errors.
import type firebase from 'firebase/compat/app';
declare const firebase: any;

// User's actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtTn2euDrfnD5mJrY0mASVOXPaJLDOHbo",
  authDomain: "radio-premium-il-6a22b.firebaseapp.com",
  projectId: "radio-premium-il-6a22b",
  storageBucket: "radio-premium-il-6a22b.firebasestorage.app",
  messagingSenderId: "201862743073",
  appId: "1:201862743073:web:2c84cbb2b1443d87884f60"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();

// Set persistence to 'local' to keep the user signed in across browser sessions.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error: any) => {
    console.error("Firebase persistence error:", error.code, error.message);
  });


const googleProvider = new firebase.auth.GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<firebase.User | null> => {
  try {
    const res = await auth.signInWithPopup(googleProvider);
    return res.user;
  } catch (err) {
    console.error("Google sign-in error:", err);
    alert((err as Error).message);
    return null;
  }
};

export const signOut = async (): Promise<void> => {
  await auth.signOut();
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Firestore operation timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]);
};

export const saveUserSettings = async (userId: string, settings: any): Promise<void> => {
  if (!userId) return;
  try {
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    const savePromise = db.collection('users').doc(userId).set(cleanSettings, { merge: true });
    await withTimeout(savePromise, 8000); // 8-second timeout
  } catch (error) {
    console.error("Error saving user settings to Firestore:", error);
  }
};

export const loadUserSettings = async (userId: string): Promise<any | null> => {
  if (!userId) return null;
  try {
    const loadPromise: Promise<firebase.firestore.DocumentSnapshot> = db.collection('users').doc(userId).get();
    const doc = await withTimeout(loadPromise, 8000); // 8-second timeout
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error("Error loading user settings from Firestore:", error);
    return null;
  }
};