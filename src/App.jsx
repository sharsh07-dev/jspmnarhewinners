import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { Toaster } from "react-hot-toast";
import { AnimatePresence } from "framer-motion";

import { auth, db } from "./firebase";
import useAuthStore from "./store/useAuthStore";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import HomePage from "./pages/HomePage";
import EquipmentListing from "./pages/EquipmentListing";
import EquipmentDetail from "./pages/EquipmentDetail";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import AuthPage from "./pages/AuthPage";
import AIRecommendations from "./pages/AIRecommendations";
import PesticideExchange from "./pages/PesticideExchange";
import LiveMandiPrices from "./pages/LiveMandiPrices";
import FarmerChatbot from "./components/FarmerChatbot";

function App() {
  const { setAuthUser, setUser, setLoading, user, isLoading } = useAuthStore();

  useEffect(() => {
    let userUnsub;
    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setAuthUser(firebaseUser);
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        // Real-time DB listener keeps profile in sync
        userUnsub = onValue(userRef, (snap) => {
          setUser(snap.exists() ? snap.val() : null);
          setLoading(false);
        });
      } else {
        setAuthUser(null);
        setUser(null);
        setLoading(false);
        if (userUnsub) userUnsub();
      }
    });
    return () => {
      authUnsub();
      if (userUnsub) userUnsub();
    };
  }, [setAuthUser, setUser, setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-900 to-emerald-800">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-green-300 border-t-white mb-4" />
        <p className="text-green-100 font-semibold text-lg font-display">Loading AgroShare…🌱</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <FarmerChatbot />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={!user ? <HomePage /> : <Navigate to="/equipment" replace />} />
            <Route path="/equipment" element={<EquipmentListing />} />
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
            <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/equipment" replace />} />
            <Route
              path="/dashboard"
              element={user ? <Dashboard /> : <Navigate to="/auth" replace />}
            />
            <Route
               path="/ai-recommendations"
               element={user ? <AIRecommendations /> : <Navigate to="/auth" replace />}
            />
            <Route
               path="/pesticide-exchange"
               element={user ? <PesticideExchange /> : <Navigate to="/auth" replace />}
            />
            <Route
               path="/mandi-prices"
               element={user ? <LiveMandiPrices /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/admin"
              element={user?.role === "admin" ? <AdminPanel /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: "16px",
              background: "#1f2937",
              color: "#fff",
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
