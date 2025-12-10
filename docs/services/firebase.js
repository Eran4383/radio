
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

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
export const onAuthStateChangedListener = (callback) => onAuthStateChanged(auth, callback);

export const saveUserSettings = async (userId, settings) => {
  const userDocRef = doc(db, 'users', userId);
  try {
    await setDoc(userDocRef, { ...settings, lastUpdated: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Error saving user settings to Firestore:", error);
  }
};

export const getUserSettings = async (userId) => {
  const userDocRef = doc(db, 'users', userId);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      delete data.lastUpdated;
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user settings from Firestore:", error);
    return null;
  }
};

// --- Admin & Station Management ---

const ADMINS_COLLECTION = 'admins';
const APP_DATA_COLLECTION = 'app_data';
const STATIONS_DOC_ID = 'stations_list';
const NETWORK_CONFIG_ID = 'network_config';

// Check if a user is an admin
export const checkAdminRole = async (email) => {
    if (!email) return false;
    try {
        const normalizedEmail = email.toLowerCase();
        const docRef = doc(db, ADMINS_COLLECTION, normalizedEmail);
        const docSnap = await getDoc(docRef);
        
        const exists = docSnap.exists();
        console.log(`[Admin Check] Checking permissions for: ${normalizedEmail}`);
        console.log(`[Admin Check] Is Admin? ${exists}`);

        return exists;
    } catch (error) {
        console.error("Error checking admin role:", error);
        return false;
    }
};

// Fetch the list of admins
export const fetchAdmins = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, ADMINS_COLLECTION));
        return querySnapshot.docs.map(doc => doc.id);
    } catch (error) {
        console.error("Error fetching admins:", error);
        return [];
    }
};

// Add a new admin
export const addAdmin = async (email) => {
    try {
        const normalizedEmail = email.toLowerCase();
        await setDoc(doc(db, ADMINS_COLLECTION, normalizedEmail), {
            addedAt: serverTimestamp(),
            role: 'admin'
        });
        return true;
    } catch (error) {
        console.error("Error adding admin:", error);
        throw error;
    }
};

// Remove an admin
export const removeAdmin = async (email) => {
    try {
        const normalizedEmail = email.toLowerCase();
        await deleteDoc(doc(db, ADMINS_COLLECTION, normalizedEmail));
        return true;
    } catch (error) {
        console.error("Error removing admin:", error);
        throw error;
    }
};

// Fetch custom station list from Firestore
export const fetchCustomStations = async () => {
    try {
        const docRef = doc(db, APP_DATA_COLLECTION, STATIONS_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.stations;
        }
        return null; 
    } catch (error) {
        console.error("Error fetching custom stations:", error);
        return null;
    }
};

// Save custom station list to Firestore
export const saveCustomStations = async (stations) => {
    try {
        const docRef = doc(db, APP_DATA_COLLECTION, STATIONS_DOC_ID);
        await setDoc(docRef, { 
            stations: stations,
            updatedAt: serverTimestamp() 
        });
        return true;
    } catch (error) {
        console.error("Error saving custom stations:", error);
        throw error;
    }
};

// Reset stations
export const resetStationsInFirestore = async () => {
    try {
        const docRef = doc(db, APP_DATA_COLLECTION, STATIONS_DOC_ID);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error resetting stations:", error);
        throw error;
    }
};

export const fetchNetworkConfig = async () => {
    try {
        const docRef = doc(db, APP_DATA_COLLECTION, NETWORK_CONFIG_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        return null;
    }
};

export const saveNetworkConfig = async (config) => {
    try {
        const docRef = doc(db, APP_DATA_COLLECTION, NETWORK_CONFIG_ID);
        await setDoc(docRef, { 
            ...config,
            updatedAt: serverTimestamp() 
        });
        return true;
    } catch (error) {
        console.error("Error saving network config:", error);
        throw error;
    }
};
