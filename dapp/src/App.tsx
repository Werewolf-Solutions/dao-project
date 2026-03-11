import { Outlet } from 'react-router-dom';
import Header from '@/layout/Header';
import Footer from '@/layout/Footer';
import MobileNav from '@/layout/MobileNav';

export default function App() {
  return (
    <div>
      <Header />
      <Outlet />
      <Footer />
      <MobileNav />
    </div>
  );
}
