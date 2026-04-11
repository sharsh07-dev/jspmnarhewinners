import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView } from "../components/RNPrimitives";
import { 
    MdSatellite, MdMap, MdEvent, MdCheckCircle, MdInfo, 
    MdChevronRight, MdHistory, MdKeyboardArrowLeft, MdAnalytics
} from "react-icons/md";
import { cropShieldApi, pollJob } from "../lib/cropShieldApi";
import FarmBoundaryMap from "../components/FarmBoundaryMap";
import toast from "react-hot-toast";

const CropClaimFiling = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [farmProfile, setFarmProfile] = useState(null);
    const [analysisJob, setAnalysisJob] = useState(null);
    const [progress, setProgress] = useState(0);

    const [form, setForm] = useState({
        farmer_name: "",
        crop_type: "Sugarcane",
        damage_date: new Date().toISOString().split('T')[0],
        // Mocked location indices for Maharashtra village
        state_index: 0,
        category_index: 0,
        district_index: 0,
        taluka_index: 0,
        village_index: 0,
        plot_index: 0
    });

    const handleLookup = async () => {
        if (!form.farmer_name) return toast.error("Please enter farmer name");
        setLoading(true);
        try {
            const profile = await cropShieldApi.createFarmProfile(form);
            setFarmProfile(profile);
            setStep(2);
            toast.success("Farm data synchronized!");
        } catch (err) {
            toast.error("Lookup failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const submitClaim = async () => {
        setLoading(true);
        setStep(3);
        try {
            const claim = await cropShieldApi.createClaim({
                farm_profile_id: farmProfile.id,
                farmer_name: form.farmer_name,
                crop_type: form.crop_type,
                damage_date: form.damage_date
            });

            const job = await cropShieldApi.analyzeClaim(claim.id, {
                gap_before: 10,
                gap_after: 10,
                window_days: 20
            });

            await pollJob(job.job_id, (status) => {
                setProgress(status.progress || 0);
                if (status.status === 'completed') {
                    setStep(4);
                    toast.success("Analysis Complete!");
                }
            });
        } catch (err) {
            toast.error("Claim failed: " + err.message);
            setStep(2);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView className="min-h-screen bg-[#F8FAFC] pt-20 pb-12 px-4 relative overflow-hidden">
            {/* Background elements for premium feel */}
            <View className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-[120px] -z-10" />
            <View className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-50/50 rounded-full blur-[100px] -z-10" />

            <View className="max-w-xl mx-auto space-y-8 relative z-10">
                
                {/* Header Section */}
                <View className="space-y-4">
                    <View className="flex-row items-center gap-3">
                        <View className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100">
                            <MdSatellite size={28} className="text-white" />
                        </View>
                        <View>
                            <Text className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600 mb-0.5">Space-Grade Audit</Text>
                            <View className="h-1 w-12 bg-indigo-600 rounded-full" />
                        </View>
                    </View>
                    <Text className="text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
                        AI Crop Claim <Text className="text-indigo-600 font-black">Portal</Text>
                    </Text>
                    <Text className="text-base font-medium text-slate-500 max-w-md">
                        Submit forensic claims with verified land records and multispectral satellite imagery.
                    </Text>
                </View>

                {/* Progress Bar */}
                <View className="flex-row gap-2 px-1">
                    {[1, 2, 3, 4].map(s => (
                        <View key={s} className={`h-2 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-indigo-600 shadow-md shadow-indigo-100' : 'bg-slate-200'}`} />
                    ))}
                </View>

                {/* STEPS CONTAINER */}
                <View className="bg-white/80 backdrop-blur-xl rounded-[48px] border border-white shadow-[0_32px_64px_-16px_rgba(79,70,229,0.12)] p-10 min-h-[480px]">
                    {step === 1 && (
                        <View className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <View className="space-y-3">
                                <View className="flex-row items-center justify-between px-1">
                                    <Text className="text-[11px] font-black uppercase tracking-widest text-slate-400">Claimant Full Name</Text>
                                    <MdInfo size={14} className="text-slate-300" />
                                </View>
                                <input 
                                    className="w-full bg-slate-50 border border-slate-100 rounded-[24px] px-8 py-5 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white focus:border-indigo-200 transition-all text-lg shadow-sm"
                                    placeholder="Enter legal owner name"
                                    value={form.farmer_name}
                                    onChange={e => setForm({...form, farmer_name: e.target.value})}
                                />
                            </View>

                            <View className="grid grid-cols-2 gap-6">
                                <View className="space-y-3">
                                    <Text className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">Crop Type</Text>
                                    <select 
                                        className="w-full bg-slate-50 border border-slate-100 rounded-[20px] px-6 py-4 font-bold text-slate-900 shadow-sm appearance-none outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                                        value={form.crop_type}
                                        onChange={e => setForm({...form, crop_type: e.target.value})}
                                    >
                                        <option>Sugarcane</option>
                                        <option>Cotton</option>
                                        <option>Wheat</option>
                                        <option>Soybean</option>
                                    </select>
                                </View>
                                <View className="space-y-3">
                                    <Text className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">Damage Date</Text>
                                    <input 
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-[20px] px-6 py-4 font-bold text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                                        value={form.damage_date}
                                        onChange={e => setForm({...form, damage_date: e.target.value})}
                                    />
                                </View>
                            </View>

                            <View className="space-y-6 pt-8 border-t border-slate-100">
                                <TouchableOpacity 
                                    onPress={handleLookup}
                                    className="w-full bg-indigo-600 text-white rounded-[32px] py-7 font-black text-base uppercase tracking-[0.25em] shadow-2xl shadow-indigo-200/50 flex-row items-center justify-center gap-4 transition-all hover:bg-indigo-700 active:scale-95 border-b-4 border-indigo-900 group"
                                >
                                    {loading ? (
                                        <View className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <MdMap size={28} className="text-white group-hover:scale-110 transition-transform" />
                                    )}
                                    <View className="items-center">
                                        <Text className="text-white text-lg">Verify Farm Plot</Text>
                                        <Text className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest mt-1">GIB Records Sync Required</Text>
                                    </View>
                                </TouchableOpacity>

                                <View className="bg-indigo-50/50 p-5 rounded-[24px] border border-indigo-100/50 flex-row items-start gap-4">
                                    <MdInfo size={20} className="text-indigo-400 mt-0.5" />
                                    <Text className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight">
                                        Verification will auto-fetch topographical boundaries and ownership history from the Mahabhunakasha GIB API.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {step === 2 && farmProfile && (
                        <View className="space-y-6 animate-in slide-in-from-right">
                            <View className="flex-row items-center justify-between">
                                <TouchableOpacity onPress={() => setStep(1)} className="p-2 bg-slate-100 rounded-full text-slate-600">
                                    <MdKeyboardArrowLeft size={24} />
                                </TouchableOpacity>
                                <Text className="text-xs font-black uppercase tracking-widest text-indigo-600">Verified Boundary</Text>
                            </View>

                            <FarmBoundaryMap polygon={farmProfile.polygon} height={240} />

                            <View className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100 space-y-2">
                                <Text className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Ownership Signature</Text>
                                <Text className="text-sm font-bold text-indigo-900 leading-relaxed italic">"{farmProfile.owner_names?.join(", ")}"</Text>
                                <View className="h-[1px] bg-indigo-200/50 my-2" />
                                <View className="flex-row items-center gap-2">
                                    <MdCheckCircle className="text-indigo-600" />
                                    <Text className="text-[11px] font-black text-indigo-900">Spatial data match Mahabhunakasha GIB record.</Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={submitClaim}
                                className="w-full bg-indigo-600 text-white rounded-3xl py-5 font-black text-sm uppercase tracking-widest shadow-xl flex-row items-center justify-center gap-3"
                            >
                                <MdSatellite size={20} />
                                <Text>Trigger Satellite Audit</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 3 && (
                        <View className="flex-1 items-center justify-center space-y-8 py-10">
                            <View className="relative">
                                <View className="w-32 h-32 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                                <View className="absolute inset-0 items-center justify-center">
                                    <Text className="text-2xl font-black text-indigo-600">{progress}%</Text>
                                </View>
                            </View>
                            <View className="text-center space-y-2">
                                <Text className="text-xl font-black text-slate-900 uppercase tracking-tighter">Analyzing Matrix</Text>
                                <Text className="text-sm font-bold text-slate-400 uppercase tracking-widest">Fetching Sentinel-2 Packets...</Text>
                            </View>
                            <View className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 w-full">
                                <Text className="text-[10px] font-black text-indigo-600 leading-relaxed">System is calculating NDVI indices from multispectral data before and after {form.damage_date}.</Text>
                            </View>
                        </View>
                    )}

                    {step === 4 && (
                        <View className="flex-1 items-center justify-center space-y-8 py-10 animate-in zoom-in">
                            <View className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full items-center justify-center shadow-lg">
                                <MdCheckCircle size={60} />
                            </View>
                            <View className="text-center space-y-2">
                                <Text className="text-2xl font-black text-slate-900 uppercase">Transmission Successful</Text>
                                <Text className="text-sm font-bold text-slate-400">Claim vector has been sealed and escalated to the audit board.</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => window.location.reload()}
                                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest"
                            >
                                Return to Dashboard
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Footer Info */}
                <View className="flex-row items-start gap-3 px-2">
                    <MdInfo className="text-indigo-400 mt-0.5" />
                    <Text className="text-[11px] font-bold text-slate-400 leading-relaxed">
                        This system uses the <Text className="text-indigo-600">CNN-Satellite Forensic Model</Text> to analyze crop health indices. False claims will be flagged automatically by the spatial integrity layer.
                    </Text>
                </View>

            </View>
        </ScrollView>
    );
};

export default CropClaimFiling;
