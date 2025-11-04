
import { useState, useEffect, useCallback } from 'react';

const FAVORITES_KEY = 'radio-favorites';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem(FAVORITES_KEY);
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
      }
    } catch (error) {
      console.error("Failed to load favorites from localStorage", error);
    }
  }, []);

  const saveFavorites = (newFavorites: string[]) => {
    try {
      setFavorites(newFavorites);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch (error) {
      console.error("Failed to save favorites to localStorage", error);
    }
  };

  const addFavorite = useCallback((stationUuid: string) => {
    saveFavorites([...favorites, stationUuid]);
  }, [favorites]);

  const removeFavorite = useCallback((stationUuid: string) => {
    saveFavorites(favorites.filter(uuid => uuid !== stationUuid));
  }, [favorites]);

  const isFavorite = useCallback((stationUuid: string) => {
    return favorites.includes(stationUuid);
  }, [favorites]);

  const toggleFavorite = useCallback((stationUuid: string) => {
    if (isFavorite(stationUuid)) {
      removeFavorite(stationUuid);
    } else {
      addFavorite(stationUuid);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  return { favorites, toggleFavorite, isFavorite };
};
