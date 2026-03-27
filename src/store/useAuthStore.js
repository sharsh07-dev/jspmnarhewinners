import { create } from "zustand";

const useAuthStore = create((set) => ({
    authUser: null,     // Firebase Auth user object
    user: null,         // DB user profile {name, role, village, ...}
    isLoading: true,
    setAuthUser: (authUser) => set({ authUser }),
    setUser: (user) => set({ user }),
    setLoading: (isLoading) => set({ isLoading }),
    logout: () => set({ authUser: null, user: null }),
}));

export default useAuthStore;
