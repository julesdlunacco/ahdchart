import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { SettingsApp } from './SettingsApp.tsx'
import { TransitApp } from './TransitApp.tsx'
import { ConnectionApp } from './ConnectionApp.tsx'
import { TransitCompositeApp } from './TransitCompositeApp.tsx'
import { ChartShell } from './ChartShell.tsx'
import './index.css'

// Use the specific IDs we defined in the PHP shortcodes
const chartRoot = document.getElementById('ahd-root');              // Main with dropdown
const birthRoot = document.getElementById('ahd-birth-root');        // Birth only
const transitRoot = document.getElementById('ahd-transit-root');    // Transit only
const connectionRoot = document.getElementById('ahd-connection-root'); // Connection only
const transitBirthRoot = document.getElementById('ahd-transit-birth-root'); // Transit+Birth only
const settingsRoot = document.getElementById('ahd-settings-root');

// Main chart with dropdown selector
if (chartRoot) {
  ReactDOM.createRoot(chartRoot).render(
    <React.StrictMode>
      <ChartShell />
    </React.StrictMode>,
  )
}

// Birth chart only (no dropdown)
if (birthRoot) {
  ReactDOM.createRoot(birthRoot).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

// Transit chart only
if (transitRoot) {
  ReactDOM.createRoot(transitRoot).render(
    <React.StrictMode>
      <TransitApp />
    </React.StrictMode>,
  )
}

// Connection chart only
if (connectionRoot) {
  ReactDOM.createRoot(connectionRoot).render(
    <React.StrictMode>
      <ConnectionApp />
    </React.StrictMode>,
  )
}

// Transit + Birth composite only
if (transitBirthRoot) {
  ReactDOM.createRoot(transitBirthRoot).render(
    <React.StrictMode>
      <TransitCompositeApp />
    </React.StrictMode>,
  )
}

// Settings page
if (settingsRoot) {
    ReactDOM.createRoot(settingsRoot).render(
        <React.StrictMode>
            <SettingsApp />
        </React.StrictMode>
    )
}
