import { create } from "zustand";

const useUIStore = create((set) => ({
    lang: localStorage.getItem("agro_lang") || "en",
    setLang: (lang) => {
        localStorage.setItem("agro_lang", lang);
        set({ lang });
    },
    notifications: [],
    addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications].slice(0, 20) })),
    clearNotifications: () => set({ notifications: [] }),
}));

export default useUIStore;
