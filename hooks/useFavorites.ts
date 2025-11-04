import { useState, useEffect, useCallback } from 'react';
import { firestore, User } from '../services/firebaseService';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const FAVORITES_KEY = 'radio-favorites-anonymous';

const getUserDocRef = (uid: string) => doc(firestore, 'user_data', uid);

export const useFavorites = (user: User | null) => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Effect to load favorites from Firestore or localStorage
  useEffect(() => {
    const loadData = async () => {
      setIsLoaded(false);
      if (user) {
        // User is logged in
        try {
          const docRef = getUserDocRef(user.uid);
          const docSnap = await getDoc(docRef);
          const remoteData = docSnap.data();
          
          const localFavoritesStr = localStorage.getItem(FAVORITES_KEY);
          const localFavorites: string[] = localFavoritesStr ? JSON.parse(localFavoritesStr) : [];
          
          let finalFavorites: string[] = [];

          if (docSnap.exists() && remoteData?.favorites) {
            finalFavorites = remoteData.favorites;
          }

          if (localFavorites.length > 0) {
            // Merge local anonymous favorites with remote, giving remote precedence
            const merged = new Set([...finalFavorites, ...localFavorites]);
            finalFavorites = Array.from(merged);
            await setDoc(docRef, { favorites: finalFavorites }, { merge: true });
            localStorage.removeItem(FAVORITES_KEY); // Clean up local after merge
          }
          
          setFavorites(finalFavorites);

        } catch (error) {
          console.error("Failed to load/sync favorites from Firestore", error);
        }
      } else {
        // User is not logged in
        try {
          const storedFavorites = localStorage.getItem(FAVORITES_KEY);
          if (storedFavorites) {
            setFavorites(JSON.parse(storedFavorites));
          } else {
            setFavorites([]);
          }
        } catch (error) {
          console.error("Failed to load favorites from localStorage", error);
        }
      }
      setIsLoaded(true);
    };

    loadData();
  }, [user]);

  const saveFavorites = useCallback(async (newFavorites: string[]) => {
    setFavorites(newFavorites);
    if (user) {
      try {
        await setDoc(getUserDocRef(user.uid), { favorites: newFavorites }, { merge: true });
      } catch (error) {
        console.error("Failed to save favorites to Firestore", error);
      }
    } else {
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      } catch (error) {
        console.error("Failed to save favorites to localStorage", error);
      }
    }
  }, [user]);

  const toggleFavorite = useCallback((stationUuid: string) => {
    const newFavorites = favorites.includes(stationUuid)
      ? favorites.filter(uuid => uuid !== stationUuid)
      : [...favorites, stationUuid];
    saveFavorites(newFavorites);
  }, [favorites, saveFavorites]);

  const isFavorite = useCallback((stationUuid: string) => {
    return favorites.includes(stationUuid);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite, isFavoritesLoaded: isLoaded };
};
