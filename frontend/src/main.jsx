import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1d29',
            color: '#e8ecf1',
            border: '1px solid rgba(255,255,255,0.1)',
          },
          success: {
            iconTheme: {
              primary: '#4ade80',
              secondary: '#1a1d29',
            },
          },
          error: {
            iconTheme: {
              primary: '#f87171',
              secondary: '#1a1d29',
            },
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
)
