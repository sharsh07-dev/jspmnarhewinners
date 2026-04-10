import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { 
    MdDashboard, MdSearch, MdPsychology, MdSwapHorizontalCircle, 
    MdTrendingUp, MdGavel, MdAccountBalance, MdHelpCenter,
    MdChevronRight
} from "react-icons/md";

const SidebarLink = ({ to, icon, label, badge }) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link to={to} className="relative group">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${
                isActive 
                ? "bg-green-600 text-white shadow-lg shadow-green-100 translate-x-1" 
                : "text-gray-500 hover:bg-green-50 hover:text-green-700"
            }`}>
                <div className={`text-xl transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`}>
                    {icon}
                </div>
                <span className="font-bold text-sm tracking-tight">{label}</span>
                {badge && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-white">
                        {badge}
                    </span>
                )}
                {isActive && (
                    <motion.div 
                        layoutId="activePill"
                        className="absolute left-[-12px] w-1.5 h-8 bg-green-600 rounded-r-full"
                    />
                )}
            </div>
        </Link>
    );
};

const Sidebar = () => {
    const { user } = useAuthStore();
    if (!user) return null;

    const farmerLinks = [
        { to: "/dashboard", icon: <MdDashboard />, label: "Dashboard" },
        { to: "/equipment", icon: <MdSearch />, label: "Equipment Market" },
        { to: "/schemes", icon: <MdAccountBalance />, label: "Govt Schemes", badge: "NEW" },
        { to: "/ai-recommendations", icon: <MdPsychology />, label: "AI Advisor" },
        { to: "/pesticide-exchange", icon: <MdSwapHorizontalCircle />, label: "Pesticide Exchange" },
        { to: "/mandi-prices", icon: <MdTrendingUp />, label: "Mandi Prices" },
    ];

    const adminLinks = [
        { to: "/admin", icon: <MdDashboard />, label: "Admin Console" },
        { to: "/dashboard", icon: <MdTrendingUp />, label: "Platform Pulse" },
    ];

    const mukadamLinks = [
        { to: "/mukadam", icon: <MdDashboard />, label: "Mukadam Dash" },
        { to: "/equipment", icon: <MdSearch />, label: "Labor Market" },
    ];

    const laborLinks = [
        { to: "/labour", icon: <MdDashboard />, label: "My Profile" },
        { to: "/dashboard", icon: <MdSearch />, label: "Find Work" },
    ];

    const auditLinks = [
        { to: "/audit", icon: <MdDashboard />, label: "Audit Center" },
    ];

    const roleLinks = {
        farmer: farmerLinks,
        admin: adminLinks,
        mukadam: mukadamLinks,
        labour: laborLinks,
        audit: auditLinks
    };

    const links = roleLinks[user.role] || farmerLinks;

    return (
        <aside className="fixed left-0 top-[68px] bottom-0 w-64 bg-white border-r border-gray-100 hidden lg:flex flex-col p-6 z-40">
            <div className="flex-1 flex flex-col gap-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-4">Main Menu</p>
                {links.map((link, idx) => (
                    <SidebarLink key={idx} {...link} />
                ))}
            </div>

            <div className="mt-auto space-y-4">
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-[24px] border border-green-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-green-200/20 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
                    <p className="text-xs font-black text-green-800 tracking-tight mb-1">Agro Insurance 🛡️</p>
                    <p className="text-[10px] text-green-600 font-bold leading-tight">Your crops are protected under PMFBY.</p>
                    <button className="mt-3 flex items-center gap-1 text-[10px] font-black text-green-700 hover:gap-2 transition-all">
                        CHECK STATUS <MdChevronRight />
                    </button>
                </div>

                <div className="flex items-center gap-2 px-4 py-3 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                    <MdHelpCenter className="text-xl" />
                    <span className="text-sm font-bold">Support Center</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
