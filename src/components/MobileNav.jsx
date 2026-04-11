import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../store/useAuthStore";

const FARMER_TABS = [
    { id: "home",    icon: "🏠", label: "Home",    path: "/mobile"          },
    { id: "rent",    icon: "🚜", label: "Rent",    path: "/equipment"       },
    { id: "market",  icon: "📊", label: "Market",  path: "/mandi-prices"    },
    { id: "exchange",icon: "🌿", label: "Exchange", path: "/pesticide-exchange" },
    { id: "profile", icon: "👤", label: "Profile", path: "/dashboard"       },
];

const MobileNav = () => {
    const { user } = useAuthStore();
    const navigate  = useNavigate();
    const location  = useLocation();

    if (!user || user.role?.toLowerCase() !== "farmer") return null;

    const activeTab = (() => {
        const p = location.pathname;
        if (p === "/mobile" || p === "/") return "home";
        if (p.startsWith("/equipment")) return "rent";
        if (p.startsWith("/mandi-prices") || p.startsWith("/mandi-advisor")) return "market";
        if (p.startsWith("/pesticide-exchange")) return "exchange";
        if (p.startsWith("/dashboard")) return "profile";
        return "home";
    })();

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-[60] md:hidden"
            style={{
                background: "rgba(255,255,255,0.97)",
                backdropFilter: "blur(20px)",
                borderTop: "1px solid rgba(0,0,0,0.06)",
                paddingBottom: "env(safe-area-inset-bottom, 8px)",
                boxShadow: "0 -4px 24px rgba(0,0,0,0.07)"
            }}
        >
            <div className="flex items-center justify-around px-2 pt-2 pb-1">
                {FARMER_TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => navigate(tab.path)}
                            className="flex flex-col items-center justify-center min-w-[56px] py-1 relative"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="mobile-tab-indicator"
                                    className="absolute inset-x-1 -top-1 h-0.5 rounded-full bg-green-600"
                                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                                />
                            )}
                            <span
                                style={{ fontSize: 22, lineHeight: 1 }}
                                className={`mb-0.5 transition-transform duration-200 ${isActive ? "scale-110" : "scale-100 opacity-60"}`}
                            >
                                {tab.icon}
                            </span>
                            <span
                                style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}
                                className={`tracking-wide ${isActive ? "text-green-600" : "text-gray-400"}`}
                            >
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileNav;
