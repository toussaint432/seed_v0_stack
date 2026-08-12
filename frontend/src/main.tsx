import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles.css'
import { App } from './ui/App'
import { ErrorBoundary } from './ui/ErrorBoundary'

// Forcer l'URL canonique localhost:5173 pour éviter les conflits de session Keycloak.
// Si l'utilisateur accède via 127.0.0.1, Keycloak reçoit un redirect_uri différent
// de la session en cours → ERR_EMPTY_RESPONSE. On corrige avant tout rendu.
if (window.location.hostname === '127.0.0.1') {
  window.location.replace(window.location.href.replace('127.0.0.1', 'localhost'))
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
