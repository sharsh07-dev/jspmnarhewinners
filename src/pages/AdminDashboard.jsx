import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { Navigate } from "react-router-dom";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import { 
    MdAdminPanelSettings, MdPeople, MdDashboard, MdSettings, 
    MdAttachMoney, MdReceipt, MdTrendingUp, MdHistory, MdAccountBalanceWallet,
    MdReportProblem, MdVerified, MdOutlinePayment
} from "react-icons/md";
import { format } from "date-fns";
import toast from "react-hot-toast";

const AdminDashboard = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState("overview"); // overview, claims, users
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalBookings: 0,
        totalRevenue: 0,
        totalGst: 0,
        damageFund: 250000,
        recentTransactions: []
    });
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || user.role !== "admin") return;

        // Listen to Bookings for Financials
        const bookingsRef = ref(db, "bookings");
        const usersRef = ref(db, "users");
        const claimsRef = ref(db, "damage_claims");

        const unsubBookings = onValue(bookingsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                let revenue = 0;
                let gst = 0;
                const txns = [];

                Object.keys(data).forEach(id => {
                    const b = data[id];
                    txns.push({ id, ...b });
                    if (b.status === "completed") {
                        const price = b.totalPrice || 0;
                        revenue += price;
                        gst += (price * 0.18);
                    }
                });

                setStats(prev => ({
                    ...prev,
                    totalBookings: Object.keys(data).length,
                    totalRevenue: revenue,
                    totalGst: gst,
                    recentTransactions: txns.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
                }));
            }
        });

        const unsubClaims = onValue(claimsRef, (snap) => {
            if (snap.exists()) {
                const items = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
                setClaims(items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            } else setClaims([]);
            setLoading(false);
        });

        const unsubUsers = onValue(usersRef, (snap) => {
            if (snap.exists()) {
                setStats(prev => ({
                    ...prev,
                    totalUsers: Object.keys(snap.val()).length
                }));
            }
        });

        return () => {
            unsubBookings();
            unsubClaims();
            unsubUsers();
        };
    }, [user]);

    const handleApproveClaim = async (claimId) => {
        try {
            await update(ref(db, `damage_claims/${claimId}`), { status: "verified" });
            toast.success("Claim verified and added to payment queue");
        } catch (err) { toast.error("Update failed"); }
    };

    const handleProcessComp = async (claimId, amount) => {
        try {
            await update(ref(db, `damage_claims/${claimId}`), { status: "paid" });
            setStats(prev => ({ ...prev, damageFund: prev.damageFund - amount }));
            toast.success(`₹${amount} compensation processed successfully!`);
        } catch (err) { toast.error("Processing failed"); }
    };

    if (user?.role !== "admin") return <Navigate to="/" replace />;

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                        <MdAdminPanelSettings className="text-9xl" />
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black text-gray-900 font-display">AgroShare Headquarters</h1>
                        <p className="text-gray-500 mt-2">Real-time platform financial monitoring & compliance engine.</p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-4 relative z-10">
                        <div className="text-right hidden md:block">
                            <p className="text-xs font-bold text-gray-400 uppercase">System Status</p>
                            <p className="text-sm font-black text-green-500 flex items-center justify-end gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Operational
                            </p>
                        </div>
                        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-inner border border-red-100">
                            <MdAdminPanelSettings className="h-8 w-8" />
                        </div>
                    </div>
                </motion.div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} 
                        className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                            <MdAccountBalanceWallet className="h-6 w-6" />
                        </div>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Total Revenue</p>
                        <p className="text-3xl font-black text-gray-900 mt-1">₹{stats.totalRevenue.toLocaleString()}</p>
                        <div className="mt-2 flex items-center gap-1 text-xs font-bold text-green-500">
                            <MdTrendingUp /> Platform Gross
                        </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                        className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                            <MdReceipt className="h-6 w-6" />
                        </div>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">GST Collected</p>
                        <p className="text-3xl font-black text-purple-600 mt-1">₹{stats.totalGst.toLocaleString()}</p>
                        <p className="mt-2 text-xs font-bold text-gray-400">18% Compliant Tax Pool</p>
                    </motion.div>
                    
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                        className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition border-b-4 border-b-red-500">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
                            <MdReportProblem className="h-6 w-6" />
                        </div>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Active Claims</p>
                        <p className="text-3xl font-black text-red-600 mt-1">{claims.filter(c => c.status !== 'paid').length}</p>
                        <p className="mt-2 text-xs font-bold text-gray-400">Claims in Pipeline</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                        className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4">
                            <MdOutlinePayment className="h-6 w-6" />
                        </div>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Damage Fund</p>
                        <p className="text-3xl font-black text-gray-900 mt-1">₹{stats.damageFund.toLocaleString()}</p>
                        <p className="mt-2 text-xs font-bold text-gray-400">Insurance & Reserve</p>
                    </motion.div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button onClick={() => setActiveTab("overview")} className={`px-8 py-4 font-black text-sm uppercase tracking-widest border-b-4 transition-all ${activeTab === "overview" ? "border-green-600 text-green-700" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                        Overview
                    </button>
                    <button onClick={() => setActiveTab("claims")} className={`px-8 py-4 font-black text-sm uppercase tracking-widest border-b-4 transition-all ${activeTab === "claims" ? "border-red-600 text-red-700" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                        Damage Claims ({claims.length})
                    </button>
                </div>

                {/* Main Content Area */}
                <AnimatePresence mode="wait">
                    {activeTab === "overview" && (
                        <motion.div layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Recent Transactions */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                            <MdHistory className="text-green-600" /> Platform Transaction Feed
                                        </h3>
                                        <button className="text-sm font-bold text-green-600 hover:underline">View All</button>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {stats.recentTransactions.length === 0 ? (
                                            <div className="p-10 text-center text-gray-400">No transactions recorded.</div>
                                        ) : (
                                            stats.recentTransactions.map(txn => (
                                                <div key={txn.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${txn.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                                                            {txn.isPesticide ? "🌿" : "🚜"}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 text-sm">{txn.equipmentName}</p>
                                                            <p className="text-xs text-gray-400 mt-0.5">By {txn.userName || 'Anonymous'} • {txn.createdAt ? format(new Date(txn.createdAt), "MMM dd, HH:mm") : 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-gray-900 text-sm">₹{txn.totalPrice?.toLocaleString()}</p>
                                                        <p className={`text-[10px] font-bold uppercase ${txn.status === 'completed' ? 'text-green-500' : 'text-orange-500'}`}>
                                                            {txn.status}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Quick Controls */}
                            <div className="space-y-6">
                                <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                                    <div className="absolute -bottom-4 -right-4 text-white/5 text-8xl">
                                        <MdSettings />
                                    </div>
                                    <h3 className="font-black text-lg mb-4">Admin Controls</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition text-left px-4 flex items-center gap-3">
                                            <MdPeople /> User Management
                                        </button>
                                        <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition text-left px-4 flex items-center gap-3">
                                            <MdReceipt /> Tax Audit Logs
                                        </button>
                                        <button className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl font-bold text-sm transition text-left px-4 text-red-300 flex items-center gap-3 border border-red-500/30">
                                            <MdAdminPanelSettings /> Security Override
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                                    <h4 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                                        <MdTrendingUp className="text-blue-500" /> Platform Insights
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-xs font-bold text-gray-400 mb-1 uppercase">
                                                <span>Target Revenue</span>
                                                <span>75%</span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 w-[75%]" />
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-gray-500 leading-relaxed italic">
                                            "Platform growth is currently exceeding quarterly projections by 12.4%."
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "claims" && (
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                            <MdReportProblem className="text-red-500" /> Damage Assessment Dashboard
                                        </h3>
                                        <p className="text-sm text-gray-500 font-bold mt-1">Review AI assessments and authorize repair compensation.</p>
                                    </div>
                                    <div className="px-5 py-3 bg-red-100 text-red-700 rounded-2xl border border-red-200">
                                        <p className="text-[10px] uppercase font-black tracking-widest">Active Claim Loop</p>
                                        <p className="text-lg font-black tracking-tighter">EST: ₹{claims.reduce((s,c) => s+(c.estimatedCost||0), 0).toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="p-0">
                                    {claims.length === 0 ? (
                                        <div className="p-20 text-center text-gray-400">
                                            <MdVerified className="mx-auto text-6xl mb-4 opacity-10" />
                                            <p className="font-bold">All equipment systems operational. No active claims.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100">
                                            {claims.map(c => (
                                                <div key={c.id} className="p-8 hover:bg-gray-50 transition grid grid-cols-1 lg:grid-cols-4 gap-8">
                                                    <div className="lg:col-span-1 space-y-4">
                                                        <div className="relative aspect-video rounded-2xl overflow-hidden shadow-md border-2 border-white">
                                                            <img src={c.images?.[0] || 'https://images.unsplash.com/photo-1594833211511-7a6c9d8da4cf'} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-bottom p-3">
                                                                <p className="mt-auto text-[10px] text-white font-bold">CID: {c.id}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border-2 ${
                                                            c.status === 'reported' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                            c.status === 'verified' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-green-50 text-green-600 border-green-200'
                                                        }`}>
                                                            {c.status}
                                                        </span>
                                                    </div>

                                                    <div className="lg:col-span-2 space-y-4">
                                                        <div>
                                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Description</p>
                                                            <p className="text-gray-900 font-bold mt-1 text-sm leading-relaxed">{c.description}</p>
                                                        </div>
                                                        <div className="bg-gray-100/50 rounded-2xl p-4 border border-gray-100">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center text-xs">🤖</div>
                                                                <p className="text-xs font-black uppercase tracking-widest text-gray-900">xAI Grok Assessment</p>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <p className="text-[10px] text-gray-400 font-bold">TYPE</p>
                                                                    <p className="text-xs font-black">{c.aiAssessment?.type || 'Under Analysis'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] text-gray-400 font-bold">CONFIDENCE</p>
                                                                    <p className="text-xs font-black text-green-600">{c.aiAssessment?.aiConfidence || 'N/A'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="lg:col-span-1 flex flex-col justify-between">
                                                        <div className="text-right">
                                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Proposed Settlement</p>
                                                            <p className="text-2xl font-black text-gray-900">₹{c.estimatedCost?.toLocaleString()}</p>
                                                        </div>
                                                        <div className="space-y-2 mt-4">
                                                            {c.status === 'reported' && (
                                                                <button onClick={() => handleApproveClaim(c.id)} className="w-full py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition">
                                                                    Verify Evidence
                                                                </button>
                                                            )}
                                                            {c.status === 'verified' && (
                                                                <button onClick={() => handleProcessComp(c.id, c.estimatedCost)} className="w-full py-3 bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 transition">
                                                                    Authorize Payment
                                                                </button>
                                                            )}
                                                            {c.status === 'paid' && (
                                                                <div className="w-full py-3 bg-gray-50 text-gray-400 font-black text-xs uppercase tracking-widest rounded-xl text-center border-2 border-gray-100">
                                                                    Case Closed
                                                                </div>
                                                            )}
                                                            <button className="w-full py-3 bg-white text-gray-900 border-2 border-gray-100 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-50 transition">
                                                                Contact Owner
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AdminDashboard;
