import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { ref, onValue, set, push, update } from "firebase/database";
import useAuthStore from "../store/useAuthStore";
import toast from "react-hot-toast";
import { 
    MdSearch, MdFilterList, MdAccountBalance, MdOpenInNew, 
    MdBookmark, MdBookmarkBorder, MdVolumeUp, MdInfoOutline,
    MdCalendarToday, MdCheckCircleOutline, MdClose, MdRefresh
} from "react-icons/md";
import { format } from "date-fns";

// Mock Schemes Data
const INITIAL_SCHEMES = [
    {
        id: "scheme-1",
        title: "PM-Kisan Samman Nidhi",
        summary: "Providing ₹6,000 per year income support to all landholding farmer families.",
        benefits: "₹2,000 every 4 months directly into bank account.",
        eligibility: "All small and marginal farmers owning cultivable land.",
        documents: ["Aadhaar Card", "Land Records", "Bank Account Details"],
        category: "Income Support",
        deadline: "2026-12-31",
        isNew: true,
        source: "Central Govt",
        link: "https://pmkisan.gov.in/"
    },
    {
        id: "scheme-2",
        title: "PM Fasal Bima Yojana (Crop Insurance)",
        summary: "Financial support to farmers suffering crop loss/damage arising out of unforeseen events.",
        benefits: "Low premium rates; coverage for yield losses, post-harvest losses, etc.",
        eligibility: "All farmers including sharecroppers and tenant farmers.",
        documents: ["Land Possession Document", "Bank Passbook", "Sowing Certificate"],
        category: "Insurance",
        deadline: "2026-07-15",
        isNew: false,
        endingSoon: true,
        source: "Central Govt",
        link: "https://pmfby.gov.in/"
    },
    {
        id: "scheme-3",
        title: "Maharashtra Magel Tyala Shet Tale",
        summary: "Subsidies for individual farm ponds to ensure water availability for irrigation.",
        benefits: "Up to ₹50,000 subsidy for construction of farm ponds.",
        eligibility: "Farmers having at least 0.60 hectare land in Maharashtra.",
        documents: ["7/12 Extract", "Caste Certificate (if applicable)", "Bank Account"],
        category: "Subsidy",
        deadline: "2026-05-20",
        isNew: true,
        source: "State Govt",
        link: "https://mahadbtmahait.gov.in/"
    },
    {
        id: "scheme-4",
        title: "Sub-Mission on Agricultural Mechanization (SMAM)",
        summary: "Promoting farm mechanization for inclusive growth by providing subsidies for equipment.",
        benefits: "40% to 50% subsidy on tractors, sprayers, and rotavators.",
        eligibility: "Individual farmers, SHGs, and Farmer Producer Organizations.",
        documents: ["Identity Proof", "Address Proof", "Quotation for Machine"],
        category: "Loan / Subsidy",
        deadline: "2026-11-30",
        isNew: false,
        source: "Central Govt",
        link: "https://agrimachinery.nic.in/"
    }
];

