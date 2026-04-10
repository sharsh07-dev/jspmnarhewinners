import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { 
    MdDashboard, MdSearch, MdPsychology, MdSwapHorizontalCircle, 
    MdTrendingUp, MdGavel, MdAccountBalance, MdHelpCenter, MdPeople,
    MdChevronRight, MdMenuOpen, MdKeyboardArrowLeft, MdKeyboardArrowRight,
    MdSmartToy, MdSensors
} from "react-icons/md";
import useUIStore from "../store/useUIStore";

const SidebarLink = ({ to, icon, label, badge, isCollapsed }) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link to={to} className="relative group">
            <div className={`flex items-center gap-2.5 ${isCollapsed ? "justify-center px-0" : "px-3"} py-2.5 rounded-xl transition-all duration-300 ${
                isActive 
                ? "bg-green-600 text-white shadow-lg shadow-green-100" 
                : "text-gray-500 hover:bg-green-50 hover:text-green-700"
            }`}>
                <div className={`text-lg transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`}>
                    {icon}
                </div>
                {!isCollapsed && <span className="font-bold text-[13px] tracking-tight whitespace-nowrap">{label}</span>}
                {badge && !isCollapsed && (
                    <span className="ml-auto bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-white">
                        {badge}
                    </span>
                )}
            </div>
            {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap">
                    {label}
                </div>
            )}
        </Link>
    );
};

const Sidebar = () => {
    const { user } = useAuthStore();
    const { isSidebarCollapsed: isCollapsed, toggleSidebar } = useUIStore();
    
    if (!user) return null;

    const farmerLinks = [
        { to: "/dashboard", icon: <MdDashboard />, label: "Dashboard" },
        { to: "/equipment", icon: <MdSearch />, label: "Find Equipment" },
        { to: "/schemes", icon: <MdAccountBalance />, label: "Govt Schemes" },
        { to: "/ai-recommendations", icon: <MdPsychology />, label: "AI Advisor" },
        { to: "/mandi-advisor", icon: <MdSmartToy />, label: "Mandi Bot", badge: "HOT" },
        { to: "/farm-monitoring", icon: <MdSensors />, label: "Farm Monitor" },
        { to: "/pesticide-exchange", icon: <MdSwapHorizontalCircle />, label: "Pesticide Exchange" },
        { to: "/mandi-prices", icon: <MdTrendingUp />, label: "Mandi Prices" },
        { to: "/find-labour", icon: <MdPeople />, label: "Find Labour", badge: "NEW" },
    ];

    const adminLinks = [
        { to: "/admin", icon: <MdDashboard />, label: "Admin Console" },
        { to: "/dashboard", icon: <MdTrendingUp />, label: "Platform Pulse" },
    ];


    const laborLinks = [
        { to: "/labour", icon: <MdDashboard />, label: "My Profile" },
        { to: "/labour/work", icon: <MdSearch />, label: "Find Work", badge: "NEW" },
    ];

    const auditLinks = [
        { to: "/audit", icon: <MdDashboard />, label: "Audit Center" },
    ];

    const roleLinks = {
        farmer: farmerLinks,
        admin: adminLinks,
        labour: laborLinks,
        audit: auditLinks
    };

    const role = user.role?.toLowerCase();
    const links = roleLinks[role] || [];

    return (
        <>
        {/* Desktop Sidebar */}
        <aside className={`fixed left-0 top-[68px] bottom-0 ${isCollapsed ? "w-16" : "w-56"} bg-white border-r border-gray-100 hidden md:flex flex-col p-3 z-40 transition-all duration-300 ease-in-out shadow-sm`}>
            {/* Collapse Toggle */}
            <button 
                onClick={toggleSidebar}
                className="absolute -right-3 top-4 w-6 h-6 bg-white border border-gray-100 shadow-sm rounded-full flex items-center justify-center text-gray-400 hover:text-green-600 hover:scale-110 transition-all z-50"
            >
                {isCollapsed ? <MdKeyboardArrowRight /> : <MdKeyboardArrowLeft />}
            </button>

            <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
                <p className={`text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2 ${isCollapsed ? "text-center" : "ml-3"}`}>
                    {isCollapsed ? "•••" : "Main Menu"}
                </p>
                {links.map((link, idx) => (
                    <SidebarLink key={idx} {...link} isCollapsed={isCollapsed} />
                ))}
            </div>

            <div className={`mt-auto pt-4 space-y-2 border-t border-gray-50 ${isCollapsed ? "items-center" : ""}`}>
                {!isCollapsed && (
                    <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 relative overflow-hidden group">
                        <p className="text-[10px] font-bold text-green-800 tracking-tight mb-0.5">Insurance 🛡️</p>
                        <p className="text-[9px] text-green-600 font-bold leading-tight">Crops protected under PMFBY.</p>
                        <button className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-green-700">
                            STATUS <MdChevronRight />
                        </button>
                    </div>
                )}

                <div className={`flex items-center gap-2 ${isCollapsed ? "justify-center" : "px-3"} py-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer group relative`}>
                    <MdHelpCenter className="text-lg" />
                    {!isCollapsed && <span className="text-[12px] font-bold">Support</span>}
                    {isCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Support
                        </div>
                    )}
                </div>
            </div>
        </aside>

        {/* Mobile Bottom Navigation (Native App Feel) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50 flex justify-around items-center px-2 pt-2 pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-4px_25px_rgba(0,0,0,0.05)] pb-safe rounded-t-[20px]">
            {links.slice(0, 5).map((link, idx) => {
                const isActive = location.pathname === link.to;
                return (
                    <Link key={idx} to={link.to} className={`flex flex-col items-center justify-center gap-1 p-2 w-full transition-all duration-200 min-h-[44px] ${isActive ? "text-green-600" : "text-gray-400 hover:text-gray-600"}`}>
                        <div className={`text-2xl transition-transform duration-200 ${isActive ? "scale-110 drop-shadow-sm" : ""}`}>
                            {link.icon}
                        </div>
                        <span className={`text-[10px] font-bold tracking-tight ${isActive ? "text-green-600" : "text-gray-500"}`}>
                            {link.label.split(" ")[0]}
                        </span>
                    </Link>
                );
            })}
        </nav>
        </>
    );
};

export default Sidebar;
