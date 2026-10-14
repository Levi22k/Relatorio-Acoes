import {createRoot} from 'react-dom/client';
import {installLocalApi} from './local-api';
import '../app/globals.css';
import '../app/visual.css';
import Dashboard from '../app/dashboard';

// Substitui o servidor: as rotas /api/* passam a ser respondidas dentro do navegador.
installLocalApi();

createRoot(document.getElementById('root')!).render(<Dashboard/>);
