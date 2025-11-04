import React from 'react';
import { User } from '../services/firebaseService';
import { GoogleIcon, LogoutIcon } from './Icons';

interface AuthProps {
    user: User | null;
    loading: boolean;
    signIn: () => void;
    signOut: () => void;
}

const Auth: React.FC<AuthProps> = ({ user, loading, signIn, signOut }) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="w-6 h-6 border-4 border-gray-500 border-t-accent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (user) {
        return (
            <div className="flex items-center justify-between p-2 rounded-lg bg-bg-primary">
                <div className="flex items-center gap-3 min-w-0">
                    <img src={user.photoURL || undefined} alt="User" className="w-10 h-10 rounded-full flex-shrink-0" />
                    <span className="font-medium text-text-primary truncate">{user.displayName}</span>
                </div>
                <button onClick={signOut} className="p-2 text-text-secondary hover:text-accent flex-shrink-0" title="התנתקות">
                    <LogoutIcon className="w-6 h-6" />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-base font-semibold rounded-lg bg-white text-gray-700 hover:bg-gray-200 transition-colors"
        >
            <GoogleIcon className="w-5 h-5" />
            <span>התחברות עם גוגל</span>
        </button>
    );
};

export default Auth;
