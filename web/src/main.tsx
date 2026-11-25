import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { TooltipProvider } from './components/ui/tooltip'
import { applyTheme, parseTheme } from './lib/theme'
import './index.css'

applyTheme(parseTheme(localStorage.getItem('isekai-office-theme')))

const root = document.getElementById('root')
if (!root) {
  throw new Error('missing #root')
}

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>
)
