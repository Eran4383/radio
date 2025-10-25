import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initFirebase } from './services/firebase';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

initFirebase().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}).catch(error => {
    console.error("Failed to initialize application:", error);
    root.render(
        React.createElement("div", { style: { padding: '2rem', textAlign: 'center', color: 'white' } },
            React.createElement("h1", null, "שגיאת טעינה"),
            React.createElement("p", null, "לא ניתן לטעון את האפליקציה. אנא בדוק את חיבור האינטרנט ונסה לרענן את העמוד.")
        )
    );
});


// Service worker registration is now handled in App.tsx to manage update state.