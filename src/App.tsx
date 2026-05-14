import { useState } from 'react';
import Home from './pages/Home';
import Register from './pages/Register';
import FaceList from './pages/FaceList';
import ActivityLog from './pages/ActivityLog';
import { useBluetooth } from './hooks/useBluetooth';

type Page = 'home' | 'register' | 'faces' | 'log';

function App() {
  const [page, setPage] = useState<Page>('home');
  const bt = useBluetooth();

  const go = (p: Page) => setPage(p);

  switch (page) {
    case 'register':
      return <Register onBack={() => go('home')} bt={bt} />;
    case 'faces':
      return <FaceList onBack={() => go('home')} bt={bt} />;
    case 'log':
      return <ActivityLog onBack={() => go('home')} bt={bt} />;
    default:
      return <Home onNavigate={go} />;
  }
}

export default App;
