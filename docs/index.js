import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { auth } from './services/firebase.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// This is the gatekeeper. It waits for Firebase to determine the auth state
// *before* rendering the main app. This solves the race condition.
auth.onAuthStateChanged((user) => {
  root.render(
    React.createElement(React.StrictMode, null,
      React.createElement(App, { initialUser: user })
    )
  );
  // Hide the initial loader once the app is ready to render
  const loader = document.querySelector('.app-loader');
  if (loader) {
    loader.style.display = 'none';
  }
});
