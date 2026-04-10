import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import useAuthStore from "../store/useAuthStore";
import toast from "react-hot-toast";
import { 
    MdSearch, MdFilterList, MdAccountBalance, MdOpenInNew, 
    MdBookmark, MdBookmarkBorder, MdVolumeUp, MdInfoOutline,
    MdCalendarToday, MdCheckCircleOutline, MdClose, MdRefresh,
    MdHistoryEdu, MdSettingsVoice
} from "react-icons/md";
import { format, differenceInHours } from "date-fns";
import { getSchemes, refreshSchemes, toggleBookmark, getMetadata } from "../services/schemeService";

// Move INITIAL_SCHEMES to a separate constant for seeding if needed
const INITIAL_SCHEMES = [
    {
        id: "scheme-1",
        title: "PM-Kisan Samman Nidhi",
        summary: "Providing ₹6,000 per year income support to all landholding farmer families.",
        benefits: "₹2,000 every 4 months directly into bank account.",
        eligibility: "All small and marginal farmers owning cultivable land.",
        documents: ["Aadhaar Card", "7/12 Extract (Land Records)", "Bank Passbook", "Aadhaar-linked Mobile Number", "Passport Size Photograph"],
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
        documents: ["Aadhaar Card / Voter ID", "Record of Rights (RoR)", "Land Possession Certificate", "Sowing Certificate", "Bank Passbook", "KCC Account Details"],
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
        documents: ["Aadhaar Card", "7/12 Extract", "8A Extract", "Bank Passbook copy", "Caste Certificate (if applicable)", "Self-Declaration Form"],
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
        documents: ["Aadhaar Card", "Identity Proof (Voter/PAN)", "Land Record of Rights (RoR)", "Bank Passbook copy", "Quotation for Machinery", "Caste Certificate"],
        category: "Loan / Subsidy",
        deadline: "2026-11-30",
        isNew: false,
        source: "Central Govt",
        link: "https://agrimachinery.nic.in/"
    },
    {
        id: "scheme-5",
        title: "Kisan Credit Card (KCC)",
        summary: "Providing timely and adequate credit support to farmers for their cultivation and other needs.",
        benefits: "Loans at low interest rates (4%); coverage for cultivation expenses and post-harvest requirements.",
        eligibility: "All farmers, individuals/joint cultivators, tenant farmers, and sharecroppers.",
        documents: ["Signed Application Form", "Aadhaar / Voter ID", "Address Proof", "7/12 and 8A Extracts", "Cropping Pattern Details", "Passport Size Photos"],
        category: "Credit / Loan",
        deadline: "2026-03-31",
        isNew: true,
        source: "Central Govt",
        link: "https://www.myscheme.gov.in/schemes/kcc"
    },
    {
        id: "scheme-6",
        title: "Soil Health Card Scheme",
        summary: "Issued to farmers to help them understand the nutrient status of their soil and provide recommendations.",
        benefits: "Informed choice of fertilizers/manures; improved soil health and productivity.",
        eligibility: "All farmers in India.",
        documents: ["Aadhaar Card", "Land Holding Details", "Land Tax Receipt", "Soil Sample Collection Note"],
        category: "Technical Support",
        deadline: "2026-10-15",
        isNew: false,
        source: "Central Govt",
        link: "https://www.soilhealth.dac.gov.in/"
    },
    {
        id: "scheme-7",
        title: "Pramparagat Krishi Vikas Yojana (PKVY)",
        summary: "Promoting organic farming through a cluster-based approach and PGS certification.",
        benefits: "Financial assistance of ₹50,000 per hectare for 3 years; support for bio-fertilizers and organic inputs.",
        eligibility: "Farmers willing to form clusters of 50 or more in 50-acre land area.",
        documents: ["Cluster Registration Certificate", "Aadhaar Card", "Land Possession Proof", "PGS Certification details", "Bank Details"],
        category: "Organic Farming",
        deadline: "2026-08-30",
        isNew: false,
        source: "Central Govt",
        link: "https://pgsindia-ncof.gov.in/"
    },
    {
        id: "scheme-8",
        title: "PM-KUSUM (Solar Pump Subsidy)",
        summary: "Encouraging farmers to install solar pumps and grid-connected solar power plants.",
        benefits: "60% subsidy for standalone solar pumps; option to sell surplus power to grid.",
        eligibility: "Individual farmers, groups of farmers, Water User Associations, and FPOs.",
        documents: ["Aadhaar Card", "7/12 Extract", "Bank Passbook", "Swayam Ghoshana Patra", "Passport Size Photo", "Latest Electricity Bill"],
        category: "Energy",
        deadline: "2026-09-30",
        isNew: true,
        source: "Central Govt",
        link: "https://mnre.gov.in/solar/pm-kusum"
    },
    {
        id: "scheme-9",
        title: "National Agriculture Market (e-NAM)",
        summary: "A pan-India electronic trading portal which networks the existing APMC mandis.",
        benefits: "Better price discovery; transparency in auctioning; direct access to more buyers.",
        eligibility: "Farmers, Traders, and Agents registered with e-NAM mandis.",
        documents: ["Aadhaar Card", "Bank Details", "Mandi Entry Slip", "Mobile Number linked to Bank", "Farmer Registration Form"],
        category: "Market Support",
        deadline: "2026-12-31",
        isNew: false,
        source: "Central Govt",
        link: "https://enam.gov.in/"
    },
    {
        id: "scheme-10",
        title: "Pradhan Mantri Krishi Sinchai Yojana (PMKSY)",
        summary: "Motto of 'Har Khet Ko Pani' and 'Per Drop More Crop' for irrigation efficiency.",
        benefits: "Subsidies for drip and sprinkler irrigation; water source development support.",
        eligibility: "Farmers having assured water source and land records.",
        documents: ["Land Tax Receipt", "Aadhaar Card", "Bank Passbook", "Quotation for Irrigation System", "Water Source Certificate"],
        category: "Irrigation",
        deadline: "2026-06-30",
        isNew: false,
        endingSoon: true,
        source: "Central Govt",
        link: "https://pmksy.gov.in/"
    },
    {
        id: "scheme-11",
        title: "Agriculture Infrastructure Fund (AIF)",
        summary: "Financing facility for investment in viable projects for post-harvest management infrastructure.",
        benefits: "3% interest subvention for loans up to ₹2 Crores; CGTMSE fee waiver.",
        eligibility: "FPOs, SHGs, Agri-entrepreneurs, and startups.",
        documents: ["Project Report (DPR)", "Identity Proof", "Business Registration Certificate", "Land Ownership Documents", "Financial Balance Sheets"],
        category: "Infrastructure",
        deadline: "2026-12-20",
        isNew: true,
        source: "Central Govt",
        link: "https://agriinfra.dac.gov.in/"
    },
    {
        id: "scheme-12",
        title: "Livestock Insurance Scheme",
        summary: "Protecting farmers from the financial loss due to the death of their animals.",
        benefits: "Insurance cover for indigenous/crossbred milch cattle at subsidized premiums.",
        eligibility: "Cattle owners, especially those from BPL and marginalized categories.",
        documents: ["Health Certificate from Vet", "Identity Proof", "Animal Photograph with Tag", "Policy Premium Receipt", "BPL Card (if applicable)"],
        category: "Insurance",
        deadline: "2026-04-30",
        isNew: false,
        source: "Central Govt",
        link: "https://dahd.nic.in/"
    },
    {
        id: "scheme-13",
        title: "Nanaji Deshmukh Krishi Sanjivani Yojana (PoCRA)",
        summary: "Climate Resilient Agriculture project for drought-prone regions of Maharashtra.",
        benefits: "Direct Benefit Transfer (DBT) for various activities like farm ponds, micro-irrigation, and seeds.",
        eligibility: "Farmers in 15 selected districts of Maharashtra.",
        documents: ["Aadhaar Card", "7/12 & 8A Extracts", "Bank Account Details", "Caste Certificate", "Project Quotation / DPR", "Site Photo"],
        category: "Climate Resilience",
        deadline: "2026-02-28",
        isNew: false,
        source: "State Govt",
        link: "https://pocradbthome.maharashtra.gov.in/"
    },
    {
        id: "scheme-14",
        title: "Gopinath Munde Shetkari Apghat Vima Yojana",
        summary: "Accidental insurance for farmers in Maharashtra to support families in case of death or disability.",
        benefits: "Up to ₹2 Lakh insurance cover for accidental death or permanent disability.",
        eligibility: "Registered farmers in Maharashtra between 10 to 75 years age.",
        documents: ["FIR Copy", "7/12 Extract", "Post Mortem Report", "Death Certificate", "Nominee Identity Proof", "Legal Heir Certificate"],
        category: "Insurance",
        deadline: "2026-11-15",
        isNew: true,
        source: "State Govt",
        link: "https://krishi.maharashtra.gov.in/"
    },
    {
        id: "scheme-15",
        title: "E-Pik Pahani (Digital Crop Survey)",
        summary: "Enabling farmers to register their crop information themselves via mobile app.",
        benefits: "Accurate crop records for insurance claims and government support eligibility.",
        eligibility: "All farmers in Maharashtra.",
        documents: ["Aadhaar Number", "Registered Mobile Number", "7/12 Extract Details", "Live Photo of Sown Crop"],
        category: "E-Governance",
        deadline: "2026-01-31",
        isNew: false,
        source: "State Govt",
        link: "https://mahabhui.maharashtra.gov.in/"
    }
];

