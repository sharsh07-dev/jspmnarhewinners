import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import useAuthStore from "../store/useAuthStore";
import { FaTractor } from "react-icons/fa";
import { MdMenu, MdClose, MdLogout, MdDashboard, MdSearch } from "react-icons/md";
import { toast } from "react-hot-toast";
import LanguageToggle from "./LanguageToggle";

const Navbar = () => {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const isHome = location.pathname === "/";

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => setOpen(false), [location]);

    const handleLogout = async () => {
        await signOut(auth);
        toast.success("Logged out");
        navigate("/");
    };

    const getDashboardLink = () => {
        if (!user) return "/auth";
        if (user.role === "admin") return "/admin";
        if (user.role === "mukadam") return "/mukadam";
        if (user.role === "labour") return "/labour";
        if (user.role === "audit") return "/audit";
        return "/dashboard";
    };

    const navBg = scrolled || !isHome
        ? "bg-white shadow-md border-b border-gray-100"
        : "bg-transparent";

    const linkActive = "bg-green-600 text-white rounded-xl shadow-sm";
    const linkInactive = (transparent) =>
        transparent
            ? "text-white/85 hover:text-white hover:bg-white/10 rounded-xl"
            : "text-gray-600 hover:text-green-700 hover:bg-green-50 rounded-xl";

    const textColor = scrolled || !isHome ? "text-gray-900" : "text-white";

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${navBg}`}>
            <div className="max-w-7xl mx-auto px-5 sm:px-8">
                <div className="flex items-center justify-between h-16 md:h-[68px]">

                    {/* ── Logo ── */}
                    <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
                        <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                            <FaTractor className="text-white h-5 w-5" />
                        </div>
                        <span className={`text-xl font-black font-display tracking-tight transition-colors ${textColor}`}>
                            Agro<span className="text-green-400">Share</span>
                        </span>
                    </Link>

                    {/* ── Desktop Right Side ── */}
                    <div className="hidden md:flex items-center gap-0.5 whitespace-nowrap">
                        {user ? (
                            /* ── LOGGED-IN: nav links on the right ── */
                            <>
                                {user.role === "farmer" && (
                                    <>
                                        <Link
                                            to="/equipment"
                                            className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-semibold transition-all duration-200 ${location.pathname === "/equipment" ? linkActive : linkInactive(!(scrolled || !isHome))
                                                }`}
                                        >
                                            <MdSearch className="h-4 w-4" />
                                            Market
                                        </Link>

                                        <Link
                                            to="/ai-recommendations"
                                            className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-semibold transition-all duration-200 ${location.pathname === "/ai-recommendations" ? linkActive : linkInactive(!(scrolled || !isHome))
                                                }`}
                                        >
                                            <span className="text-xl">🧠</span>
                                            Advisor
                                        </Link>

                                        <Link
                                            to="/pesticide-exchange"
                                            className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-semibold transition-all duration-200 ${location.pathname === "/pesticide-exchange" ? linkActive : linkInactive(!(scrolled || !isHome))
                                                }`}
                                        >
                                            <span className="text-xl">🌿</span>
                                            Exchange
                                        </Link>

                                        <Link
                                            to="/mandi-prices"
                                            className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-semibold transition-all duration-200 ${location.pathname === "/mandi-prices" ? linkActive : linkInactive(!(scrolled || !isHome))
                                                }`}
                                        >
                                            <span className="text-xl">📊</span>
                                            Mandi
                                        </Link>
                                    </>
                                )}

                                <Link
                                    to={getDashboardLink()}
                                    className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-semibold transition-all duration-200 ${location.pathname === getDashboardLink() ? linkActive : linkInactive(!(scrolled || !isHome))
                                        }`}
                                >
                                    <MdDashboard className="h-4 w-4" />
                                    Dashboard
                                </Link>

                                {/* Divider */}
                                <div className="w-px h-6 bg-gray-200 mx-2" />

                                {/* User chip */}
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-50 border border-green-100">
                                    <span className="text-base">👨‍🌾</span>
                                    <div className="leading-none">
                                        <p className="text-xs font-bold text-gray-900">{user.name?.split(" ")[0]}</p>
                                        <p className="text-[10px] text-green-600 capitalize mt-0.5">{user.role}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-1.5 ml-1 px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold transition-all border border-red-100"
                                >
                                    <MdLogout className="h-4 w-4" />
                                    Logout
                                </button>
                            </>
                        ) : (
                            /* ── GUEST ── */
                            <>
                                <Link
                                    to="/"
                                    className={`px-4 py-2 text-sm font-semibold transition-all duration-200 ${location.pathname === "/"
                                        ? "text-green-400 font-bold"
                                        : scrolled
                                            ? "text-gray-600 hover:text-green-600 rounded-xl"
                                            : "text-white/80 hover:text-white rounded-xl"
                                        }`}
                                >
                                    Home
                                </Link>

                                <div className="w-px h-5 bg-white/20 mx-2" />

                                <Link
                                    to="/auth"
                                    className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${scrolled || !isHome
                                        ? "border-gray-200 text-gray-700 hover:border-green-400 hover:text-green-600"
                                        : "border-white/30 text-white hover:bg-white/10"
                                        }`}
                                >
                                    Login
                                </Link>

                                <Link
                                    to="/auth?signup=1"
                                    className="px-5 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-all shadow-lg hover:-translate-y-0.5"
                                >
                                    Create Account
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 md:ml-1">
                        {/* Custom Language Selector UI */}
                        <LanguageToggle scrolled={scrolled} isHome={isHome} />

                        {/* ── Mobile toggle ── */}
                        <button
                            onClick={() => setOpen(!open)}
                            className={`md:hidden p-2 rounded-xl transition-colors ${scrolled || !isHome ? "text-gray-700 hover:bg-gray-100" : "text-white hover:bg-white/10"
                                }`}
                        >
                            {open ? <MdClose className="h-6 w-6" /> : <MdMenu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Mobile Menu ── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden bg-white border-t border-gray-100 shadow-2xl overflow-hidden"
                    >
                        <div className="px-5 py-4 space-y-1">
                            {user ? (
                                <>
                                    <div className="flex items-center gap-3 px-3 py-3 bg-green-50 rounded-xl mb-3">
                                        <span className="text-2xl">👨‍🌾</span>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm">{user.name}</p>
                                            <p className="text-xs text-green-600 capitalize">{user.role}</p>
                                        </div>
                                    </div>
                                    {user.role === "farmer" && (
                                        <>
                                            <Link to="/" className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-gray-700 hover:bg-green-50 hover:text-green-700">
                                                <MdSearch className="h-4 w-4" /> Find Equipment
                                            </Link>
                                            <Link to="/ai-recommendations" className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50">
                                                <span className="text-xl">🧠</span> AI Advisor
                                            </Link>
                                            <Link to="/pesticide-exchange" className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50">
                                                <span className="text-xl">🌿</span> Agro Exchange
                                            </Link>
                                            <Link to="/mandi-prices" className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50">
                                                <span className="text-xl">📊</span> Mandi Prices
                                            </Link>
                                        </>
                                    )}
                                    <Link to={getDashboardLink()} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50">
                                        <MdDashboard className="h-4 w-4" /> Dashboard
                                    </Link>
                                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-red-50 text-red-600 rounded-xl font-semibold text-sm">
                                        <MdLogout /> Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/" className="block px-4 py-3 rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50">Home</Link>
                                    <Link to="/auth" className="block w-full text-center px-4 py-3 rounded-xl border-2 border-gray-200 font-semibold text-sm text-gray-700 hover:border-green-400">Login</Link>
                                    <Link to="/auth?signup=1" className="block w-full text-center px-4 py-3 rounded-xl bg-green-600 text-white font-bold text-sm shadow-lg">Create Account</Link>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;
