import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView } from "../components/RNPrimitives";
import { 
    MdSatellite, MdShield, MdWarning, MdTimeline, MdBarChart,
    MdSearch, MdFilterList, MdArrowForward, MdDownload, MdUndo,
    MdAnalytics
} from "react-icons/md";
import { cropShieldApi } from "../lib/cropShieldApi";
import FarmBoundaryMap from "../components/FarmBoundaryMap";
import toast from "react-hot-toast";

const CropClaimAudit = () => {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [artifacts, setArtifacts] = useState(null);
    const [reviewNotes, setReviewNotes] = useState("");

    useEffect(() => {
        fetchClaims();
    }, []);

    const fetchClaims = async () => {
        setLoading(true);
        try {
            const data = await cropShieldApi.getClaims({ limit: 10, offset: 0 });
            setClaims(data.items || []);
        } catch (err) {
            toast.error("Failed to fetch claims: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectClaim = async (id) => {
        setLoading(true);
        setSelectedClaim(null);
        setArtifacts(null);
        try {
            const full = await cropShieldApi.getClaimFull(id);
            setSelectedClaim(full);
            if (full.latest_analysis?.status === 'completed') {
                const arts = await cropShieldApi.getAnalysisArtifacts(id);
                setArtifacts(arts);
            }
        } catch (err) {
            toast.error("Deep dive failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (status) => {
        try {
            await cropShieldApi.reviewClaim(selectedClaim.claim_id, {
                admin_status: status,
                reviewed_by: "Admin",
                admin_notes: reviewNotes
            });
            toast.success(`Claim ${status} successfully.`);
            setSelectedClaim(null);
            fetchClaims();
        } catch (err) {
            toast.error("Review update failed: " + err.message);
        }
    };

    return (
        <ScrollView className="min-h-screen bg-[#FDFEFE] pt-20 pb-12 px-4">
            <View className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <View className="flex-row items-end justify-between">
                    <View className="space-y-1">
                        <View className="flex-row items-center gap-2">
                            <MdShield className="text-emerald-600" />
                            <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Administrative Authority</Text>
                        </View>
                        <Text className="text-4xl font-black text-slate-900 tracking-tighter">Supervision <Text className="text-emerald-600">Audit Board</Text></Text>
                    </View>
                    <TouchableOpacity onPress={fetchClaims} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <MdTimeline size={24} className="text-slate-400" />
                    </TouchableOpacity>
                </View>

                <View className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Claims List */}
                    <View className="lg:col-span-4 bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                        <View className="p-6 border-b border-slate-50 bg-slate-50/50 flex-row items-center justify-between">
                            <Text className="font-black text-slate-900 text-xs uppercase tracking-widest">Active Vectors</Text>
                            <MdFilterList className="text-slate-400" />
                        </View>
                        <View className="divide-y divide-slate-50">
                            {loading && !selectedClaim && <View className="p-10 items-center"><Text className="animate-spin text-2xl">◌</Text></View>}
                            {claims.map(c => (
                                <TouchableOpacity 
                                    key={c.id} 
                                    onPress={() => handleSelectClaim(c.id)}
                                    className={`p-6 hover:bg-slate-50 transition-colors flex-row items-center justify-between ${selectedClaim?.claim?.claim_id === c.id ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''}`}
                                >
                                    <View className="space-y-1">
                                        <Text className="font-black text-slate-800 tracking-tight">{c.farmer_name}</Text>
                                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.crop_type} · {c.damage_date}</Text>
                                    </View>
                                    <View className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                        c.admin_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                        c.admin_status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                        {(c.admin_status || "pending").replace(/_/g, " ")}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Audit View */}
                    <View className="lg:col-span-8">
                        {!selectedClaim ? (
                            <View className="h-[600px] border-4 border-dashed border-slate-100 rounded-[40px] items-center justify-center p-20 text-center space-y-4">
                                <MdSatellite className="text-8xl text-slate-100" />
                                <Text className="font-black text-slate-300 uppercase tracking-[0.3em]">Select a vector to decrypt</Text>
                            </View>
                        ) : (
                            <View className="space-y-6 animate-in fade-in zoom-in">
                                
                                {/* Analysis Panel */}
                                <View className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                                     <View className="absolute top-0 right-0 p-12 opacity-10 rotate-12 pointer-events-none">
                                         <MdAnalytics className="text-[200px]" />
                                     </View>
                                     <View className="relative z-10 space-y-6">
                                        <View className="flex-row items-center justify-between">
                                            <View className="space-y-1">
                                                <Text className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Forensic Interpretation</Text>
                                                <Text className="text-3xl font-black tracking-tighter">AI Analysis Packet</Text>
                                            </View>
                                            <View className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
                                                <Text className="text-lg font-black text-emerald-400">#CF-{selectedClaim.claim.claim_id}</Text>
                                            </View>
                                        </View>

                                        <View className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <View className="bg-white/5 p-4 rounded-3xl border border-white/10 text-center">
                                                <Text className="text-[9px] font-bold text-slate-500 uppercase">Damage %</Text>
                                                <Text className="text-2xl font-black text-orange-400">{selectedClaim.claim.latest_damage_percentage?.toFixed(1) || "0.0"}%</Text>
                                            </View>
                                            <View className="bg-white/5 p-4 rounded-3xl border border-white/10 text-center">
                                                <Text className="text-[9px] font-bold text-slate-500 uppercase">AI Prob</Text>
                                                <Text className="text-2xl font-black text-indigo-400">{selectedClaim.claim.latest_ai_damage_probability?.toFixed(2) || "0.00"}</Text>
                                            </View>
                                            <View className="bg-white/5 p-4 rounded-3xl border border-white/10 text-center">
                                                <Text className="text-[9px] font-bold text-slate-500 uppercase">NDVI Before</Text>
                                                <Text className="text-xl font-black text-emerald-400">{selectedClaim.latest_analysis?.metrics?.ndvi_before?.toFixed(2) || "0.00"}</Text>
                                            </View>
                                            <View className="bg-white/5 p-4 rounded-3xl border border-white/10 text-center">
                                                <Text className="text-[9px] font-bold text-slate-500 uppercase">NDVI After</Text>
                                                <Text className="text-xl font-black text-rose-400">{selectedClaim.latest_analysis?.metrics?.ndvi_after?.toFixed(2) || "0.00"}</Text>
                                            </View>
                                        </View>
                                     </View>
                                </View>

                                {/* Visual Samples */}
                                {artifacts ? (
                                    <View className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <View className="space-y-2">
                                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">RGB Before</Text>
                                            <Image src={artifacts.before_rgb_data_url} className="w-full h-32 rounded-2xl border border-slate-100" />
                                        </View>
                                        <View className="space-y-2">
                                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">RGB After</Text>
                                            <Image src={artifacts.after_rgb_data_url} className="w-full h-32 rounded-2xl border border-slate-100 shadow-lg shadow-rose-100" />
                                        </View>
                                        <View className="space-y-2">
                                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">NDVI Packet</Text>
                                            <Image src={artifacts.ndvi_after_data_url} className="w-full h-32 rounded-2xl border border-slate-100" />
                                        </View>
                                        <View className="space-y-2">
                                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">NDWI Index</Text>
                                            <Image src={artifacts.ndwi_after_data_url} className="w-full h-32 rounded-2xl border border-slate-100" />
                                        </View>
                                    </View>
                                ) : (
                                    <View className="p-10 bg-slate-50 rounded-3xl items-center border border-dashed border-slate-200">
                                        <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">Metadata payload decryption in progress...</Text>
                                    </View>
                                )}

                                {/* Adjudication */}
                                <View className="bg-white rounded-[40px] border border-slate-100 shadow-xl p-8 space-y-6">
                                    <View className="space-y-2">
                                        <Text className="text-xs font-black uppercase text-slate-400 tracking-widest">Audit Testimony & Decision</Text>
                                        <textarea 
                                            rows={3}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-3xl px-6 py-4 font-bold text-sm text-slate-900 outline-none focus:ring-4 focus:ring-emerald-100"
                                            placeholder="Enter internal audit justifying the adjudication..."
                                            value={reviewNotes}
                                            onChange={e => setReviewNotes(e.target.value)}
                                        />
                                    </View>
                                    <View className="flex-row gap-4">
                                        <TouchableOpacity 
                                            onPress={() => handleReview('approved')}
                                            className="flex-1 bg-emerald-600 text-white py-5 rounded-3xl items-center justify-center font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-100"
                                        >
                                            <Text>Seal Approval</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => handleReview('rejected')}
                                            className="flex-1 bg-slate-900 text-white py-5 rounded-3xl items-center justify-center font-black text-sm uppercase tracking-widest shadow-xl"
                                        >
                                            <Text>Deny Claim</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                            </View>
                        )}
                    </View>

                </View>

            </View>
        </ScrollView>
    );
};

export default CropClaimAudit;
