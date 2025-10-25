// Firebase is imported via <script> tags in index.html, creating a global 'firebase' object.
// This declaration prevents TypeScript errors.
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

let auth: any;
let db: any;
let isInitialized = false;

export const initFirebase = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (isInitialized) return resolve();

        if (typeof firebase === 'undefined') {
            return reject(new Error("Firebase scripts not loaded."));
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
        
            auth = firebase.auth();
            db = firebase.firestore();

            // Explicitly setting persistence to LOCAL is the key to keeping the user logged in.
            // We must wait for this to complete before the app continues.
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => {
                    isInitialized = true;
                    resolve();
                })
                .catch((error: any) => {
                    // This can fail in some environments (e.g., private browsing).
                    // The app can still run, but the user won't stay logged in.
                    console.warn("Firebase persistence error:", error.message);
                    isInitialized = true;
                    resolve(); // Resolve anyway to not block the app.
                });

        } catch (error) {
            reject(error);
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
    alert((err as Error).message);
    return null;
  }
};

export const signOut = async () => {
  const authInstance = getAuth();
  await authInstance.signOut();
};

export const saveUserSettings = async (userId: string, settings: any) => {
  if (!userId) return;
  const dbInstance = getDb();
  try {
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    await dbInstance.collection('users').doc(userId).set(cleanSettings, { merge: true });
  } catch (error) {
    console.error("Error saving user settings to Firestore:", error);
  }
};

export const loadUserSettings = async (userId: string) => {
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