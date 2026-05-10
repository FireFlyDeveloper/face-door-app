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

  const handleNavigate = (p: string) => {
    setPage(p as Page);
  };

  switch (page) {
    case 'register':
      return <Register onBack={() => setPage('home')} bt={bt} />;
    case 'faces':
      return <FaceList onBack={() => setPage('home')} bt={bt} />;
    case 'log':
      return <ActivityLog onBack={() => setPage('home')} bt={bt} />;
    default:
      return <Home onNavigate={handleNavigate} />;
  }
}

export default App;
