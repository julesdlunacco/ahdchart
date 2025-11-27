import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { SettingsApp } from './SettingsApp.tsx'
import './index.css'

// Use the specific ID we defined in the PHP shortcode
const chartRoot = document.getElementById('ahd-root');
const settingsRoot = document.getElementById('ahd-settings-root');

if (chartRoot) {
  ReactDOM.createRoot(chartRoot).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

if (settingsRoot) {
    ReactDOM.createRoot(settingsRoot).render(
        <React.StrictMode>
            <SettingsApp />
        </React.StrictMode>
    )
}
