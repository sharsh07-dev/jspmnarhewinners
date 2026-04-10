import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
} from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaTractor } from "react-icons/fa";
import { MdEmail, MdLock, MdPerson, MdPhone, MdLocationOn, MdVisibility, MdVisibilityOff, MdFingerprint, MdArrowBack } from "react-icons/md";
import toast from "react-hot-toast";

const AuthPage = () => {
    const location = useLocation();
    const isSignupParam = new URLSearchParams(location.search).get("signup") === "1";
    
    // Check for saved device
    const [savedDevice, setSavedDevice] = useState(null);
    useEffect(() => {
        const locallySaved = localStorage.getItem("agroshare_saved_device");
        if (locallySaved) setSavedDevice(JSON.parse(locallySaved));
    }, []);

    const [authMethod, setAuthMethod] = useState(localStorage.getItem("agroshare_saved_device") ? "saved" : "phone");
    const [mode, setMode] = useState(isSignupParam ? "signup" : "login"); // used mainly for email
    const [loading, setLoading] = useState(false);
    
    // Fields
    const [role, setRole] = useState("farmer");
    
    // Email fields
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [name, setName] = useState("");
    const [village, setVillage] = useState("");
    
    // Phone fields
    const [phone, setPhone] = useState("");
    const [otpStep, setOtpStep] = useState(1); // 1: input phone, 2: verify OTP
    const [otp, setOtp] = useState("");
    const [generatedOtp, setGeneratedOtp] = useState("");
    
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

    const processSuccessfulLogin = (uid, currentRole, phoneOrEmail, userName = "", passToken = "") => {
        // Save device session persistently
        localStorage.setItem("agroshare_saved_device", JSON.stringify({
            uid,
            role: currentRole,
            identifier: phoneOrEmail,
            name: userName || "User",
            token: passToken
        }));
        
        toast.success("Welcome to AgroShare! 👋");
        navigate(getDashboardLink(currentRole));
    };

    const getDashboardLink = (r) => {
        if (r === "admin") return "/admin";
        if (r === "mukadam") return "/mukadam";
        if (r === "labour") return "/labour";
        if (r === "audit") return "/audit";
        return "/dashboard";
    };

    // --- EMAIL LOGIN LOGIC ---
    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let userRole = role;
            if (mode === "login") {
                const creds = await signInWithEmailAndPassword(auth, email, password);
                const snap = await get(ref(db, `users/${creds.user.uid}`));
                if (snap.exists() && snap.val().role) {
                    userRole = snap.val().role;
                }
                processSuccessfulLogin(creds.user.uid, userRole, email, snap.exists() ? snap.val().name : "User", password);
            } else {
                const { user } = await createUserWithEmailAndPassword(auth, email, password);
                await saveUserToDB(user.uid, {
                    name, email, phone, village,
                    role: userRole,
                });
                processSuccessfulLogin(user.uid, userRole, email, name, password);
            }
        } catch (err) {
            toast.error(err.message || "Failed to authenticate.");
        } finally {
            setLoading(false);
        }
    };

    // --- PHONE OTP LOGIC (MOCK SMS + Firebase Auth Trick) ---
    const handleSendOTP = (e) => {
        e.preventDefault();
        if (phone.length < 10) return toast.error("Enter a valid 10-digit phone number");
        
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            const fakeOtp = Math.floor(1000 + Math.random() * 9000).toString();
            setGeneratedOtp(fakeOtp);
            setOtpStep(2);
            toast.success(`Mock SMS: Your AgroShare OTP is ${fakeOtp}`, { duration: 6000, icon: '📱' });
        }, 800);
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        if (otp !== generatedOtp) return toast.error("Invalid OTP. Try again.");
        
        setLoading(true);
        try {
            // Trick: use phone + @agroshare.com as email to securely log them into Firebase Auth
            const trickEmail = `${phone}@agroshare.com`;
            const trickPass = `agro_secure_${phone}_pass`;
            
            try {
                const creds = await signInWithEmailAndPassword(auth, trickEmail, trickPass);
                const snap = await get(ref(db, `users/${creds.user.uid}`));
                let currentRole = role;
                let cName = name || "Farmer";
                if (snap.exists()) {
                    if (snap.val().role) currentRole = snap.val().role;
                    if (snap.val().name) cName = snap.val().name;
                }
                processSuccessfulLogin(creds.user.uid, currentRole, phone, cName, trickPass);
            } catch (loginErr) {
                // Not found, create user
                if (loginErr.code === "auth/user-not-found" || loginErr.code === "auth/invalid-credential") {
                    const { user } = await createUserWithEmailAndPassword(auth, trickEmail, trickPass);
                    await saveUserToDB(user.uid, {
                        phone, role, email: trickEmail, name: name || "New User"
                    });
                    processSuccessfulLogin(user.uid, role, phone, name || "New User", trickPass);
                } else {
                    throw loginErr;
                }
            }
        } catch (err) {
            toast.error("Authentication failed.");
        } finally {
            setLoading(false);
        }
    };

    // --- SAVED DEVICE LOGIC (MOCK FaceID / PIN) ---
    const handleSavedDeviceLogin = async () => {
        setLoading(true);
        try {
            // Re-authenticate silently into Firebase to ensure session is valid
            const isEmailLogin = savedDevice.identifier.includes('@');
            const authEmail = isEmailLogin ? savedDevice.identifier : `${savedDevice.identifier}@agroshare.com`;
            
            await signInWithEmailAndPassword(auth, authEmail, savedDevice.token);
            
            setTimeout(() => {
                setLoading(false);
                toast.success("Biometric / Device verified!", { icon: '✅' });
                navigate(getDashboardLink(savedDevice.role));
            }, 800);
        } catch (err) {
            setLoading(false);
            toast.error("Session expired. Please log in again.");
            setSavedDevice(null);
            setAuthMethod("phone");
            localStorage.removeItem("agroshare_saved_device");
        }
    };


    const renderRoleSelector = () => (
        <div className="space-y-3 mb-6 mt-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Select Portal Access</label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                {[
                    { id: "farmer", icon: "🧑‍🌾", label: "Farmer", color: "green" },
                    { id: "admin", icon: "🛡️", label: "Admin", color: "red" },
                    { id: "mukadam", icon: "👷", label: "Mukadam", color: "orange" },
                    { id: "labour", icon: "🛠️", label: "Labour", color: "yellow" },
                    { id: "audit", icon: "🏦", label: "Audit", color: "indigo" }
                ].map(({ id, icon, label, color }) => (
                    <button
                        key={id} type="button" onClick={() => setRole(id)}
                        className={`p-3 rounded-2xl border-2 text-sm font-bold flex flex-col items-center justify-center gap-1.5 transition-all duration-200 
                            ${role === id 
                                ? `border-${color}-500 bg-${color}-50 text-${color}-700 shadow-md scale-[1.02]` 
                                : `border-gray-100 bg-white text-gray-500 hover:border-${color}-200 hover:bg-gray-50`}`}
                    >
                        <span className="text-2xl">{icon}</span>
                        <span>{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex pt-16">
            <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-hero-pattern opacity-20" />
                <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-green-500/20 rounded-full blur-3xl" />
                <div className="relative flex items-center gap-3">
                    <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center border border-white/30">
                        <FaTractor className="text-white h-6 w-6" />
                    </div>
                    <span className="text-2xl font-black text-white font-display">Agro<span className="text-green-300">Share</span></span>
                </div>
                <div className="relative space-y-6">
                    <h2 className="text-4xl font-black text-white font-display leading-tight">
                        Empowering Indian Farmers with <span className="text-green-300">Smart Sharing</span>
                    </h2>
                    <p className="text-green-200 text-lg leading-relaxed">
                        Rent tractors, harvesters, and tools from nearby farmers.
                    </p>
                </div>
                <p className="relative text-green-400 text-sm">© 2024 AgroShare India</p>
            </div>

            <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-gray-50">
                <div className="w-full max-w-md">
                    {/* Header Tabs if not on Saved Device Mode */}
                    {authMethod !== "saved" && (
                        <div className="flex bg-gray-200 rounded-2xl p-1 mb-6">
                            <button onClick={() => setAuthMethod("phone")} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${authMethod === "phone" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>📱 Phone / OTP</button>
                            <button onClick={() => setAuthMethod("email")} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${authMethod === "email" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>✉️ Email Log In</button>
                        </div>
                    )}

                    {authMethod === "saved" && savedDevice ? (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
                            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                <MdPerson className="h-12 w-12 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 font-display">Welcome back, {savedDevice.name}!</h2>
                                <p className="text-gray-500 mt-1">{savedDevice.identifier} • {savedDevice.role.toUpperCase()}</p>
                            </div>
                            
                            <button onClick={handleSavedDeviceLogin} disabled={loading} className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg hover:bg-black transition-all shadow-xl flex flex-col items-center justify-center gap-2 group">
                                {loading ? "Verifying..." : (
                                    <>
                                        <MdFingerprint className="h-8 w-8 text-green-400 group-hover:scale-110 transition-transform" />
                                        <span>Use Face ID / Device Authentication</span>
                                    </>
                                )}
                            </button>
                            
                            <button onClick={() => { setSavedDevice(null); setAuthMethod("phone"); localStorage.removeItem("agroshare_saved_device"); }} className="text-sm text-gray-500 font-bold hover:text-red-500 mt-4 transition-colors">
                                Sign in as different user
                            </button>
                        </motion.div>
                    ) : authMethod === "phone" ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <div>
                                <h1 className="text-3xl font-black text-gray-900 font-display mb-1">Enter your Mobile Number</h1>
                                <p className="text-gray-500 text-sm">We'll send you an OTP to quickly log in securely.</p>
                            </div>
                            {renderRoleSelector()}
                            <form onSubmit={otpStep === 1 ? handleSendOTP : handleVerifyOTP} className="space-y-4">
                                {otpStep === 1 ? (
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-bold border-r pr-2 flex items-center gap-1">
                                            <span>🇮🇳</span> +91
                                        </div>
                                        <input required value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Enter Mobile Number" className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-2xl focus:ring-green-500 focus:border-green-500 block p-3.5 pl-[85px] shadow-sm font-semibold" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <input required value={otp} onChange={(e) => setOtp(e.target.value)} type="number" placeholder="Enter 4-digit OTP" className="w-full bg-white border border-gray-200 text-gray-900 text-xl font-bold tracking-[0.5em] text-center rounded-2xl focus:ring-green-500 focus:border-green-500 block py-4 shadow-sm" />
                                        </div>
                                        <button type="button" onClick={() => setOtpStep(1)} className="text-sm text-gray-500 font-bold hover:text-gray-900 flex items-center gap-1">
                                            <MdArrowBack /> Change Number
                                        </button>
                                    </div>
                                )}
                                
                                <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base hover:bg-green-700 transition-all shadow-lg shadow-green-200">
                                    {loading ? "Processing..." : (otpStep === 1 ? "Send Secure OTP →" : "Verify & Log In")}
                                </button>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                             <div className="flex bg-gray-100/50 rounded-xl p-1 mb-4 border border-gray-100">
                                <button onClick={() => setMode("login")} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}>Existing User</button>
                                <button onClick={() => setMode("signup")} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === "signup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}>New Account</button>
                            </div>
                            {renderRoleSelector()}
                            <form onSubmit={handleEmailSubmit} className="space-y-4">
                                {mode === "signup" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 overflow-hidden">
                                        <div className="relative">
                                            <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                            <input required value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Full Name" className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-2xl focus:ring-green-500 focus:border-green-500 block p-3.5 pl-11 shadow-sm" />
                                        </div>
                                    </motion.div>
                                )}
                                <div className="relative">
                                    <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    <input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email address" className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-2xl focus:ring-green-500 focus:border-green-500 block p-3.5 pl-11 shadow-sm" />
                                </div>
                                <div className="relative">
                                    <MdLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    <input required value={password} onChange={(e) => setPassword(e.target.value)} type={showPass ? "text" : "password"} placeholder="Password" className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-2xl focus:ring-green-500 focus:border-green-500 block p-3.5 pl-11 pr-11 shadow-sm" />
                                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showPass ? <MdVisibilityOff className="h-5 w-5" /> : <MdVisibility className="h-5 w-5" />}
                                    </button>
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-base hover:bg-black transition-all shadow-lg">
                                    {loading ? "Authenticating..." : (mode === "login" ? "Sign In Securely →" : "Create Account + Login")}
                                </button>
                            </form>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
