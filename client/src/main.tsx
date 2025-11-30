import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { SettingsApp } from './SettingsApp.tsx'
import { TransitApp } from './TransitApp.tsx'
import './index.css'

// Use the specific IDs we defined in the PHP shortcodes
const chartRoot = document.getElementById('ahd-root');
const transitRoot = document.getElementById('ahd-transit-root');
const settingsRoot = document.getElementById('ahd-settings-root');

if (chartRoot) {
  ReactDOM.createRoot(chartRoot).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

if (transitRoot) {
  ReactDOM.createRoot(transitRoot).render(
    <React.StrictMode>
      <TransitApp />
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