const SchemeCard = ({ scheme, isBookmarked, onToggleBookmark, onOpenDetail }) => {
    return (
        <motion.div 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group bg-white rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:border-green-200 transition-all duration-500 overflow-hidden flex flex-col"
        >
            <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2">
                        {scheme.isNew && <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-black rounded-full shadow-sm">NEW</span>}
                        {scheme.endingSoon && <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm">ENDING SOON</span>}
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleBookmark(scheme.id); }}
                        className={`p-2 rounded-full transition-all ${isBookmarked ? "bg-amber-100 text-amber-600 shadow-inner" : "bg-gray-50 text-gray-300 hover:text-amber-500"}`}
                    >
                        {isBookmarked ? <MdBookmark className="text-xl" /> : <MdBookmarkBorder className="text-xl" />}
                    </button>
                </div>
                
                <h3 className="text-lg font-black text-gray-900 leading-tight mb-2 group-hover:text-green-700 transition-colors uppercase tracking-tight">{scheme.title}</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3">{scheme.source} • {scheme.category}</p>
                <p className="text-sm text-gray-500 font-medium leading-relaxed mb-4 line-clamp-2">{scheme.summary}</p>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Benefit</p>
                        <p className="text-[11px] font-bold text-gray-800 line-clamp-1">{scheme.benefits}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Deadline</p>
                        <p className="text-[11px] font-bold text-red-600 italic">{format(new Date(scheme.deadline), "MMM dd, yyyy")}</p>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
                <button 
                    onClick={() => onOpenDetail(scheme)}
                    className="flex-1 py-3 bg-white text-gray-900 text-xs font-black uppercase tracking-widest rounded-2xl border border-gray-200 hover:bg-gray-100 transition shadow-sm"
                >
                    Learn More
                </button>
                <a 
                    href={scheme.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex-1 py-3 bg-green-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-green-700 transition shadow-lg shadow-green-100 flex items-center justify-center gap-1.5"
                >
                    Apply Now <MdOpenInNew className="text-sm" />
                </a>
            </div>
        </motion.div>
    );
};

const SchemeDiscovery = () => {
    const { authUser, user } = useAuthStore();
    const [schemes, setSchemes] = useState(INITIAL_SCHEMES);
    const [bookmarks, setBookmarks] = useState([]);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("All");
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());
    const [speaking, setSpeaking] = useState(false);

    useEffect(() => {
        if (!authUser) return;
        const bRef = ref(db, `users/${authUser.uid}/bookmarkedSchemes`);
        const unsub = onValue(bRef, (snap) => {
            setBookmarks(snap.val() || []);
        });
        return () => unsub();
    }, [authUser]);

    const toggleBookmark = async (id) => {
        const newBookmarks = bookmarks.includes(id) 
            ? bookmarks.filter(b => b !== id) 
            : [...bookmarks, id];
        await set(ref(db, `users/${authUser.uid}/bookmarkedSchemes`), newBookmarks);
        toast.success(bookmarks.includes(id) ? "Removed from bookmarks" : "Bookmarked! ⭐");
    };

    const handleSpeak = (text) => {
        if (speaking) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(utterance);
    };

    const filteredSchemes = schemes.filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase()) || s.summary.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === "All" || s.category.includes(filter) || s.source === filter;
        return matchesSearch && matchesFilter;
    });

    const refreshSchemes = () => {
        setLastUpdated(new Date().toISOString());
        toast.success("Checking government portals for new updates...");
    };

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 lg:p-12">
            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                            <MdAccountBalance className="text-2xl" />
                            <span className="text-xs font-black uppercase tracking-[0.3em]">Official Directory</span>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tighter uppercase">Government Schemes</h1>
                        <p className="text-gray-500 font-bold text-sm lg:text-lg">Discover and access the latest support for your farm, updated daily.</p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 flex items-center gap-2 shadow-sm">
                            <MdRefresh className={`text-green-600 ${speaking ? "animate-spin" : ""}`} />
                            <p className="text-[10px] font-black text-gray-400 uppercase">Last Sync: {format(new Date(lastUpdated), "HH:mm")} Today</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={refreshSchemes} className="btn-primary text-xs flex items-center gap-2">
                                Check for Updates 📡
                            </button>
                        </div>
                    </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-2 relative">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                        <input 
                            type="text" 
                            placeholder="Find schemes for your farm (e.g. Loan, Fasal Bima)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white border-2 border-transparent focus:border-green-500 rounded-3xl shadow-sm outline-none transition-all font-bold placeholder:text-gray-300"
                        />
                    </div>
                    <div className="lg:col-span-2 flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                        {["All", "Income Support", "Insurance", "Subsidy", "Central Govt", "State Govt"].map(f => (
                            <button 
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-6 py-4 rounded-3xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${filter === f ? "bg-green-600 text-white shadow-lg shadow-green-100" : "bg-white text-gray-500 border-2 border-transparent hover:border-gray-100 shadow-sm"}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Discover Grid */}
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Recommended for You 🤖</h2>
                        <div className="w-24 h-1 bg-green-200 rounded-full" />
                    </div>
                    
                    {filteredSchemes.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-[40px] border border-gray-100 shadow-inner">
                            <MdInfoOutline className="text-6xl text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-400 font-black uppercase tracking-widest">No matching schemes found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredSchemes.map(s => (
                                <SchemeCard 
                                    key={s.id} 
                                    scheme={s} 
                                    isBookmarked={bookmarks.includes(s.id)}
                                    onToggleBookmark={toggleBookmark}
                                    onOpenDetail={setSelectedScheme}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Informational Banner */}
                <div className="bg-gradient-to-br from-green-900 to-emerald-950 rounded-[40px] p-8 lg:p-12 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-green-400/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl">🗣️</div>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Need help understanding?</h3>
                            <p className="text-green-100/70 font-bold max-w-lg">Click the speaker icon on any scheme to hear the summary in simple language. Our AI assistant can also walk you through the documents required.</p>
                        </div>
                        <button className="px-8 py-4 bg-white text-green-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform">Get Voice Guide</button>
                    </div>
                </div>
            </div>

            {/* Scheme Detail Modal */}
            <AnimatePresence>
                {selectedScheme && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setSelectedScheme(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 50 }}
                            className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-8 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 bg-green-600 text-white text-[10px] font-black rounded-full shadow-md uppercase">{selectedScheme.category}</span>
                                        <span className="px-3 py-1 bg-white text-gray-500 text-[10px] font-black rounded-full shadow-sm border border-gray-100 uppercase">{selectedScheme.source}</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none pt-2">{selectedScheme.title}</h2>
                                </div>
                                <button onClick={() => setSelectedScheme(null)} className="p-3 bg-white hover:bg-gray-100 rounded-full shadow-sm transition">
                                    <MdClose className="text-2xl text-gray-400" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Description & Benefits</h4>
                                        <button 
                                            onClick={() => handleSpeak(`${selectedScheme.title}. ${selectedScheme.summary}. The main benefit is ${selectedScheme.benefits}.`)}
                                            className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition ${speaking ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}
                                        >
                                            <MdVolumeUp /> {speaking ? "Stop Explanation" : "Listen in Simple Language"}
                                        </button>
                                    </div>
                                    <p className="text-gray-600 font-medium leading-relaxed">{selectedScheme.summary}</p>
                                    <div className="p-6 bg-green-50/50 rounded-3xl border border-green-100 flex items-start gap-4">
                                        <div className="w-10 h-10 bg-green-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">💰</div>
                                        <div>
                                            <p className="text-xs font-black text-green-800 uppercase tracking-widest mb-1">Benefit Details</p>
                                            <p className="text-green-700 font-bold">{selectedScheme.benefits}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <MdCheckCircleOutline className="text-green-500" /> Eligibility Criteria
                                        </h4>
                                        <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 italic">
                                            <p className="text-sm text-gray-700 font-medium leading-relaxed">{selectedScheme.eligibility}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <MdInfoOutline className="text-blue-500" /> Required Documents
                                        </h4>
                                        <ul className="space-y-2">
                                            {selectedScheme.documents.map((doc, i) => (
                                                <li key={i} className="flex items-center gap-3 text-sm font-bold text-gray-600">
                                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" /> {doc}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="p-6 bg-red-50 rounded-3xl border border-red-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <MdCalendarToday className="text-red-600 text-xl" />
                                        <div>
                                            <p className="text-[10px] font-black text-red-800 uppercase">Application Deadline</p>
                                            <p className="text-red-700 font-black">{format(new Date(selectedScheme.deadline), "MMMM dd, yyyy")}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black text-red-500 bg-white px-2 py-1 rounded-full shadow-sm">DON'T MISS OUT</span>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-8 border-t border-gray-100 flex flex-col sm:flex-row gap-4">
                                <button 
                                    onClick={() => toggleBookmark(selectedScheme.id)}
                                    className={`flex-1 py-4 text-sm font-black uppercase tracking-widest rounded-2xl border-2 transition flex items-center justify-center gap-2 ${bookmarks.includes(selectedScheme.id) ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-white text-gray-400 border-gray-100 hover:text-amber-500 hover:border-amber-100"}`}
                                >
                                    {bookmarks.includes(selectedScheme.id) ? <><MdBookmark /> Saved to Reminders</> : <><MdBookmarkBorder /> Save for Later</>}
                                </button>
                                <a 
                                    href={selectedScheme.link}
                                    target="_blank" rel="noreferrer"
                                    className="flex-[2] py-4 bg-gray-900 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-black transition flex items-center justify-center gap-2 shadow-xl shadow-gray-200"
                                >
                                    Proceed to Official Application <MdOpenInNew />
                                </a>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SchemeDiscovery;
