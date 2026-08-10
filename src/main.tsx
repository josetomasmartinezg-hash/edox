import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AdminPanel } from './components/AdminPanel.tsx'
import './index.css'

const isAdmin = window.location.pathname.startsWith('/admin')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isAdmin ? <AdminPanel /> : <App />}</StrictMode>,
)
