import { useState, useCallback } from 'react';

const FAVORITES_KEY = 'radio-favorites';

function safeParseFavorites(jsonString) {
    if (!jsonString) {
        return [];
    }
    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            return parsed;
        }
    } catch (e) {
        console.warn("Could not parse favorites from localStorage", e);
    }
    return [];
}


export const useFavorites = () => {
  const [favorites, setFavorites] = useState(() => {
    return safeParseFavorites(localStorage.getItem(FAVORITES_KEY));
  });

  const toggleFavorite = useCallback((stationUuid) => {
    setFavorites(currentFavorites => {
      const isCurrentlyFavorite = currentFavorites.includes(stationUuid);
      const newFavorites = isCurrentlyFavorite
        ? currentFavorites.filter(uuid => uuid !== stationUuid)
        : [...currentFavorites, stationUuid];

      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      } catch (error) {
        console.error("Failed to save favorites to localStorage", error);
      }

      return newFavorites;
    });
  }, []);

  const isFavorite = useCallback((stationUuid) => {
    return favorites.includes(stationUuid);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
};
