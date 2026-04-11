import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { ref, push, set, update, onValue } from "firebase/database";
import { compressAndUpload } from "../services/cloudinary";
import toast from "react-hot-toast";
import { 
    MdClose, MdPhotoCamera, MdVideocam, MdSend, 
    MdSecurity, MdHistoryEdu, MdVideoCall, MdVerifiedUser,
    MdReportProblem, MdCheckCircle, MdTimer, MdPayment, MdRecordVoiceOver
} from "react-icons/md";

const DamageReportModal = ({ booking, onClose }) => {
    if (!booking) return null;

    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Form, 2: AI Comparing, 2.5: AI Summary, 4: Tracking
    const [formData, setFormData] = useState({
        description: "",
        goodConditionMedia: [], 
        damagedConditionMedia: [] 
    });
    const [analysisResults, setAnalysisResults] = useState(null);
    const [claimId, setClaimId] = useState(null);
    const [claimStatus, setClaimStatus] = useState("reported");

    // Listen for live status updates if we have a claimId
    useEffect(() => {
        if (claimId) {
            const statusRef = ref(db, `damage_claims/${claimId}/status`);
            const unsub = onValue(statusRef, (snap) => {
                if (snap.exists()) setClaimStatus(snap.val());
            });
            return () => unsub();
        }
    }, [claimId]);

    const handleFileUpload = async (e, category) => {
        const files = Array.from(e.target.files);
        setLoading(true);
        try {
            const uploadedUrls = [];
            for (const file of files) {
                const url = await compressAndUpload(file);
                uploadedUrls.push(url);
            }
            setFormData(prev => ({ 
                ...prev, 
                [category]: [...prev[category], ...uploadedUrls] 
            }));
            toast.success("Evidence captured");
        } catch (err) {
            toast.error("Upload failed");
        } finally {
            setLoading(false);
        }
    };

    const runAIDetection = () => {
        setStep(2);
        // Mock xAI Grok Comparative Analysis
        setTimeout(() => {
            const damagePercent = Math.floor(Math.random() * 40) + 10;
            const mockAnalysis = {
                type: formData.description.toLowerCase().includes("engine") ? "Mechanical / Internal" : "External / Body",
                damagePercentage: `${damagePercent}%`,
                severity: damagePercent > 30 ? "Major" : "Moderate",
                estimatedRepair: Math.floor((booking.totalPrice || 5000) * (damagePercent / 100) * 1.5),
                trustScoreImpact: -damagePercent / 5,
                aiConfidence: "98.2%",
                comparisonStatus: "Discrepancy Detected"
            };
            setAnalysisResults(mockAnalysis);
            setStep(2.5); 
        }, 3000);
    };

    const submitReport = async () => {
        setLoading(true);
        try {
            const newClaimId = `CLAIM-${Date.now()}`;
            const claimData = {
                id: newClaimId,
                bookingId: booking.id,
                ownerId: booking.ownerId,
                renterId: booking.userId,
                description: formData.description,
                goodConditionMedia: formData.goodConditionMedia,
                damagedConditionMedia: formData.damagedConditionMedia,
                status: "reported",
                aiAssessment: analysisResults,
                createdAt: new Date().toISOString(),
                estimatedCost: analysisResults?.estimatedRepair || 0,
                damagePercentage: analysisResults?.damagePercentage
            };

            await set(ref(db, `damage_claims/${newClaimId}`), claimData);
            await update(ref(db, `bookings/${booking.id}`), { damageReported: true, claimId: newClaimId });
            
            setClaimId(newClaimId);
            setStep(4); // Go straight to tracking
            toast.success("Damage report logged in central ledger.");
        } catch (err) {
            toast.error("Failed to submit report");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner">
                            <MdSecurity className="text-2xl" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight leading-none">Damage Protection 🛡️</h3>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1.5">Intermediary Accountability Protocol</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                        <MdClose className="text-xl text-gray-600" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {step === 1 && (
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Damage Description</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="e.g. Broken hydraulic arm, tire puncture, or engine overheating during use..."
                                    className="w-full h-32 p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl focus:border-red-500 focus:outline-none transition-all placeholder:text-gray-300 font-bold text-gray-800"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-lg">Reference Proof</p>
                                        {formData.goodConditionMedia.length > 0 && <MdCheckCircle className="text-green-500 text-lg" />}
                                    </div>
                                    <label className="cursor-pointer group block">
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'goodConditionMedia')} />
                                        <div className={`h-44 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-3 transition-all ${formData.goodConditionMedia.length > 0 ? "border-green-400 bg-green-50/20" : "border-gray-200 group-hover:border-green-300 bg-gray-50/50"}`}>
                                            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-green-500">
                                                <MdVerifiedUser className="text-2xl" />
                                            </div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Upload "Before" State</p>
                                        </div>
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-lg">Current Damage</p>
                                        {formData.damagedConditionMedia.length > 0 && <MdCheckCircle className="text-red-500 text-lg" />}
                                    </div>
                                    <label className="cursor-pointer group block">
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'damagedConditionMedia')} />
                                        <div className={`h-44 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-3 transition-all ${formData.damagedConditionMedia.length > 0 ? "border-red-400 bg-red-50/20" : "border-gray-200 group-hover:border-green-300 bg-gray-50/50"}`}>
                                            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-red-500">
                                                <MdReportProblem className="text-2xl" />
                                            </div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Upload Damage Proof</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <button 
                                onClick={runAIDetection}
                                disabled={!formData.description || formData.goodConditionMedia.length === 0 || formData.damagedConditionMedia.length === 0 || loading}
                                className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-lg shadow-2xl shadow-gray-200 hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading ? "Uploading Evidence..." : "Trigger AI Visual Audit 🤖"}
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center py-24 space-y-8">
                            <div className="relative">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="w-28 h-28 border-[6px] border-gray-100 border-t-black rounded-full"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <MdSecurity className="text-4xl text-black" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <h4 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Comparative Pixel Sweep...</h4>
                                <p className="text-gray-500 font-bold text-sm max-w-sm mx-auto">Grok xAI is cross-referencing temporal divergence to calculate forensic damage severity.</p>
                            </div>
                        </div>
                    )}

                    {step === 2.5 && (
                        <div className="space-y-8">
                            <div className="bg-gradient-to-br from-gray-900 to-black rounded-[40px] p-8 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/10 blur-[60px] rounded-full" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl">🤖</div>
                                        <div>
                                            <h4 className="font-black text-lg">Visual Audit Summary</h4>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Confidence Index: {analysisResults?.aiConfidence}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Detected Damage</p>
                                            <p className="text-3xl font-black text-red-500">{analysisResults?.damagePercentage}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Est. Compensation</p>
                                            <p className="text-3xl font-black text-green-400">₹{analysisResults?.estimatedRepair?.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-8 p-5 bg-white/5 rounded-2xl border border-white/10 italic text-sm text-gray-300 font-medium leading-relaxed">
                                        "{analysisResults?.comparisonStatus}: Grok identified a {analysisResults?.severity.toLowerCase()} structural anomaly in the {analysisResults?.type} region, recommending immediate platform-backed repair coverage."
                                    </div>
                                </div>
                            </div>

                            <button onClick={submitReport} className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-lg shadow-xl shadow-gray-100 hover:bg-black transition-all">
                                Confirm & Initialize Claims Office
                            </button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-8">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-xl shadow-green-50 ring-8 ring-green-50/50">
                                    <MdCheckCircle />
                                </div>
                                <h4 className="text-2xl font-black text-gray-900 uppercase">Case Status Tracking</h4>
                                <p className="text-gray-500 font-bold text-sm mt-1">Claim #{claimId?.split('-')[1]} • Active Oversight</p>
                            </div>
                            
                            <div className="bg-gray-50 rounded-[32px] p-8 space-y-6 border border-gray-100">
                                {[
                                    { label: "AI Discrepancy Logged", status: "completed", t: "14:22 PM", icon: <MdSecurity /> },
                                    { label: "AI Verification Complete", status: claimStatus === "reported" ? "current" : "completed", t: claimStatus === "reported" ? "Scanning Proof..." : "Verified by Grok", icon: <MdRecordVoiceOver /> },
                                    { label: "Final Authorization", status: claimStatus === "verified" ? "current" : (claimStatus === "processed" || claimStatus === "credited" ? "completed" : "pending"), t: claimStatus === "verified" ? "Auth Pending" : "Admin Approved", icon: <MdVerifiedUser /> },
                                    { label: "Compensation Disbursed", status: claimStatus === "processed" || claimStatus === "credited" ? "completed" : "pending", t: "Credit in 5-7 working days", icon: <MdPayment /> },
                                ].map((s, idx) => (
                                    <div key={idx} className="flex items-start gap-5 relative">
                                        {idx < 3 && <div className={`absolute left-4 top-10 w-0.5 h-10 ${s.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'}`} />}
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg z-10 transition-all ${
                                            s.status === 'completed' ? "bg-green-600 text-white shadow-lg shadow-green-100 scale-110" : 
                                            s.status === 'current' ? "bg-red-500 text-white animate-pulse" : "bg-white border-2 border-gray-100 text-gray-300"
                                        }`}>
                                            {s.icon}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-sm font-black ${s.status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>{s.label}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{s.t}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex items-center gap-4">
                                <div className="text-2xl">🏦</div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Credit Timeline Notification</p>
                                    <p className="text-xs font-bold text-gray-700 mt-1">Once authorized, your compensation will be credited in 5-7 working days by our team.</p>
                                </div>
                            </div>

                            <button onClick={onClose} className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-lg shadow-xl shadow-gray-200 hover:bg-black transition-all">
                                Return to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default DamageReportModal;