const SchemeCard = ({ scheme, isBookmarked, onToggleBookmark, onOpenDetail }) => {
    return (
        <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group bg-white rounded-[24px] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
        >
            <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-wrap gap-1.5">
                        {scheme.isNew && <span className="px-2 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full shadow-sm">NEW</span>}
                        {scheme.endingSoon && <span className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full shadow-sm">ENDING SOON</span>}
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleBookmark(scheme.id); }}
                        className={`p-2 rounded-xl transition-all ${isBookmarked ? "bg-amber-100 text-amber-600 shadow-inner" : "bg-gray-50 text-gray-300 hover:text-amber-500 hover:bg-amber-50"}`}
                    >
                        {isBookmarked ? <MdBookmark className="text-xl" /> : <MdBookmarkBorder className="text-xl" />}
                    </button>
                </div>
                
                <h3 className="text-base font-bold text-gray-900 leading-snug mb-2 group-hover:text-green-700 transition-colors tracking-tight line-clamp-2">{scheme.title}</h3>
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100 uppercase tracking-wider">{scheme.source}</span>
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 uppercase tracking-wider">{scheme.category}</span>
                </div>
                <p className="text-xs text-gray-500 font-medium leading-relaxed mb-4 line-clamp-2">{scheme.summary}</p>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:bg-white transition-colors">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Benefit</p>
                        <p className="text-[10px] font-bold text-gray-800 line-clamp-1">{scheme.benefits}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:bg-white transition-colors">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Deadline</p>
                        <p className="text-[10px] font-black text-red-600 italic">{format(new Date(scheme.deadline), "MMM dd")}</p>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center gap-2">
                <button 
                    onClick={() => onOpenDetail(scheme)}
                    className="flex-1 py-2.5 bg-white text-gray-900 text-[10px] font-bold uppercase tracking-widest rounded-xl border border-gray-200 hover:bg-gray-100 transition shadow-sm"
                >
                    Learn More
                </button>
                <a 
                    href={scheme.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-100 flex items-center justify-center"
                    title="Apply Now"
                >
                    <MdOpenInNew className="text-lg" />
                </a>
            </div>
        </motion.div>
    );
};

