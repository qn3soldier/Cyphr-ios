import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// НЕ ИМПОРТИРУЕМ pushNotifications чтобы не было автоматических запросов
// НЕ ИНИЦИАЛИЗИРУЕМ сервисы автоматически

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
); 