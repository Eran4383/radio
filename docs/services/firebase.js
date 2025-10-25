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

let auth;
let db;
let isInitialized = false;

export const initFirebase = () => {
    return new Promise(async (resolve, reject) => {
        if (isInitialized) return resolve();

        if (typeof firebase === 'undefined') {
            return reject(new Error("Firebase scripts not loaded."));
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
    
        auth = firebase.auth();
        db = firebase.firestore();

        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            isInitialized = true;
            resolve();
        } catch (error) {
            console.error("Firebase persistence error:", error.code, error.message);
            isInitialized = true;
            resolve(); // Resolve even on persistence error to not block the app
        }
    });
};

export const getAuth = () => {
    if (!isInitialized) throw new Error("Firebase not initialized!");
    return auth;
}

export const getDb = () => {
    if (!isInitialized) throw new Error("Firebase not initialized!");
    return db;
}

const googleProvider = new firebase.auth.GoogleAuthProvider();

export const signInWithGoogle = async () => {
  const authInstance = getAuth();
  try {
    const res = await authInstance.signInWithPopup(googleProvider);
    return res.user;
  } catch (err) {
    console.error("Google sign-in error:", err);
    alert(err.message);
    return null;
  }
};

export const signOut = async () => {
  const authInstance = getAuth();
  await authInstance.signOut();
};

export const saveUserSettings = async (userId, settings) => {
  if (!userId) return;
  const dbInstance = getDb();
  try {
    // We remove undefined values as Firestore doesn't support them.
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    await dbInstance.collection('users').doc(userId).set(cleanSettings, { merge: true });
  } catch (error) {
    console.error("Error saving user settings to Firestore:", error);
  }
};

export const loadUserSettings = async (userId) => {
  if (!userId) return null;
  const dbInstance = getDb();
  try {
    const doc = await dbInstance.collection('users').doc(userId).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error("Error loading user settings from Firestore:", error);
    return null;
  }
};