const SchemeDiscovery = () => {
    const { authUser } = useAuthStore();
    const [schemes, setSchemes] = useState([]);
    const [bookmarks, setBookmarks] = useState([]);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("All");
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [speaking, setSpeaking] = useState(false);

    // Initial load and real-time sync
    useEffect(() => {
        const unsubSchemes = getSchemes((data) => {
            if (data.length === 0) {
                // If empty, seed initial data
                handleRefresh(true);
            } else {
                setSchemes(data);
            }
        });

        const fetchMeta = async () => {
            const meta = await getMetadata();
            setLastUpdated(meta.lastUpdated);
            
            // Auto-update mechanism: check if data is older than 24 hours
            if (meta.lastUpdated) {
                const hoursSinceUpdate = differenceInHours(new Date(), new Date(meta.lastUpdated));
                if (hoursSinceUpdate >= 24) {
                    toast.info("Updating scheme directory for you...");
                    handleRefresh(true);
                }
            }
        };

        fetchMeta();
        return () => unsubSchemes();
    }, []);

    // Sync bookmarks
    useEffect(() => {
        if (!authUser) return;
        const bRef = ref(db, `users/${authUser.uid}/bookmarkedSchemes`);
        const unsub = onValue(bRef, (snap) => setBookmarks(snap.val() || []));
        return () => unsub();
    }, [authUser]);

    const handleRefresh = async (isSilent = false) => {
        setIsSyncing(true);
        if (!isSilent) toast.loading("Checking portals...", { id: "sync" });
        
        const result = await refreshSchemes(INITIAL_SCHEMES);
        setIsSyncing(false);
        
        if (result.success) {
            setLastUpdated(new Date().toISOString());
            if (!isSilent) toast.success("Updated!", { id: "sync" });
        } else {
            if (!isSilent) toast.error("Update failed.", { id: "sync" });
        }
    };

    const handleToggleBookmark = async (id) => {
        if (!authUser) {
            toast.error("Please login first");
            return;
        }
        const result = await toggleBookmark(authUser.uid, id, bookmarks);
        toast.success(result.isBookmarked ? "Saved!" : "Removed");
    };

    const handleSpeak = (text) => {
        if (speaking) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.onend = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(utterance);
    };

    const filteredSchemes = schemes.filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase()) || 
                             s.summary.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === "All" || s.category.includes(filter) || s.source === filter;
        return matchesSearch && matchesFilter;
    });

    const triggerVoiceGuide = () => {
        const intro = "Welcome to your government scheme directory. Explore subsidies, loans, and benefits specifically for your farm.";
        handleSpeak(intro);
    };

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 lg:p-8 xl:p-12 transition-all duration-300">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Refined Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                            <MdAccountBalance className="text-xl" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Official Repository</span>
                        </div>
                        <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-none">
                            Government <span className="text-green-600">Schemes</span>
                        </h1>
                        <p className="text-gray-500 font-medium text-sm lg:text-base">
                            Discover financial aid and verified support updated daily.
                        </p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                        {lastUpdated && (
                            <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 flex items-center gap-2 shadow-sm">
                                <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? "bg-amber-500 animate-ping" : "bg-green-500"}`} />
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Last Sync: {format(new Date(lastUpdated), "HH:mm")}
                                </p>
                            </div>
                        )}
                        <button 
                            onClick={() => handleRefresh(false)} 
                            disabled={isSyncing}
                            className="btn-primary py-2.5 px-6 rounded-2xl flex items-center gap-2 text-[11px]"
                        >
                            <MdRefresh className={`${isSyncing ? "animate-spin" : ""}`} />
                            <span className="font-bold uppercase tracking-widest">Update Data</span>
                        </button>
                    </div>
                </div>

                {/* Compact Search & Filter */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                    <div className="lg:col-span-2 relative group">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-xl" />
                        <input 
                            type="text" 
                            placeholder="Search schemes..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-[20px] shadow-sm focus:border-green-500/30 outline-none transition-all font-semibold placeholder:text-gray-300"
                        />
                    </div>
                    <div className="lg:col-span-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {["All", "Income Support", "Insurance", "Subsidy"].map(f => (
                            <button 
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-5 py-4 rounded-[20px] text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${filter === f ? "bg-green-600 text-white shadow-lg" : "bg-white text-gray-500 border border-gray-100 shadow-sm"}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Balanced Grid */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <MdHistoryEdu className="text-2xl text-green-600" />
                        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Recommended for your farm</h2>
                    </div>
                    
                    {filteredSchemes.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-[32px] border border-gray-100">
                            <MdInfoOutline className="text-4xl text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400 font-bold">No results found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredSchemes.map(s => (
                                <SchemeCard 
                                    key={s.id} 
                                    scheme={s} 
                                    isBookmarked={bookmarks.includes(s.id)}
                                    onToggleBookmark={handleToggleBookmark}
                                    onOpenDetail={setSelectedScheme}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Compact Voice Banner */}
                <div className="bg-gradient-to-r from-green-900 to-emerald-900 rounded-[32px] p-8 text-white relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                            <MdSettingsVoice className="text-2xl" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-lg font-bold tracking-tight mb-1">Need help? Use Voice Guide</h3>
                            <p className="text-green-100/70 text-sm font-medium">Listen to scheme details in simple language.</p>
                        </div>
                        <button 
                            onClick={triggerVoiceGuide}
                            className="px-8 py-3 bg-white text-green-900 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg active:scale-95"
                        >
                            Start Tour
                        </button>
                    </div>
                </div>
            </div>

            {/* Scale-down Modal */}
            <AnimatePresence>
                {selectedScheme && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setSelectedScheme(null)}
                            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="p-8 border-b border-gray-50 flex items-start justify-between">
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 bg-green-600 text-white text-[9px] font-bold rounded-full uppercase tracking-wider">{selectedScheme.category}</span>
                                        <span className="px-3 py-1 bg-gray-50 text-gray-500 text-[9px] font-bold rounded-full border border-gray-100 uppercase tracking-wider">{selectedScheme.source}</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">{selectedScheme.title}</h2>
                                </div>
                                <button onClick={() => setSelectedScheme(null)} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full transition-all">
                                    <MdClose className="text-xl text-gray-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Overview</h4>
                                        <button 
                                            onClick={() => handleSpeak(`${selectedScheme.title}. ${selectedScheme.summary}`)}
                                            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${speaking ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}
                                        >
                                            <MdVolumeUp /> {speaking ? "Stop" : "Listen"}
                                        </button>
                                    </div>
                                    <p className="text-gray-600 font-medium leading-relaxed">{selectedScheme.summary}</p>
                                    <div className="p-6 bg-green-50 rounded-3xl border border-green-100/50 flex items-start gap-4">
                                        <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center text-xl">💰</div>
                                        <div>
                                            <p className="text-[10px] font-bold text-green-800 uppercase tracking-widest mb-1">Benefit</p>
                                            <p className="text-green-900 font-bold">{selectedScheme.benefits}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Eligibility</h4>
                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100/50 italic text-sm">
                                            {selectedScheme.eligibility}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Required Documents</h4>
                                        <ul className="space-y-2">
                                            {selectedScheme.documents.map((doc, i) => (
                                                <li key={i} className="flex items-center gap-3 text-sm font-bold text-gray-600 bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                                                    <MdCheckCircleOutline className="text-green-500" /> {doc}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="p-6 bg-red-50 rounded-3xl border border-red-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <MdCalendarToday className="text-red-600 text-2xl" />
                                        <div>
                                            <p className="text-[9px] font-bold text-red-800 uppercase tracking-widest">Deadline</p>
                                            <p className="text-red-700 font-bold">{format(new Date(selectedScheme.deadline), "MMMM dd, yyyy")}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 border-t border-gray-50 flex flex-col sm:flex-row gap-3 bg-gray-50/20">
                                <button 
                                    onClick={() => handleToggleBookmark(selectedScheme.id)}
                                    className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-widest rounded-2xl border transition-all ${bookmarks.includes(selectedScheme.id) ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-white text-gray-400 border-gray-100 hover:text-amber-500"}`}
                                >
                                    {bookmarks.includes(selectedScheme.id) ? "Saved" : "Save Later"}
                                </button>
                                <a 
                                    href={selectedScheme.link}
                                    target="_blank" rel="noreferrer"
                                    className="flex-[2] py-4 bg-gray-900 text-white text-[11px] font-bold uppercase tracking-widest rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2"
                                >
                                    Official Application <MdOpenInNew />
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
