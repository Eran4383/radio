import React from 'react';
import { GoogleIcon, LogoutIcon } from './Icons.js';

const Auth = ({ user, loading, signIn, signOut }) => {
    if (loading) {
        return React.createElement("div", { className: "flex items-center justify-center p-4" },
            React.createElement("div", { className: "w-6 h-6 border-4 border-gray-500 border-t-accent rounded-full animate-spin" })
        );
    }

    if (user) {
        return React.createElement("div", { className: "flex items-center justify-between p-2 rounded-lg bg-bg-primary" },
            React.createElement("div", { className: "flex items-center gap-3 min-w-0" },
                React.createElement("img", { src: user.photoURL || undefined, alt: "User", className: "w-10 h-10 rounded-full flex-shrink-0" }),
                React.createElement("span", { className: "font-medium text-text-primary truncate" }, user.displayName)
            ),
            React.createElement("button", { onClick: signOut, className: "p-2 text-text-secondary hover:text-accent flex-shrink-0", title: "התנתקות" },
                React.createElement(LogoutIcon, { className: "w-6 h-6" })
            )
        );
    }

    return React.createElement("button", {
        onClick: signIn,
        className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-base font-semibold rounded-lg bg-white text-gray-700 hover:bg-gray-200 transition-colors"
    },
        React.createElement(GoogleIcon, { className: "w-5 h-5" }),
        React.createElement("span", null, "התחברות עם גוגל")
    );
};

export default Auth;