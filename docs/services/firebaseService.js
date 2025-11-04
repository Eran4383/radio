import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCtTn2euDrfnD5mJrY0mASVOXPaJLDOHbo",
  authDomain: "radio-premium-il-6a22b.firebaseapp.com",
  projectId: "radio-premium-il-6a22b",
  storageBucket: "radio-premium-il-6a22b.appspot.com",
  messagingSenderId: "201862743073",
  appId: "1:201862743073:web:2c84cbb2b1443d87884f60",
  measurementId: "G-M16YN54E1B"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Initialize Firestore without special cache settings first.
export const firestore = initializeFirestore(app, {});

// Explicitly enable persistence for robust offline support.
enableIndexedDbPersistence(firestore)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Firestore persistence could not be enabled: Multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      console.warn("Firestore persistence could not be enabled: Browser not supported.");
    }
  });

export const googleProvider = new GoogleAuthProvider();