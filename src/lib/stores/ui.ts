'use client';
import { create } from 'zustand';
import { uid } from '@/lib/utils';

export interface Toast { id: string; message: string; tone: 'default' | 'error' }

interface UiStore {
  toasts: Toast[];
  reflectionOpen: boolean;
  printJob: { title: string; markdown: string } | null;
  /** The water reminder card is showing. */
  waterPrompt: boolean;
  /** A pop-up quiz question is showing. */
  popQuiz: boolean;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: string) => void;
  setReflectionOpen: (open: boolean) => void;
  print: (job: { title: string; markdown: string } | null) => void;
}

export const useUi = create<UiStore>()((set, get) => ({
  toasts: [],
  reflectionOpen: false,
  printJob: null,
  waterPrompt: false,
  popQuiz: false,
  toast: (message, tone = 'default') => {
    const id = uid();
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone }] });
    setTimeout(() => get().dismiss(id), 4500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setReflectionOpen: (reflectionOpen) => set({ reflectionOpen }),
  print: (printJob) => set({ printJob }),
}));

/** Shorthand usable outside React components. */
export const toast = (message: string, tone?: Toast['tone']) => useUi.getState().toast(message, tone);
