import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { ref, onValue, update } from "firebase/database";
import { 
    MdWorkOutline, MdCheck, MdClose, MdChat, MdLocationOn, 
    MdAttachMoney, MdCalendarToday, MdFilterList
} from "react-icons/md";
import useAuthStore from "../store/useAuthStore";
import toast from "react-hot-toast";

const LabourMyWork = () => {
    const { authUser } = useAuthStore();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all"); // all, sent, accepted, countered

    useEffect(() => {
        if (!authUser?.uid) return;
        const reqRef = ref(db, "labour_requests");
        const unsub = onValue(reqRef, (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(req => req.labourerId === authUser.uid)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setRequests(list);
            } else {
                setRequests([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [authUser]);

    const handleRequestAction = async (requestId, action, counterPrice = null) => {
        try {
            const updates = { status: action };
            if (counterPrice) updates.counterPrice = Number(counterPrice);
            await update(ref(db, `labour_requests/${requestId}`), updates);
            toast.success(`Request ${action}!`);
        } catch (err) { toast.error("Action failed"); }
    };

    const filteredRequests = useMemo(() => {
        if (filter === "all") return requests;
        return requests.filter(r => r.status === filter);
    }, [requests, filter]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin h-10 w-10 border-4 border-yellow-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-16 pb-12 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-display">Find Work</h1>
                        <p className="text-gray-500 text-sm font-medium">Review and negotiate hiring proposals from local farmers.</p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar">
                        {["all", "sent", "accepted", "countered"].map(f => (
                            <button 
                                key={f} 
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    filter === f ? "bg-gray-900 text-white shadow-lg" : "text-gray-400 hover:text-gray-600"
                                }`}
                            >
                                {f === 'sent' ? 'New' : f}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredRequests.length === 0 ? (
                    <div className="bg-white rounded-[40px] p-20 text-center border border-gray-100 shadow-sm">
                        <div className="text-6xl mb-6">🌾</div>
                        <h3 className="text-xl font-bold text-gray-800">No work proposals found</h3>
                        <p className="text-gray-400 max-w-xs mx-auto mt-2">Farmers will reach out to you based on your skills and location. Keep your profile updated!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        <AnimatePresence mode="popLayout">
                            {filteredRequests.map(req => (
                                <motion.div 
                                    key={req.id} 
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
                                >
                                    {req.status === 'sent' && (
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-500" />
                                    )}

                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="space-y-4 flex-grow">
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-yellow-100 italic">
                                                    {req.skill}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                                                    <MdCalendarToday /> {req.date}
                                                </span>
                                            </div>

                                            <div>
                                                <h3 className="text-xl font-black text-gray-900 leading-tight">Project Offer from {req.farmerName}</h3>
                                                <p className="text-[11px] text-gray-500 font-medium mt-1">Location: Local Farm (Jalgaon District)</p>
                                            </div>

                                            <div className="flex items-center gap-8 pt-2">
                                                <div className="p-3 bg-green-50 rounded-2xl border border-green-100">
                                                    <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Offered Wage</p>
                                                    <p className="text-2xl font-black text-green-700">₹{req.offeredPrice}</p>
                                                </div>
                                                
                                                {req.counterPrice ? (
                                                    <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100">
                                                        <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1">Your Counter</p>
                                                        <p className="text-2xl font-black text-orange-700">₹{req.counterPrice}</p>
                                                    </div>
                                                ) : (
                                                    <div className="hidden md:block">
                                                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Status</p>
                                                        <p className={`text-xs font-black uppercase ${req.status === 'sent' ? 'text-yellow-600' : 'text-gray-400'}`}>{req.status}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row md:flex-col items-stretch md:items-end justify-center gap-2 min-w-[160px]">
                                            {req.status === 'sent' && (
                                                <>
                                                    <button onClick={() => handleRequestAction(req.id, 'accepted')} className="px-6 py-3.5 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition shadow-xl shadow-gray-200">
                                                        <MdCheck className="text-lg" /> Accept Offer
                                                    </button>
                                                    <button onClick={() => {
                                                        const cp = prompt("Enter your counter daily wage", req.offeredPrice + 50);
                                                        if (cp) handleRequestAction(req.id, 'countered', cp);
                                                    }} className="px-6 py-3.5 bg-white border-2 border-orange-200 text-orange-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-50 transition">
                                                        <MdChat className="text-lg" /> Negotiate
                                                    </button>
                                                    <button onClick={() => handleRequestAction(req.id, 'rejected')} className="px-6 py-3 text-red-400 font-bold text-xs uppercase hover:bg-red-50 rounded-2xl transition">
                                                        Decline
                                                    </button>
                                                </>
                                            )}
                                            {req.status !== 'sent' && (
                                                <div className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-center border ${
                                                    req.status === 'accepted' ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-100' :
                                                    req.status === 'countered' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-gray-100 text-gray-400 border-transparent'
                                                }`}>
                                                    {req.status === 'accepted' ? 'Hired ✅' : req.status}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LabourMyWork;
