import React from 'react';
import { GoogleIcon } from './Icons';
import type firebase from 'firebase/compat/app';

interface AuthProps {
  user: firebase.User | null;
  onLogin: () => void;
  onLogout: () => void;
}

const Auth: React.FC<AuthProps> = ({ user, onLogin, onLogout }) => {
  if (user) {
    return (
      <div className="flex flex-col items-center gap-1">
        <img
          src={user.photoURL || undefined}
          alt={user.displayName || 'User'}
          className="w-10 h-10 rounded-full ring-2 ring-accent"
          referrerPolicy="no-referrer"
        />
        <div className="text-center">
            <p className="text-xs text-text-primary font-semibold truncate max-w-[60px]">{user.displayName}</p>
            <button
                onClick={onLogout}
                className="text-xs text-accent hover:underline"
            >
                התנתק
            </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onLogin}
      className="flex flex-col items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-bg-primary flex items-center justify-center ring-2 ring-gray-600 hover:ring-accent transition-all">
        <GoogleIcon className="w-6 h-6" />
      </div>
      <p className="text-xs mt-1">התחברות</p>
    </button>
  );
};

export default Auth;
