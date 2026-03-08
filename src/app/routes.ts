import { createBrowserRouter } from 'react-router';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GenerateSchedule from './pages/GenerateSchedule';
import SwapRequests from './pages/SwapRequests';

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
    path: '/generate',
    Component: GenerateSchedule,
  },
  {
    path: '/swap-requests',
    Component: SwapRequests,
  },
]);
