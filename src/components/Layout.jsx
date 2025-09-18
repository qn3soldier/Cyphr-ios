import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <div className="min-h-screen bg-black">
      <div className="pb-20"> {/* Padding for bottom nav */}
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
} 