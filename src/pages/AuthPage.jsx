import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
} from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaTractor } from "react-icons/fa";
import { MdEmail, MdLock, MdPerson, MdPhone, MdLocationOn, MdVisibility, MdVisibilityOff } from "react-icons/md";
import toast from "react-hot-toast";

const AuthPage = () => {
    const location = useLocation();
    const isSignupParam = new URLSearchParams(location.search).get("signup") === "1";
    const [mode, setMode] = useState(isSignupParam ? "signup" : "login");
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    // Fields
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [village, setVillage] = useState("");

    const navigate = useNavigate();

    const saveUserToDB = async (uid, data) => {
        const snap = await get(ref(db, `users/${uid}`));
        if (!snap.exists()) {
            await set(ref(db, `users/${uid}`), {
                ...data,
                createdAt: new Date().toISOString(),
            });
        }
    };

    const friendlyError = (code) => {
        const map = {
            "auth/user-not-found": "No account found with this email. Please sign up.",
            "auth/wrong-password": "Incorrect password. Please try again.",
            "auth/email-already-in-use": "Email already registered. Please log in.",
            "auth/weak-password": "Password must be at least 6 characters.",
            "auth/invalid-email": "Please enter a valid email address.",
            "auth/invalid-credential": "Invalid email or password.",
            "auth/too-many-requests": "Too many failed attempts. Try again later.",
        };
        return map[code] || "Something went wrong. Please try again.";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === "login") {
                await signInWithEmailAndPassword(auth, email, password);
                toast.success("Welcome back! 👋");
            } else {
                const { user } = await createUserWithEmailAndPassword(auth, email, password);
                // All registrations default to "farmer"; admin is set manually in DB
                await saveUserToDB(user.uid, {
                    name, email, phone, village,
                    role: "farmer",
                });
                toast.success("Account created! Welcome to AgroShare 🌱");
            }
            // Redirect to "/equipment" — the detailed equipment section
            navigate("/equipment");
        } catch (err) {
            toast.error(friendlyError(err.code));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex pt-16">
            {/* Left Panel – Branding */}
            <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 p-12 relative overflow-hidden">
                {/* Pattern */}
                <div className="absolute inset-0 bg-hero-pattern opacity-20" />
                <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-green-500/20 rounded-full blur-3xl" />

                {/* Logo */}
                <div className="relative flex items-center gap-3">
                    <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center border border-white/30">
                        <FaTractor className="text-white h-6 w-6" />
                    </div>
                    <span className="text-2xl font-black text-white font-display">Agro<span className="text-green-300">Share</span></span>
                </div>

                {/* Quote */}
                <div className="relative space-y-6">
                    <h2 className="text-4xl font-black text-white font-display leading-tight">
                        Empowering Indian Farmers with <span className="text-green-300">Smart Sharing</span>
                    </h2>
                    <p className="text-green-200 text-lg leading-relaxed">
                        Rent tractors, harvesters, and tools from nearby farmers. Increase your yield, reduce your costs.
                    </p>
                    <div className="grid grid-cols-3 gap-4 pt-4">
                        {[["18,000+", "Farmers"], ["2,400+", "Listings"], ["4.8★", "Rating"]].map(([v, l]) => (
                            <div key={l} className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                                <p className="font-black text-white text-xl">{v}</p>
                                <p className="text-green-300 text-sm">{l}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom */}
                <p className="relative text-green-400 text-sm">© 2024 AgroShare India · Built for Bharat 🇮🇳</p>
            </div>

            {/* Right Panel – Form */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-gray-50">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
                            <FaTractor className="text-white h-5 w-5" />
                        </div>
                        <span className="text-xl font-black font-display">Agro<span className="text-green-600">Share</span></span>
                    </div>

                    <h1 className="text-3xl font-black text-gray-900 font-display mb-1">
                        {mode === "login" ? "Welcome back" : "Create your account"}
                    </h1>
                    <p className="text-gray-500 text-sm mb-8">
                        {mode === "login"
                            ? "Sign in to access your AgroShare dashboard"
                            : "Start renting and listing farm equipment today"}
                    </p>

                    {/* Tab Switch */}
                    <div className="flex bg-gray-100 rounded-2xl p-1 mb-7">
                        {[["login", "Sign In"], ["signup", "Create Account"]].map(([m, label]) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence mode="wait">
                            {mode === "signup" && (
                                <motion.div
                                    key="signup"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    <div className="relative">
                                        <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                        <input required value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Full Name" className="input-field pl-11" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <MdPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                            <input required value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Phone" className="input-field pl-11" />
                                        </div>
                                        <div className="relative">
                                            <MdLocationOn className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                            <input required value={village} onChange={(e) => setVillage(e.target.value)} type="text" placeholder="Village / City" className="input-field pl-11" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="relative">
                            <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                            <input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email address" className="input-field pl-11" />
                        </div>

                        <div className="relative">
                            <MdLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                            <input
                                required value={password} onChange={(e) => setPassword(e.target.value)}
                                type={showPass ? "text" : "password"}
                                placeholder={mode === "signup" ? "Create password (min 6 chars)" : "Password"}
                                className="input-field pl-11 pr-11"
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                {showPass ? <MdVisibilityOff className="h-5 w-5" /> : <MdVisibility className="h-5 w-5" />}
                            </button>
                        </div>

                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-2xl text-white font-bold text-base transition-all shadow-lg ${loading ? "bg-green-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 hover:shadow-green-200 hover:-translate-y-0.5"
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    {mode === "login" ? "Signing In..." : "Creating Account..."}
                                </span>
                            ) : mode === "login" ? "Sign In →" : "Create Account 🌱"}
                        </motion.button>
                    </form>

                    <p className="text-center text-sm text-gray-500 mt-6">
                        {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                        {" "}
                        <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-green-600 font-bold hover:underline">
                            {mode === "login" ? "Create one" : "Sign in"}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
