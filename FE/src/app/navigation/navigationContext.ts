import { createContext } from "react";

export type Destination =
  string | { pathname: string; search?: string; hash?: string };

export interface EntryState {
  checklistDetailDepth?: number;
  loginModal?: { returnTo: string; hasBackground?: boolean };
}

export interface NavigationOptions {
  replace?: boolean;
  preventScrollReset?: boolean;
  state?: EntryState | null;
}

export interface Location {
  ready: boolean;
  pathname: string;
  search: string;
  hash: string;
  key: string;
  state: EntryState | null;
}

export type NavigateTo = (
  destination: Destination | number,
  options?: NavigationOptions,
) => void;

export const NavigationContext = createContext<{
  location: Location;
  navigate: NavigateTo;
  startNavigation: (destination: string) => void;
} | null>(null);
