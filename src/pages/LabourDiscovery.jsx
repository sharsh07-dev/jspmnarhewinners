import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { ref, onValue, push, set as dbSet, runTransaction, update } from "firebase/database";
import { 
    MdLocationOn, MdCalendarToday, MdSearch, MdMyLocation,
    MdNavigateNext, MdNavigateBefore, MdFilterList, MdCheckCircle,
    MdStar, MdAccessTime, MdSend, MdAttachMoney, MdPerson, MdVerified, MdPeople
} from "react-icons/md";
import { format, addDays, isBefore } from "date-fns";
import { getUserLocation, getDistanceKm, reverseGeocode } from "../utils/geo";
import useAuthStore from "../store/useAuthStore";
import toast from "react-hot-toast";

const SKILLS = ["Harvesting", "Spraying", "Irrigation", "General Labour", "Tractor Driving", "Pruning"];

const LabourDiscovery = () => {
    const { user: currentUser } = useAuthStore();
    const [step, setStep] = useState(1);
    
    // Selection state
    const [location, setLocation] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedDate, setSelectedDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
    const [selectedSkill, setSelectedSkill] = useState("All");
    const [requiredSlots, setRequiredSlots] = useState(1);

    // Data state
    const [labourers, setLabourers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locLoading, setLocLoading] = useState(false);
    const [activeCampaign, setActiveCampaign] = useState(null);

    // Fetch labourers
    useEffect(() => {
        const usersRef = ref(db, "users");
        const unsub = onValue(usersRef, (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(u => u.role === "labour");
                setLabourers(list);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Listen to current campaign if established
    useEffect(() => {
        if (!currentUser) return;
        const skillId = selectedSkill === "All" ? "General" : selectedSkill;
        const campaignId = `${currentUser.uid}_${selectedDate}_${skillId}`;
        const campRef = ref(db, `labour_campaigns/${campaignId}`);
        
        const unsub = onValue(campRef, snap => {
            if (snap.exists()) setActiveCampaign(snap.val());
            else setActiveCampaign(null);
        });
        return () => unsub();
    }, [currentUser, selectedDate, selectedSkill]);

    // Autocomplete Effect
    useEffect(() => {
        // ... (unchanged autocomplete logic)
        if (searchQuery.length < 3) {
            setSuggestions([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&countrycodes=in&addressdetails=1&limit=5`);
                const data = await res.json();
                setSuggestions(data.map(item => ({
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    address: item.display_name
                })));
            } catch (e) { console.error(e); }
            finally { setIsSearching(false); }
        }, 600);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleAutoLocation = async () => {
        setLocLoading(true);
        try {
            const loc = await getUserLocation();
            const address = await reverseGeocode(loc.lat, loc.lng);
            setLocation({ ...loc, address });
            setStep(2);
        } catch (err) {
            toast.error(err.message || "GPS failed. Please search manually.");
        } finally {
            setLocLoading(false);
        }
    };

    const filteredLabourers = useMemo(() => {
        if (!location || step < 3) return [];
        let list = labourers;
        if (selectedSkill !== "All") list = list.filter(l => l.skills?.includes(selectedSkill));
        list = list.filter(l => {
            if (l.availability && l.availability[selectedDate] === false) return false;
            return true;
        });
        return list.map(l => {
            const dist = (l.lat && l.lng)
                ? getDistanceKm(location.lat, location.lng, l.lat, l.lng)
                : (l.village === location.address.split(",")[0] ? 2 : 15);
            return { ...l, _dist: dist };
        }).sort((a, b) => a._dist - b._dist);
    }, [labourers, location, selectedSkill, selectedDate, step]);

    // ── NEGOTIATION & SMART QUEUE LOGIC ────────────────────────────────

    const handleSendRequest = async (labourer) => {
        if (!currentUser) return toast.error("Log in to hire labour");
        
        const priceOffer = prompt(`Enter wage offer for ${labourer.name} (Daily base: ₹${labourer.dailyWage || 400})`, labourer.dailyWage || 400);
        if (!priceOffer) return;

        const skillId = selectedSkill === "All" ? "General" : selectedSkill;
        const campaignId = `${currentUser.uid}_${selectedDate}_${skillId}`;

        try {
            // First time requesting for this campaign? Initialize the queue structure.
            await runTransaction(ref(db, `labour_campaigns/${campaignId}`), (campaign) => {
                if (!campaign) {
                    return {
                        farmerId: currentUser.uid || "unknown",
                        date: selectedDate || "",
                        skill: skillId || "General",
                        requiredSlots: Number(requiredSlots) || 1,
                        confirmedCount: 0,
                        createdAt: new Date().toISOString()
                    };
                } else {
                    // Update requiredSlots seamlessly if they sent another req but bumped slots
                    campaign.requiredSlots = Number(requiredSlots) || 1;
                    return campaign;
                }
            });

            const reqRef = push(ref(db, "labour_requests"));
            await dbSet(reqRef, {
                campaignId: campaignId || "unknown",
                farmerId: currentUser.uid || "unknown",
                farmerName: currentUser.name || currentUser.email || "Farmer",
                labourerId: labourer.id || "unknown",
                labourerName: labourer.name || "Labourer",
                date: selectedDate || "",
                skill: skillId || "General",
                offeredPrice: Number(priceOffer) || 400,
                status: "sent",
                createdAt: new Date().toISOString()
            });
            toast.success("Hiring request sent & added to Smart Queue!");
        } catch (err) {
            console.error("FATAL ERROR IN SEND REQUEST:", err);
            toast.error("Request failed: " + (err.message || "Unknown Error"));
        }
    };

    // ── RENDERERS ────────────────────────────────────────

    const renderStep1 = () => (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-8 py-10">
            <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-sm">
                    <MdPerson />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Hire Smart Labour</h2>
                <p className="text-gray-500 font-medium">Find verified local help for your farm tasks.</p>
            </div>

            <div className="space-y-4">
                <button onClick={handleAutoLocation} disabled={locLoading} className="w-full p-6 bg-white border-2 border-yellow-100 rounded-[24px] flex items-center gap-4 hover:border-yellow-500 hover:shadow-lg transition-all group">
                    <div className="w-12 h-12 bg-yellow-500 text-white rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        {locLoading ? <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" /> : <MdMyLocation />}
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-gray-900">Current Location</p>
                        <p className="text-sm text-gray-500">Find labour in your immediate area</p>
                    </div>
                    <MdNavigateNext className="ml-auto text-2xl text-gray-300" />
                </button>

                <div className="relative">
                    <MdSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 text-2xl" />
                    <input 
                        type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search village or town..."
                        className="w-full pl-16 pr-6 py-6 bg-gray-50 border-2 border-transparent focus:border-yellow-500 focus:bg-white rounded-[24px] outline-none transition-all font-bold text-gray-800 shadow-inner"
                    />
                    <AnimatePresence>
                        {suggestions.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[24px] shadow-2xl border border-gray-100 overflow-hidden z-50 p-2">
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => { setLocation(s); setStep(2); setSuggestions([]); }} className="w-full text-left p-4 hover:bg-yellow-50 rounded-2xl flex items-start gap-3 transition-colors group">
                                        <div className="w-8 h-8 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center"><MdLocationOn /></div>
                                        <div><p className="font-bold text-gray-900">{s.address.split(",")[0]}</p><p className="text-xs text-gray-400 line-clamp-1">{s.address}</p></div>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );

    const renderStep2 = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto space-y-8 py-10">
            <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-sm">
                    <MdCalendarToday />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">When & What?</h2>
                <p className="text-gray-500 font-medium">Select work date and required skill.</p>
            </div>

            <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">Specialization Needed</label>
                    <div className="grid grid-cols-2 gap-2">
                        {["All", ...SKILLS].map(s => (
                            <button key={s} onClick={() => setSelectedSkill(s)} className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${selectedSkill === s ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-50 hover:border-gray-200"}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">Project Date</label>
                    <input 
                        type="date" min={format(new Date(), "yyyy-MM-dd")} value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                        <span>Workers Required (Slots)</span>
                        <span className="text-black bg-yellow-100 px-2 py-0.5 rounded-lg text-[10px]">Max 50</span>
                    </label>
                    <div className="flex gap-4 items-center">
                        <button onClick={() => setRequiredSlots(prev => Math.max(1, prev - 1))} className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center font-bold text-xl hover:bg-gray-200 transition-colors">-</button>
                        <input 
                            type="number" min="1" max="50" value={requiredSlots}
                            onChange={(e) => setRequiredSlots(Math.max(1, parseInt(e.target.value) || 1))}
                            className="flex-1 p-3 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-black text-center text-xl"
                        />
                        <button onClick={() => setRequiredSlots(prev => prev + 1)} className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center font-bold text-xl hover:bg-gray-200 transition-colors">+</button>
                    </div>
                </div>

                <div className="flex gap-4 pt-4">
                    <button onClick={() => setStep(1)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl">Back</button>
                    <button onClick={() => setStep(3)} className="flex-[2] py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-xl">Find Local Help</button>
                </div>
            </div>
        </motion.div>
    );

    const renderStep3 = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 py-6 pb-20">
            {/* Smart Queue Banner */}
            {activeCampaign && (
                <div className="bg-yellow-500 text-white rounded-[24px] p-5 shadow-lg shadow-yellow-100 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="font-black text-lg flex items-center gap-2"><MdPeople /> Hiring Campaign Active!</h3>
                        <p className="text-xs font-bold text-yellow-100 mt-1 uppercase tracking-widest">
                            {selectedSkill === "All" ? "General Work" : selectedSkill} • {format(new Date(selectedDate), "MMM dd")}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-bold text-yellow-100 mb-1">FILLED SLOTS</div>
                        <div className="text-2xl font-black">{activeCampaign.confirmedCount || 0} <span className="text-yellow-200 text-lg">/ {activeCampaign.requiredSlots}</span></div>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-yellow-50 text-yellow-700 rounded-2xl border border-yellow-100 flex items-center gap-2">
                        <MdLocationOn /> <span className="text-xs font-bold truncate max-w-[100px]">{location?.address?.split(",")[0] || "Area"}</span>
                    </div>
                    <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 flex items-center gap-2 text-xs font-bold">
                        <MdCalendarToday /> {format(new Date(selectedDate), "MMM dd")} • {selectedSkill}
                    </div>
                    <button onClick={() => setStep(2)} className="p-2 text-gray-400 hover:text-yellow-600"><MdFilterList className="text-xl" /></button>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Available Help <span className="text-yellow-600 text-sm ml-1">({filteredLabourers.length})</span></h2>
            </div>

            {filteredLabourers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                    <div className="text-6xl mb-4">👷</div>
                    <h3 className="text-2xl font-bold text-gray-800">No labourers found</h3>
                    <p className="text-gray-400 mt-2">Try a different date or expand your search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLabourers.map((l, idx) => (
                        <motion.div key={l.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all group flex flex-col">
                            <div className="p-6 space-y-4 flex-grow">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-2xl overflow-hidden relative">
                                        {l.photoUrl ? <img src={l.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-300 bg-gray-50">{l.name?.[0]}</div>}
                                        {l.verified && <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-1"><MdVerified className="text-xs" /></div>}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-lg">{l.name}</h4>
                                        <div className="flex items-center gap-1 text-amber-500 text-sm font-bold"><MdStar /> {l.rating || "5.0"}</div>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <p className="text-lg font-black text-green-600">₹{l.dailyWage || 400}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Per Day</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {(l.skills || ["General Labour"]).map(s => (
                                        <span key={s} className="px-3 py-1 bg-gray-50 text-gray-500 border border-gray-100 rounded-full text-[10px] font-bold">{s}</span>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between text-xs font-bold text-gray-400 border-t border-gray-50 pt-4">
                                    <span className="flex items-center gap-1"><MdAccessTime /> {l.experience || "2"}Yrs Exp</span>
                                    <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"><MdLocationOn /> {l._dist?.toFixed(1) || "1.5"}km away</span>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-100">
                                <button onClick={() => handleSendRequest(l)} className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-2xl shadow-lg shadow-yellow-100 flex items-center justify-center gap-2">
                                    <MdSend /> Send Hiring Request
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </motion.div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
                <AnimatePresence mode="wait">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default LabourDiscovery;
