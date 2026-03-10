import React from 'react';
import { createBrowserRouter } from 'react-router';
import { PageLoader } from './components/PageLoader';

// Static imports to avoid dynamic module loading issues in the preview environment
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GenerateSchedule from './pages/GenerateSchedule';
import SwapRequests from './pages/SwapRequests';
import NotFound from './pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Login,
  },
  {
    path: '/signup',
    Component: Signup,
  },
  {
    path: '/dashboard',
    Component: Dashboard,
  },
  {
    path: '/admin',
    Component: GenerateSchedule,
  },
  {
    path: '/swap-requests',
    Component: SwapRequests,
  },
  {
    path: '*',
    Component: NotFound,
  },
]);