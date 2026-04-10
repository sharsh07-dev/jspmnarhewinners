import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { Toaster } from "react-hot-toast";
import { AnimatePresence } from "framer-motion";

import { auth, db } from "./firebase";
import useAuthStore from "./store/useAuthStore";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import useUIStore from "./store/useUIStore";
import Footer from "./components/Footer";

import HomePage from "./pages/HomePage";
import EquipmentListing from "./pages/EquipmentListing";
import DiscoveryWizard from "./pages/DiscoveryWizard";
import EquipmentDetail from "./pages/EquipmentDetail";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard"; // Replaces AdminPanel for specific dashboard
import LabourDashboard from "./pages/LabourDashboard";
import LabourMyWork from "./pages/LabourMyWork";
import AuditDashboard from "./pages/AuditDashboard";
import AuthPage from "./pages/AuthPage";
import AIRecommendations from "./pages/AIRecommendations";
import PesticideExchange from "./pages/PesticideExchange";
import LiveMandiPrices from "./pages/LiveMandiPrices";
import MandiAdvisor from "./pages/MandiAdvisor";
import SchemeDiscovery from "./pages/SchemeDiscovery";
import LabourDiscovery from "./pages/LabourDiscovery";
import FarmMonitoring from "./pages/FarmMonitoring";
import FarmerChatbot from "./components/FarmerChatbot";

const AppContent = () => {
    const { setAuthUser, setUser, setLoading, user, isLoading } = useAuthStore();
    const { isSidebarCollapsed } = useUIStore();
    const location = useLocation();
    const isHome = location.pathname === "/";

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
    <div className="flex flex-col min-h-screen font-display">
        <Navbar />
        <Sidebar />
        {(!user || user?.role?.toLowerCase() === "farmer") && <FarmerChatbot />}
        <main className={`flex-grow transition-all duration-300 w-full overflow-x-hidden ${user ? (isSidebarCollapsed ? "md:pl-16" : "md:pl-56") + " pb-24 md:pb-0" : ""} ${(!user && isHome) ? "" : "pt-[68px]"}`}>
          <Routes>
            <Route path="/" element={!user ? <HomePage /> : (user.role?.toLowerCase() === 'farmer' ? <Navigate to="/equipment" replace /> : <Navigate to={`/${user.role?.toLowerCase()}`} replace />)} />
            <Route path="/equipment" element={(!user || user?.role?.toLowerCase() === "farmer") ? <DiscoveryWizard /> : <Navigate to="/" replace />} />
            <Route path="/equipment/:id" element={(!user || user?.role?.toLowerCase() === "farmer") ? <EquipmentDetail /> : <Navigate to="/" replace />} />
            <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to={user.role?.toLowerCase() === 'farmer' ? '/equipment' : `/${user.role?.toLowerCase() === 'admin' ? 'admin' : user.role?.toLowerCase()}`} replace />} />
            <Route path="/dashboard" element={user?.role?.toLowerCase() === "farmer" ? <Dashboard /> : <Navigate to="/" replace />} />
            <Route path="/ai-recommendations" element={user?.role?.toLowerCase() === "farmer" ? <AIRecommendations /> : <Navigate to="/" replace />} />
            <Route path="/pesticide-exchange" element={user?.role?.toLowerCase() === "farmer" ? <PesticideExchange /> : <Navigate to="/" replace />} />
            <Route path="/mandi-prices" element={user?.role?.toLowerCase() === "farmer" ? <LiveMandiPrices /> : <Navigate to="/" replace />} />
            <Route path="/mandi-advisor" element={user?.role?.toLowerCase() === "farmer" ? <MandiAdvisor /> : <Navigate to="/" replace />} />
            <Route path="/schemes" element={user?.role?.toLowerCase() === "farmer" ? <SchemeDiscovery /> : <Navigate to="/" replace />} />
            <Route path="/farm-monitoring" element={user?.role?.toLowerCase() === "farmer" ? <FarmMonitoring /> : <Navigate to="/" replace />} />
            <Route path="/find-labour" element={user?.role?.toLowerCase() === "farmer" ? <LabourDiscovery /> : <Navigate to="/" replace />} />
            <Route path="/admin" element={user?.role?.toLowerCase() === "admin" ? <AdminDashboard /> : <Navigate to="/" replace />} />
            <Route path="/labour" element={user?.role?.toLowerCase() === "labour" ? <LabourDashboard /> : <Navigate to="/" replace />} />
            <Route path="/labour/work" element={user?.role?.toLowerCase() === "labour" ? <LabourMyWork /> : <Navigate to="/" replace />} />
            <Route path="/audit" element={user?.role?.toLowerCase() === "audit" ? <AuditDashboard /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {!user && <Footer />}

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
    );
};

const App = () => (
    <Router>
        <AppContent />
    </Router>
);

export default App;
