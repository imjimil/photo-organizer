import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/gloock/400.css'
import '@fontsource-variable/mona-sans/wdth.css'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './hooks/useToast.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
