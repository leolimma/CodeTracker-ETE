import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getAccessToken } from './services/neonAuth';

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (typeof input === 'string' && input.startsWith('/api')) {
    const token = await getAccessToken();
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    // Also redirect /api/classes to /api/turmas, /api/students to /api/alunos, etc.
    let url = input;
    if (url === '/api/classes') url = '/api/turmas';
    else if (url.startsWith('/api/classes/') && url.endsWith('/students')) url = url.replace('/api/classes/', '/api/alunos?turma_id=').replace('/students', '');
    else if (url === '/api/students') url = '/api/alunos';
    else if (url === '/api/exercises') url = '/api/exercicios';
    else if (url === '/api/teachers') url = '/api/professores';
    else if (url === '/api/classes/create') url = '/api/turmas';
    
    return originalFetch(url, { ...init, headers });
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

