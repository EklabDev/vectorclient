import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiClient } from '../services/api';

interface AuthState {
  userId: string | null;
  username: string | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email: string, displayName: string) => Promise<void>;
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

      login: async (username, password) => {
        const data = await ApiClient.login(username, password) as { userId: string; username: string; token: string };
        set({ userId: data.userId, username: data.username, token: data.token });
      },

      register: async (username, password, email, displayName) => {
        const data = await ApiClient.register(username, password, email, displayName) as { userId: string; username: string; token: string };
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
