import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiClient } from '../services/api';

interface AuthState {
  userId: string | null;
  username: string | null;
  token: string | null;
  login: (
    username: string,
    password: string,
    turnstileToken?: string | null
  ) => Promise<{ requires2FA: boolean; preAuthToken?: string }>;
  verify2FA: (preAuthToken: string, code: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    email: string,
    displayName: string,
    turnstileToken?: string | null
  ) => Promise<void>;
  logout: () => void;
  setAuth: (userId: string, username: string, token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      username: null,
      token: null,

      setAuth: (userId, username, token) => {
        set({ userId, username, token });
      },

      login: async (username, password, turnstileToken) => {
        const data = await ApiClient.login(username, password, turnstileToken);
        if (data.requires2FA && data.preAuthToken) {
          return { requires2FA: true, preAuthToken: data.preAuthToken };
        }
        if (data.token) {
          set({ userId: data.userId, username: data.username, token: data.token });
        }
        return { requires2FA: false };
      },

      verify2FA: async (preAuthToken, code) => {
        const data = await ApiClient.verify2FA(preAuthToken, code);
        set({ userId: data.userId, username: data.username, token: data.token });
      },

      register: async (username, password, email, displayName, turnstileToken) => {
        const data = await ApiClient.register(username, password, email, displayName, turnstileToken);
        set({ userId: data.userId, username: data.username, token: data.token });
      },

      logout: () => {
        set({ userId: null, username: null, token: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
