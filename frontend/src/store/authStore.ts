import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          throw new Error('Login failed');
        }

        const data = await response.json();
        set({ userId: data.userId, username: data.username, token: data.token });
      },

      register: async (username, password, email, displayName) => {
        const response = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, email, displayName }),
        });

        if (!response.ok) {
          throw new Error('Registration failed');
        }

        const data = await response.json();
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
