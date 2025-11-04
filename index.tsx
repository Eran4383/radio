import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Render the main app directly. The initial loader will be hidden by the App component
// once it has finished loading necessary data.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
