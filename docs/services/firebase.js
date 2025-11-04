// Firebase is imported via <script> tags in index.html, creating a global 'firebase' object.
// This file assumes 'firebase' is globally available.

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
  .catch((error) => {
    console.error("Firebase persistence error:", error.code, error.message);
  });

const googleProvider = new firebase.auth.GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const res = await auth.signInWithPopup(googleProvider);
    return res.user;
  } catch (err) {
    console.error("Google sign-in error:", err);
    alert(err.message);
    return null;
  }
};

export const signOut = async () => {
  await auth.signOut();
};

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Firestore operation timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]);
};

export const saveUserSettings = async (userId, settings) => {
  if (!userId) return;
  try {
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    const savePromise = db.collection('users').doc(userId).set(cleanSettings, { merge: true });
    await withTimeout(savePromise, 8000); // 8-second timeout
  } catch (error) {
    console.error("Error saving user settings to Firestore:", error);
  }
};

export const loadUserSettings = async (userId) => {
  if (!userId) return { status: 'error' };
  try {
    const loadPromise = db.collection('users').doc(userId).get();
    const doc = await withTimeout(loadPromise, 8000); // 8-second timeout
    if (doc.exists) {
        return { status: 'success', data: doc.data() };
    } else {
        return { status: 'not-found' };
    }
  } catch (error) {
    console.error("Error loading user settings from Firestore:", error);
    return { status: 'error' };
  }
};
