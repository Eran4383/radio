import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { auth } from './services/firebase';
import type firebase from 'firebase/compat/app';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// This is the gatekeeper. It waits for Firebase to determine the auth state
// *before* rendering the main app. This solves the race condition.
auth.onAuthStateChanged((user: firebase.User | null) => {
  root.render(
    <React.StrictMode>
      <App initialUser={user} />
    </React.StrictMode>
  );
  // Hide the initial loader once the app is ready to render
  // FIX: Cast the result of querySelector to HTMLElement to access the 'style' property.
  const loader = document.querySelector<HTMLElement>('.app-loader');
  if (loader) {
    loader.style.display = 'none';
  }
});