import React from 'react';
import { GoogleIcon } from './Icons.js';

const Auth = ({ user, onLogin, onLogout }) => {
  if (user) {
    return (
      React.createElement("div", { className: "flex flex-col items-center gap-1" },
        React.createElement("img", {
          src: user.photoURL || undefined,
          alt: user.displayName || 'User',
          className: "w-10 h-10 rounded-full ring-2 ring-accent",
          referrerPolicy: "no-referrer"
        }),
        React.createElement("div", { className: "text-center" },
            React.createElement("p", { className: "text-xs text-text-primary font-semibold truncate max-w-[60px]" }, user.displayName),
            React.createElement("button", {
                onClick: onLogout,
                className: "text-xs text-accent hover:underline"
            },
                "התנתק"
            )
        )
      )
    );
  }

  return (
    React.createElement("button", {
      onClick: onLogin,
      className: "flex flex-col items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
    },
      React.createElement("div", { className: "w-10 h-10 rounded-full bg-bg-primary flex items-center justify-center ring-2 ring-gray-600 hover:ring-accent transition-all" },
        React.createElement(GoogleIcon, { className: "w-6 h-6" })
      ),
      React.createElement("p", { className: "text-xs mt-1" }, "התחברות")
    )
  );
};

export default Auth;
