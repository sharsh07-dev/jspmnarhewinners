import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import { 
    MdLocationOn, MdCalendarToday, MdSearch, MdMyLocation,
    MdNavigateNext, MdNavigateBefore, MdFilterList, MdCheckCircle,
    MdStar, MdAccessTime, MdShoppingCart, MdArrowForward, MdTune
} from "react-icons/md";
import { format, addDays, isBefore, startOfToday, isAfter, parseISO } from "date-fns";
import { getUserLocation, getDistanceKm, reverseGeocode, slotsOverlap } from "../utils/geo";
import EquipmentCard from "../components/EquipmentCard";
import toast from "react-hot-toast";

const DiscoveryWizard = () => {
    const [step, setStep] = useState(1);
    
    // Selection state
    const [location, setLocation] = useState(null); // { lat, lng, address }
    const [dates, setDates] = useState({
        start: format(addDays(new Date(), 1), "yyyy-MM-dd"),
        end: format(addDays(new Date(), 1), "yyyy-MM-dd"),
        startTime: "08:00",
        endTime: "18:00"
    });
    
    // Autocomplete state
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // Data state
    const [equipment, setEquipment] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locLoading, setLocLoading] = useState(false);

    useEffect(() => {
        // Fetch equipment and bookings for availability cross-ref
        const eqUnsub = onValue(ref(db, "equipment"), (snap) => {
            if (snap.exists()) {
                setEquipment(Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })));
            }
            setLoading(false);
        });
        const bookUnsub = onValue(ref(db, "bookings"), (snap) => {
            if (snap.exists()) {
                setBookings(Object.values(snap.val()));
            }
        });
        return () => { eqUnsub(); bookUnsub(); };
    }, []);

    // ── Location Autocomplete Effect ─────────────────
    useEffect(() => {
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
            } catch (e) { console.error("Search failed", e); }
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
            toast.success(`Located: ${address.split(",")[0]}`);
            setStep(2); // Auto-advance to calendar
        } catch (err) {
            toast.error("Could not detect location. Please search manually.");
        } finally {
            setLocLoading(false);
        }
    };

    const filteredEquipment = useMemo(() => {
        if (!location || step < 3) return [];
        
        let list = equipment.filter(e => e.status === "approved");

        // 1. Availability Filter (Step 2 dates + times)
        let reqStart, reqEnd;
        try {
            reqStart = new Date(`${dates.start}T${dates.startTime}:00`).toISOString();
            reqEnd = new Date(`${dates.end}T${dates.endTime}:00`).toISOString();
        } catch (e) {
            console.error("Invalid search dates", e);
            return []; // Return empty if dates are mangled
        }
        
        list = list.filter(eq => {
            // Check for overlaps in bookings
            const eqBookings = bookings.filter(b => b.equipmentId === eq.id && b.status !== "cancelled");
            const hasOverlap = eqBookings.some(b => {
                try {
                    if (!b.startTime || !b.endTime) return false;
                    return slotsOverlap(
                        { startTime: reqStart, endTime: reqEnd },
                        { startTime: b.startTime, endTime: b.endTime }
                    );
                } catch (err) {
                    return false; // Skip corrupted bookings
                }
            });
            return !hasOverlap;
        });

        // 2. Proximity Calculation & Sort
        list = list.map(eq => {
            const dist = (eq.location?.lat && eq.location?.lng)
                ? getDistanceKm(location.lat, location.lng, eq.location.lat, eq.location.lng)
                : 999;
            return { ...eq, _dist: dist };
        });

        // Sort by distance (Nearest First)
        return list.sort((a, b) => a._dist - b._dist);
    }, [equipment, bookings, location, dates, step]);

    // ── STEP RENDERERS ───────────────────────────────────────────────────

    const renderStep1 = () => (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="max-w-xl mx-auto space-y-8 py-10"
        >
            <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-sm">
                    <MdLocationOn />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Search Nearby</h2>
                <p className="text-gray-500 font-medium">Find equipment within delivery radius of your village.</p>
            </div>

            <div className="space-y-4">
                <button 
                    onClick={handleAutoLocation}
                    disabled={locLoading}
                    className="w-full p-6 bg-white border-2 border-green-100 rounded-[24px] flex items-center gap-4 hover:border-green-500 hover:shadow-lg transition-all group"
                >
                    <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        {locLoading ? <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" /> : <MdMyLocation />}
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-gray-900">Current Location</p>
                        <p className="text-sm text-gray-500">Auto-detect your village via GPS</p>
                    </div>
                    <MdNavigateNext className="ml-auto text-2xl text-gray-300" />
                </button>

                <div className="relative">
                    <MdSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 text-2xl" />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search village, town, or district..."
                        className="w-full pl-16 pr-6 py-6 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-[24px] outline-none transition-all font-bold text-gray-800 shadow-inner"
                    />
                    
                    {/* Suggestions Dropdown */}
                    <AnimatePresence>
                        {suggestions.length > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[24px] shadow-2xl border border-gray-100 overflow-hidden z-50 p-2"
                            >
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setLocation(s);
                                            setSearchQuery(s.address.split(",")[0]);
                                            setSuggestions([]);
                                            setStep(2);
                                        }}
                                        className="w-full text-left p-4 hover:bg-green-50 rounded-2xl flex items-start gap-3 transition-colors group"
                                    >
                                        <div className="mt-1 w-8 h-8 bg-gray-100 text-gray-400 group-hover:bg-green-100 group-hover:text-green-600 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                                            <MdLocationOn />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 leading-none mb-1 group-hover:text-green-700">{s.address.split(",")[0]}</p>
                                            <p className="text-xs text-gray-400 line-clamp-1">{s.address}</p>
                                        </div>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                        {isSearching && (
                            <div className="absolute top-1/2 right-6 -translate-y-1/2">
                                <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full" />
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Suggested Villages</p>
                    <div className="flex flex-wrap gap-2">
                        {["Baramati", "Shirur", "Narhe", "Manchar"].map(v => (
                            <button 
                                key={v}
                                onClick={() => { setLocation({ lat: 18.2329, lng: 74.5768, address: v }); setStep(2); }}
                                className="px-5 py-2.5 bg-white border border-gray-100 rounded-full text-sm font-bold text-gray-600 hover:border-green-500 hover:text-green-600 transition-all shadow-sm"
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );

    const renderStep2 = () => (
        <motion.div 
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="max-w-xl mx-auto space-y-8 py-10"
        >
            <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-sm">
                    <MdCalendarToday />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Select Dates</h2>
                <p className="text-gray-500 font-medium">When do you need the equipment?</p>
            </div>

            <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Start Date & Time</label>
                        <div className="space-y-2">
                            <input 
                                type="date" 
                                min={format(new Date(), "yyyy-MM-dd")}
                                value={dates.start}
                                onChange={(e) => setDates(d => ({ ...d, start: e.target.value }))}
                                className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                            />
                            <input 
                                type="time" 
                                value={dates.startTime}
                                onChange={(e) => setDates(d => ({ ...d, startTime: e.target.value }))}
                                className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">End Date & Time</label>
                        <div className="space-y-2">
                            <input 
                                type="date" 
                                min={dates.start}
                                value={dates.end}
                                onChange={(e) => setDates(d => ({ ...d, end: e.target.value }))}
                                className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                            />
                            <input 
                                type="time" 
                                value={dates.endTime}
                                onChange={(e) => setDates(d => ({ ...d, endTime: e.target.value }))}
                                className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center text-xl">
                        <MdAccessTime />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-blue-900">Delivery Window</p>
                        <p className="text-xs text-blue-700">Estimated delivery: {(() => { try { return format(new Date(dates.start), "MMM dd"); } catch(e) { return "Tomorrow"; } })()} Morning</p>
                    </div>
                </div>

                <div className="flex gap-4 pt-2">
                    <button 
                        onClick={() => setStep(1)}
                        className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-[20px] hover:bg-gray-200"
                    >
                        Back
                    </button>
                    <button 
                        onClick={() => setStep(3)}
                        className="flex-[2] py-4 bg-gray-900 text-white font-bold rounded-[20px] hover:bg-black shadow-lg"
                    >
                        Find Best Matches
                    </button>
                </div>
            </div>
        </motion.div>
    );

    const renderStep3 = () => (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="space-y-8 py-6"
        >
            {/* Narrow Results Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-green-50 text-green-700 rounded-2xl border border-green-100 flex items-center gap-2">
                        <MdLocationOn /> 
                        <span className="text-xs font-bold truncate max-w-[120px]">
                            {location?.address ? location.address.split(",")[0] : "Nearby"}
                        </span>
                    </div>
                    <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 flex items-center gap-2">
                        <MdCalendarToday /> 
                        <span className="text-[10px] font-bold">
                            {(() => {
                                try {
                                    return `${format(new Date(dates.start), "MMM dd")}, ${dates.startTime} - ${format(new Date(dates.end), "MMM dd")}, ${dates.endTime}`;
                                } catch (e) {
                                    return "Select Dates";
                                }
                            })()}
                        </span>
                    </div>
                    <button onClick={() => setStep(1)} className="p-2 text-gray-400 hover:text-green-600">
                        <MdTune className="text-xl" />
                    </button>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Best Matches <span className="text-green-600 text-sm ml-1 font-semibold">({filteredEquipment.length})</span></h2>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-80 bg-gray-100 animate-pulse rounded-[32px]" />)}
                </div>
            ) : filteredEquipment.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                    <div className="text-6xl mb-4">🚜</div>
                    <h3 className="text-2xl font-bold text-gray-800">No equipment found for these dates</h3>
                    <p className="text-gray-400 max-w-sm mx-auto mt-2">Try changing your location or selecting different dates.</p>
                    <button onClick={() => setStep(2)} className="mt-6 px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold">Change Dates</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    {filteredEquipment.map((eq, i) => (
                        <div key={eq.id} className="relative group">
                            {i === 0 && (
                                <div className="absolute -top-3 left-6 z-10 px-4 py-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-lg flex items-center gap-1 uppercase tracking-widest animate-bounce">
                                    <MdStar /> Best Match
                                </div>
                            )}
                            <EquipmentCard 
                                equipment={{
                                    ...eq,
                                    _distKm: eq._dist
                                }} 
                                index={i} 
                                state={{ dates }}
                            />
                            <div className="absolute top-[52px] right-3 z-10 transition-transform group-hover:scale-105">
                                <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full border border-white/20 shadow-lg flex items-center gap-1">
                                    <MdCheckCircle size={10} /> Available
                                </span>
                            </div>
                        </div>
                    ))}
                    
                    {/* Urgency Trigger */}
                    {filteredEquipment.length <= 3 && filteredEquipment.length > 0 && (
                        <div className="md:col-span-2 lg:col-span-3 p-6 bg-red-50 border border-red-100 rounded-[32px] flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center text-2xl">🔥</div>
                                <div>
                                    <p className="font-bold text-red-900">Only {filteredEquipment.length} left in your area!</p>
                                    <p className="text-sm text-red-700">Demand is high for {(() => { try { return format(new Date(dates.start), "MMMM"); } catch(e) { return "this month"; } })()}. Book soon.</p>
                                </div>
                            </div>
                            <MdArrowForward className="text-2xl text-red-300" />
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );

    return (
        <div className="min-h-screen bg-gray-50 relative">
            {/* Step Progress Bar */}
            <div className="fixed top-[68px] left-0 right-0 h-1 bg-gray-100 z-40">
                <motion.div 
                    initial={{ width: "33%" }}
                    animate={{ width: `${(step / 3) * 100}%` }}
                    className="h-full bg-green-500"
                />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
                <AnimatePresence mode="wait">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </AnimatePresence>
            </div>

            {/* Floating Navigation (Mobile Only) */}
            <div className="md:hidden fixed bottom-6 left-6 right-6 z-50">
                {step < 3 && (
                    <div className="flex gap-3">
                        {step > 1 && (
                            <button onClick={() => setStep(step - 1)} className="w-16 h-16 bg-white border border-gray-100 rounded-3xl flex items-center justify-center shadow-lg"><MdNavigateBefore className="text-2xl"/></button>
                        )}
                        <button 
                            disabled={step === 1 && !location}
                            onClick={() => setStep(step + 1)}
                            className={`flex-1 h-16 rounded-3xl font-bold text-white flex items-center justify-center gap-2 shadow-xl ${step === 1 && !location ? "bg-gray-300" : "bg-green-600"}`}
                        >
                            Continue <MdArrowForward />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiscoveryWizard;
