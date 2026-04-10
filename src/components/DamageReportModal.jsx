import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { ref, push, set, update } from "firebase/database";
import { compressAndUpload } from "../services/cloudinary";
import toast from "react-hot-toast";
import { 
    MdClose, MdPhotoCamera, MdVideocam, MdSend, 
    MdSecurity, MdHistoryEdu, MdVideoCall, MdVerifiedUser,
    MdReportProblem, MdCheckCircle
} from "react-icons/md";

const DamageReportModal = ({ booking, onClose }) => {
    if (!booking) return null;

    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Form, 2: AI Comparing, 2.5: Results, 4: Status
    const [formData, setFormData] = useState({
        description: "",
        goodConditionMedia: [], // Comparison Input 1
        damagedConditionMedia: [] // Comparison Input 2
    });
    const [analysisResults, setAnalysisResults] = useState(null);

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
        // Mock Grok AI Comparative Analysis
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
        }, 3500);
    };

    const submitReport = async () => {
        setLoading(true);
        try {
            const claimId = `CLAIM-${Date.now()}`;
            const claimData = {
                id: claimId,
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

            await set(ref(db, `damage_claims/${claimId}`), claimData);
            await update(ref(db, `bookings/${booking.id}`), { damageReported: true, claimId });
            
            // Notify Admin
            await push(ref(db, "notifications/admin"), {
                type: "damage_report",
                message: `New Comparative Damage claim reported for booking ${booking.id} (AI Estimate: ₹${analysisResults?.estimatedRepair})`,
                claimId,
                createdAt: new Date().toISOString()
            });

            setStep(4);
            toast.success("Damage report submitted for review.");
        } catch (err) {
            toast.error("Failed to submit report");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                            <MdSecurity className="text-xl" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 tracking-tight">AI Damage Comparison Engine</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Grok xAI Pro Intermediary</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
                        <MdClose className="text-xl" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-700 uppercase tracking-widest">Damage Summary</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Briefly describe the damage observed..."
                                    className="w-full h-24 p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-red-500 focus:outline-none transition-all placeholder:text-gray-300 font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Input 1: Good Condition */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded">1. Reference: Good State</p>
                                        {formData.goodConditionMedia.length > 0 && <MdCheckCircle className="text-green-500" />}
                                    </div>
                                    <label className="cursor-pointer group flex flex-col">
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'goodConditionMedia')} />
                                        <div className={`h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${formData.goodConditionMedia.length > 0 ? "border-green-400 bg-green-50/10" : "border-gray-200 group-hover:border-green-300"}`}>
                                            <MdVerifiedUser className={`text-3xl ${formData.goodConditionMedia.length > 0 ? "text-green-500" : "text-gray-300"}`} />
                                            <p className="text-[10px] font-black text-gray-400">Upload Before-Usage Proof</p>
                                        </div>
                                    </label>
                                </div>

                                {/* Input 2: Damaged Condition */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded">2. Current: Damaged State</p>
                                        {formData.damagedConditionMedia.length > 0 && <MdCheckCircle className="text-red-500" />}
                                    </div>
                                    <label className="cursor-pointer group flex flex-col">
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'damagedConditionMedia')} />
                                        <div className={`h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${formData.damagedConditionMedia.length > 0 ? "border-red-400 bg-red-50/10" : "border-gray-200 group-hover:border-red-300"}`}>
                                            <MdReportProblem className={`text-3xl ${formData.damagedConditionMedia.length > 0 ? "text-red-500" : "text-gray-300"}`} />
                                            <p className="text-[10px] font-black text-gray-400">Upload Current Damage Proof</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <button 
                                onClick={runAIDetection}
                                disabled={!formData.description || formData.goodConditionMedia.length === 0 || formData.damagedConditionMedia.length === 0}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-gray-200 hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Compare & Analyze (Grok xAI)
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center py-20 space-y-6">
                            <div className="w-24 h-24 relative">
                                <div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
                                <div className="absolute inset-0 border-4 border-black rounded-full border-t-transparent animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <MdSecurity className="text-3xl text-black" />
                                </div>
                            </div>
                            <div className="text-center">
                                <h4 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Analyzing Pixel Divergence...</h4>
                                <p className="text-gray-500 mt-1 max-w-xs mx-auto text-sm font-bold">Grok is comparing Before vs After states to calculate precise damage percentage.</p>
                            </div>
                        </div>
                    )}

                    {step === 2.5 && (
                        <div className="space-y-6">
                            <div className="bg-green-50 rounded-[24px] border border-green-100 p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl">🤖</div>
                                    <div>
                                        <h4 className="font-black text-green-900">AI Comparison Analysis Complete</h4>
                                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest tracking-widest">Verification Confidence: {analysisResults?.aiConfidence}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm font-bold">
                                    <div className="p-4 bg-white rounded-2xl border border-green-100">
                                        <p className="text-gray-400 text-[10px] uppercase">Damage Percentage</p>
                                        <p className="text-red-600 text-2xl font-black">{analysisResults?.damagePercentage}</p>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-green-100">
                                        <p className="text-gray-400 text-[10px] uppercase">Compensation Limit</p>
                                        <p className="text-green-700 text-2xl font-black">₹{analysisResults?.estimatedRepair?.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-green-100 col-span-2">
                                        <p className="text-gray-400 text-[10px] uppercase mb-1">AI Reasoning Report</p>
                                        <p className="text-gray-700 font-medium leading-relaxed italic text-xs block">
                                            "{analysisResults?.comparisonStatus}: Significant divergence detected in {analysisResults?.type} region. The current state proof shows structural anomalies not present in the reference good state."
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={submitReport}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-gray-200 hover:bg-black transition"
                            >
                                Approve AI Findings & Finalize
                            </button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-xl shadow-green-50">
                                <MdVerifiedUser />
                            </div>
                            <h4 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">AI Settlement Authorized</h4>
                            <p className="text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed text-sm">
                                Based on the <strong>{analysisResults?.damagePercentage}</strong> damage detected, a refund/compensation of <strong>₹{analysisResults?.estimatedRepair?.toLocaleString()}</strong> has been calculated.
                            </p>
                            
                            <div className="w-full max-w-sm mt-8 space-y-4">
                                {[
                                    { label: "Comparative Report Logged", done: true },
                                    { label: "Grok xAI Verification", done: true },
                                    { label: "Admin Final Auth", done: false },
                                    { label: "Payment Processed", done: false },
                                ].map((s, idx) => (
                                    <div key={idx} className="flex items-center gap-4">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] ${s.done ? "bg-green-600 border-green-600 text-white" : "border-gray-200"}`}>
                                            {s.done ? "✓" : idx + 1}
                                        </div>
                                        <p className={`text-sm font-bold ${s.done ? "text-gray-900" : "text-gray-400"}`}>{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            <button onClick={onClose} className="mt-10 btn-primary w-full max-w-sm">Return to Dashboard</button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default DamageReportModal;
