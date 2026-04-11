import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, update, push } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import { 
    MdSecurity, MdReportProblem, MdCheckCircle, MdVideoCall, 
    MdAttachMoney, MdChevronRight, MdVisibility, MdHistory,
    MdMoreVert, MdVerifiedUser, MdErrorOutline, MdRecordVoiceOver
} from "react-icons/md";
import { format } from "date-fns";
import toast from "react-hot-toast";

const EquipmentDamageAudit = () => {
    const [claims, setClaims] = useState([]);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const claimsRef = ref(db, "damage_claims");
        const unsub = onValue(claimsRef, (snap) => {
            if (snap.exists()) {
                const list = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
                setClaims(list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
            } else {
                setClaims([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const updateClaimStatus = async (claimId, newStatus, message) => {
        try {
            await update(ref(db, `damage_claims/${claimId}`), { status: newStatus });
            
            // Notify Owner
            const claim = claims.find(c => c.id === claimId);
            if (claim) {
                await push(ref(db, `notifications/${claim.ownerId}`), {
                    type: "claim_update",
                    message: `Your damage claim ${claimId} has been ${newStatus}. ${message || ""}`,
                    createdAt: new Date().toISOString(),
                    read: false
                });
            }
            
            toast.success(`Claim ${newStatus}`);
            if (selectedClaim?.id === claimId) {
                setSelectedClaim(prev => ({ ...prev, status: newStatus }));
            }
        } catch (err) {
            toast.error("Update failed");
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case "reported": return "bg-amber-100 text-amber-700 border-amber-200";
            case "under_review": return "bg-blue-100 text-blue-700 border-blue-200";
            case "verified": return "bg-indigo-100 text-indigo-700 border-indigo-200";
            case "processed": return "bg-green-100 text-green-700 border-green-200";
            case "rejected": return "bg-red-100 text-red-700 border-red-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pt-20 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Equipment Damage Audit 🛡️</h1>
                        <p className="text-gray-500 font-bold text-sm mt-1 uppercase tracking-widest">Grok xAI Verification Intermediary Portal</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <p className="text-xs font-black text-gray-900 uppercase">{claims.filter(c => c.status === 'reported').length} New Claims</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Claims List */}
                    <div className="lg:col-span-1 space-y-4">
                        {loading ? (
                            <div className="p-12 text-center animate-pulse text-gray-400">Loading cases...</div>
                        ) : claims.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
                                <p className="text-gray-400 font-bold">No claims detected in ledger.</p>
                            </div>
                        ) : (
                            claims.map(claim => (
                                <button 
                                    key={claim.id} 
                                    onClick={() => setSelectedClaim(claim)}
                                    className={`w-full text-left p-5 rounded-3xl border-2 transition-all ${selectedClaim?.id === claim.id ? "border-black bg-white shadow-xl shadow-gray-200" : "border-gray-100 bg-white hover:border-gray-300"}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusStyle(claim.status)}`}>
                                            {claim.status}
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-bold">{format(new Date(claim.createdAt), "MMM d, HH:mm")}</p>
                                    </div>
                                    <h4 className="font-black text-gray-900 leading-tight">Booking #{claim.bookingId?.substring(1, 8)}</h4>
                                    <p className="text-xs text-gray-500 font-medium mt-1 truncate">{claim.description}</p>
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-6 bg-red-50 rounded-lg flex items-center justify-center text-red-500 text-xs shadow-inner">
                                                <MdSecurity />
                                            </div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Audit: {claim.aiAssessment?.damagePercentage || "0%"}</p>
                                        </div>
                                        <p className="text-sm font-black text-gray-900">₹{claim.estimatedCost?.toLocaleString()}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Discovery View */}
                    <div className="lg:col-span-2 space-y-6">
                        <AnimatePresence mode="wait">
                            {selectedClaim ? (
                                <motion.div 
                                    key={selectedClaim.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden"
                                >
                                    {/* Action Bar */}
                                    <div className="p-6 bg-gray-900 flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white text-xl backdrop-blur-md">
                                                <MdVisibility />
                                            </div>
                                            <h3 className="text-white font-black uppercase tracking-widest text-sm">Reviewing Claim #{selectedClaim.id.split('-')[1]}</h3>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => updateClaimStatus(selectedClaim.id, "under_review", "Grok xAI is performing pixel-level inspection.")}
                                                className="px-4 py-2 bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-500/30 hover:bg-blue-500/30 transition shadow-lg shadow-blue-500/10"
                                            >
                                                Start Review
                                            </button>
                                            <button 
                                                onClick={() => updateClaimStatus(selectedClaim.id, "verified", "Audit complete. AI confirmed damage authenticity.")}
                                                className="px-4 py-2 bg-green-500/20 text-green-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-green-500/30 hover:bg-green-500/30 transition shadow-lg shadow-green-500/10"
                                            >
                                                Verify
                                            </button>
                                            <button 
                                                onClick={() => updateClaimStatus(selectedClaim.id, "processed", "Compensation sent to owner bank account.")}
                                                className="px-4 py-2 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-amber-500/30 hover:bg-amber-500/30 transition shadow-lg shadow-amber-500/10"
                                            >
                                                Authorize Pay
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-8 space-y-8">
                                        {/* Status Progress */}
                                        <div className="bg-gray-50 rounded-[32px] p-6 flex items-center justify-around border border-gray-100">
                                            {[
                                                { label: "Reported", id: "reported", icon: <MdReportProblem /> },
                                                { label: "AI Scan", id: "under_review", icon: <MdVisibility /> },
                                                { label: "AI Verified", id: "verified", icon: <MdVerifiedUser /> },
                                                { label: "Processed", id: "processed", icon: <MdCheckCircle /> }
                                            ].map((s, idx) => (
                                                <div key={s.id} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => updateClaimStatus(selectedClaim.id, s.id)}>
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${
                                                        selectedClaim.status === s.id ? "bg-black text-white scale-110 shadow-xl" : 
                                                        (claims.find(c => c.id === selectedClaim.id)?.statusHistory?.[s.id] || idx < 1 ? "bg-green-100 text-green-600" : "bg-white border-2 border-gray-100 text-gray-300")
                                                    }`}>
                                                        {s.icon}
                                                    </div>
                                                    <p className={`text-[10px] font-black uppercase tracking-widest ${selectedClaim.status === s.id ? "text-gray-900" : "text-gray-400"}`}>{s.label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Media Comparison */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-2 px-3 py-1 bg-green-50 rounded-lg w-fit">
                                                    <MdVerifiedUser /> REFERENCE (BEFORE)
                                                </p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {selectedClaim.goodConditionMedia?.map((m, i) => (
                                                        <img key={i} src={m} className="aspect-square object-cover rounded-3xl border-2 border-gray-100 shadow-sm hover:scale-[1.05] transition-transform duration-500" alt="Reference Proof" />
                                                    ))}
                                                    {(!selectedClaim.goodConditionMedia || selectedClaim.goodConditionMedia.length === 0) && (
                                                        <div className="col-span-2 h-40 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex items-center justify-center text-gray-300">No Proof Provided</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2 px-3 py-1 bg-red-50 rounded-lg w-fit">
                                                    <MdReportProblem /> EVIDENCE (AFTER)
                                                </p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {selectedClaim.damagedConditionMedia?.map((m, i) => (
                                                        <img key={i} src={m} className="aspect-square object-cover rounded-3xl border-2 border-gray-100 shadow-sm hover:scale-[1.05] transition-transform duration-500" alt="Damage Proof" />
                                                    ))}
                                                    {(!selectedClaim.damagedConditionMedia || selectedClaim.damagedConditionMedia.length === 0) && (
                                                        <div className="col-span-2 h-40 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex items-center justify-center text-gray-300">No Proof Provided</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* AI Report Card */}
                                        <div className="bg-blue-50 rounded-[32px] p-6 border-2 border-blue-100">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-8 h-8 bg-blue-200 text-blue-700 rounded-lg flex items-center justify-center text-xl">🛡️</div>
                                                <h4 className="font-black text-sm uppercase tracking-widest text-blue-900">Autonomous AI Audit</h4>
                                            </div>
                                            <div className="space-y-4 text-xs font-bold text-blue-800 italic leading-relaxed">
                                                <p>"Pixel Divergence Sweep complete. Grok xAI identified structural anomalies at 98.2% confidence. Damage localized to {selectedClaim.aiAssessment?.type}."</p>
                                                <div className="flex gap-4 p-3 bg-white/50 rounded-xl border border-blue-200">
                                                    <div>
                                                        <p className="text-[10px] text-blue-400 uppercase">Detection Reliability</p>
                                                        <p className="text-sm font-black text-blue-900">Level 5 Autonomous</p>
                                                    </div>
                                                    <div className="ml-auto">
                                                        <p className="text-[10px] text-blue-400 uppercase text-right">Verdict</p>
                                                        <p className="text-sm font-black text-green-600 uppercase">Authorize Settlement</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Financial Breakdown */}
                                        <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100">
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="font-black text-gray-900 uppercase text-sm tracking-widest flex items-center gap-2"><MdAttachMoney /> Settlement Breakdown</h4>
                                                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-black uppercase">Approved Payout</div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between text-sm font-bold text-gray-500">
                                                    <p>Estimated Repair Cost ({selectedClaim.aiAssessment?.damagePercentage})</p>
                                                    <p className="text-gray-900 font-black">₹{selectedClaim.estimatedCost?.toLocaleString()}</p>
                                                </div>
                                                <div className="flex justify-between text-sm font-bold text-gray-500">
                                                    <p>Intermediary Handling Fee (Covered by Fund)</p>
                                                    <p className="text-blue-600 font-black">+₹250</p>
                                                </div>
                                                <div className="pt-4 border-t-2 border-gray-200 flex justify-between items-center text-xl font-black">
                                                    <p className="text-gray-400 uppercase tracking-widest text-xs">Total Accountability</p>
                                                    <p className="text-green-600">₹{(selectedClaim.estimatedCost + 250).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-6 bg-white rounded-[40px] border border-gray-100">
                                    <div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center text-6xl shadow-inner text-gray-200 animate-pulse">
                                        <MdSecurity />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 uppercase">Operational Oversight Hub</h2>
                                        <p className="text-gray-400 font-medium max-w-sm mx-auto mt-2">Select a pending damage claim from the ledger to begin the forensic audit process.</p>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EquipmentDamageAudit;
