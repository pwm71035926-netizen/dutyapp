import { createContext } from 'react';

export const NavigationContext = createContext<{
  isNavigating: boolean;
  startNavigation: (to: string, navigateFn: (to: string) => void) => void;
}>({
  isNavigating: false,
  startNavigation: () => {}
});
