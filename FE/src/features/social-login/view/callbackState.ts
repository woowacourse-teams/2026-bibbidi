import { createContext, useContext } from "react";

export interface LoginCallback {
  provider: string;
  search: string;
  returnTo: string;
}

export const LoginCallbackContext = createContext<{
  setCallback: (callback: LoginCallback | null) => void;
} | null>(null);

export const useLoginCallback = () => useContext(LoginCallbackContext);
