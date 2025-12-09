import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  type User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { AllSettings } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyCtTn2euDrfnD5mJrY0mASVOXPaJLDOHbo",
  authDomain: "radio-premium-il-6a22b.firebaseapp.com",
  projectId: "radio-premium-il-6a22b",
  storageBucket: "radio-premium-il-6a22b.firebasestorage.app",
  messagingSenderId: "201862743073",
  appId: "1:201862743073:web:2c84cbb2b1443d87884f60",
  measurementId: "G-M16YN54E1B"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser = () => signOut(auth);
export const onAuthStateChangedListener = (callback: (user: User | null) => void) => onAuthStateChanged(auth, callback);

export const saveUserSettings = async (userId: string, settings: AllSettings) => {
  const userDocRef = doc(db, 'users', userId);
  try {
    await setDoc(userDocRef, { ...settings, lastUpdated: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Error saving user settings to Firestore:", error);
  }
};

export const getUserSettings = async (userId: string): Promise<AllSettings | null> => {
  const userDocRef = doc(db, 'users', userId);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Remove server-specific fields before returning
      delete data.lastUpdated;
      return data as AllSettings;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user settings from Firestore:", error);
    return null;
  }
};