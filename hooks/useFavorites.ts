import { useCallback } from 'react';

export const useFavorites = (favorites: string[], onFavoritesChange: (newFavorites: string[]) => void) => {
  const toggleFavorite = (stationId: string) => {
    const isFav = favorites.includes(stationId);
    let newFavorites: string[];
    if (isFav) {
      newFavorites = favorites.filter(id => id !== stationId);
    } else {
      newFavorites = [...favorites, stationId];
    }
    onFavoritesChange(newFavorites);
  };

  const isFavorite = (stationId: string) => {
    return favorites.includes(stationId);
  };

  return { favorites, toggleFavorite, isFavorite };
};
