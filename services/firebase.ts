import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// User's actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtTn2euDrfnD5mJrY0mASVOXPaJLDOHbo",
  authDomain: "radio-premium-il-6a22b.firebaseapp.com",
  projectId: "radio-premium-il-6a22b",
  storageBucket: "radio-premium-il-6a22b.appspot.com",
  messagingSenderId: "201862743073",
  appId: "1:201862743073:web:2c84cbb2b1443d87884f60"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();

const googleProvider = new firebase.auth.GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const res = await auth.signInWithPopup(googleProvider);
    return res.user;
  } catch (err) {
    console.error("Google sign-in error:", err);
    alert((err as Error).message);
    return null;
  }
};

export const signOut = async () => {
  await auth.signOut();
};

export const saveUserSettings = async (userId: string, settings: any) => {
  if (!userId) return;
  try {
    // We remove undefined values as Firestore doesn't support them.
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    await db.collection('users').doc(userId).set(cleanSettings, { merge: true });
  } catch (error) {
    console.error("Error saving user settings to Firestore:", error);
  }
};

export const loadUserSettings = async (userId: string) => {
  if (!userId) return null;
  try {
    const doc = await db.collection('users').doc(userId).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error("Error loading user settings from Firestore:", error);
    return null;
  }
};
