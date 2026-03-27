import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import EquipmentCard, { EquipmentCardSkeleton } from "../components/EquipmentCard";
import { getUserLocation, getDistanceKm } from "../utils/geo";
import {
    MdSearch, MdFilterList, MdGridView, MdViewList,
    MdLocationOn, MdTune, MdClose, MdStar, MdVerified,
    MdTrendingUp, MdAccessTime, MdShoppingCart, MdHandshake
} from "react-icons/md";
import { FaTractor, FaSeedling, FaSortAmountDown } from "react-icons/fa";
import { compressAndUpload } from "../services/cloudinary";
import { suggestPrice } from "../utils/priceSuggestion";
import useAuthStore from "../store/useAuthStore";
import { MdAddCircle } from "react-icons/md";

const EQUIPMENT_TYPE_LIST = ["Tractor", "Harvester", "Sprayer", "Rotavator", "Plough", "Tools"];

/* ─── Add Equipment Modal ──────────────────────────── */
const AddEquipmentModal = ({ open, onClose, authUser, user }) => {
    const [form, setForm] = useState({ name: "", type: "Tractor", price: "", salePrice: "", location: "", description: "", listingType: "rent" });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [priceSuggestion, setPriceSuggestion] = useState(null);

    const handleTypeChange = (type) => {
        setForm(f => ({ ...f, type }));
        setPriceSuggestion(suggestPrice(type));
    };

    const handleGPS = async () => {
        try {
            const loc = await getUserLocation();
            const address = await reverseGeocode(loc.lat, loc.lng);
            setForm(f => ({ ...f, location: address, lat: loc.lat, lng: loc.lng }));
            toast.success(`📍 Location: ${address}`);
        } catch { toast.error("Could not get GPS location"); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const needsRentPrice = form.listingType === "rent" || form.listingType === "both";
        const needsSalePrice = form.listingType === "sell" || form.listingType === "both";
        if (!form.name || !form.location) { toast.error("Fill all required fields"); return; }
        if (needsRentPrice && !form.price) { toast.error("Enter a rental price per hour"); return; }
        if (needsSalePrice && !form.salePrice) { toast.error("Enter a sale price"); return; }
        setUploading(true);
        try {
            let imageUrl = "";
            if (imageFile) imageUrl = await compressAndUpload(imageFile);
            const newRef = push(ref(db, "equipment"));
            await set(newRef, {
                name: form.name, type: form.type,
                listingType: form.listingType,
                price: form.price ? Number(form.price) : 0,
                salePrice: form.salePrice ? Number(form.salePrice) : null,
                location: form.lat ? { address: form.location, lat: form.lat, lng: form.lng } : form.location,
                description: form.description,
                ownerId: authUser.uid,
                ownerName: user?.name,
                imageUrl, status: "approved", rating: null,
                createdAt: new Date().toISOString(),
            });
            toast.success("Equipment listed successfully! 🎉");
            setForm({ name: "", type: "Tractor", price: "", salePrice: "", location: "", description: "", listingType: "rent" });
            setImageFile(null); setImagePreview(null); setPriceSuggestion(null);
            onClose();
        } catch (err) {
            toast.error(`Upload failed: ${err.message}`, { duration: 6000 });
        } finally { setUploading(false); }
    };
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 flex items-center justify-between rounded-t-3xl">
                    <h2 className="text-xl font-black text-gray-900">List Your Equipment 🌾</h2>
                    <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition">
                        <MdClose className="h-5 w-5 text-gray-600" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Equipment Name *</label>
                            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="e.g. Mahindra 575 DI" />
                        </div>
                        <div>
                            <label className="label">Type *</label>
                            <select value={form.type} onChange={e => handleTypeChange(e.target.value)} className="input-field">
                                {EQUIPMENT_TYPE_LIST.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* ── Listing Type ── */}
                    <div>
                        <label className="label">Listing Type *</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: "rent", label: "🕐 For Rent", desc: "Hourly rental" },
                                { value: "sell", label: "🏷️ For Sale", desc: "One-time sale" },
                                { value: "both", label: "🤝 Rent & Sell", desc: "Both options" },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, listingType: opt.value }))}
                                    className={`p-3 rounded-xl border-2 text-center transition-all ${form.listingType === opt.value
                                        ? "border-green-500 bg-green-50 text-green-800"
                                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                                        }`}
                                >
                                    <div className="font-bold text-sm">{opt.label}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Rent Price ── */}
                    {(form.listingType === "rent" || form.listingType === "both") && (
                        <div>
                            <label className="label flex justify-between">
                                <span>Rental Price per hour (₹) *</span>
                                {priceSuggestion && (
                                    <button type="button" onClick={() => setForm(f => ({ ...f, price: priceSuggestion.suggested }))} className="text-green-600 text-xs font-bold hover:underline">
                                        AI Suggest: ₹{priceSuggestion.suggested}
                                    </button>
                                )}
                            </label>
                            <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="input-field" placeholder="e.g. 250" />
                        </div>
                    )}

                    {/* ── Sale Price ── */}
                    {(form.listingType === "sell" || form.listingType === "both") && (
                        <div>
                            <label className="label">Sale Price (₹) *</label>
                            <input type="number" min="0" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} className="input-field" placeholder="e.g. 450000" />
                        </div>
                    )}

                    <div>
                        <label className="label flex justify-between">
                            <span>Location *</span>
                            <button type="button" onClick={handleGPS} className="text-green-600 text-xs font-bold hover:underline flex items-center gap-1">
                                <MdLocationOn className="h-3 w-3" /> Use GPS
                            </button>
                        </label>
                        <input required value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="input-field" placeholder="e.g. Shirur, Pune" />
                    </div>

                    <div>
                        <label className="label">Description</label>
                        <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" placeholder="Condition, accessories, etc." />
                    </div>

                    <div>
                        <label className="label">Photo <span className="text-gray-400 font-normal">(optional)</span></label>
                        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center hover:border-green-400 transition-colors">
                            {imagePreview ? (
                                <div className="relative">
                                    <img src={imagePreview} className="h-32 w-full object-cover rounded-xl" />
                                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                                        <MdClose className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <input type="file" accept="image/*" id="modal-img-upload" className="hidden"
                                        onChange={e => {
                                            const f = e.target.files[0];
                                            if (!f) return;
                                            setImageFile(f);
                                            setImagePreview(URL.createObjectURL(f));
                                        }}
                                    />
                                    <label htmlFor="modal-img-upload" className="cursor-pointer">
                                        <span className="text-3xl block mb-1">📷</span>
                                        <p className="text-sm text-gray-500">Click to upload photo</p>
                                    </label>
                                </>
                            )}
                        </div>
                    </div>

                    <button type="submit" disabled={uploading} className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all shadow-green ${uploading ? "bg-green-300 text-white cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"}`}>
                        {uploading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                                Uploading...
                            </span>
                        ) : "List Equipment 🌾"}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

const TYPES = ["All Types", "Tractor", "Harvester", "Sprayer", "Rotavator", "Plough", "Tools"];
const LISTING_TYPES = [
    { value: "all", label: "All Listings", icon: <MdFilterList /> },
    { value: "rent", label: "For Rent", icon: <MdAccessTime /> },
    { value: "sell", label: "For Sale", icon: <MdShoppingCart /> },
    { value: "both", label: "Rent & Sell", icon: <MdHandshake /> },
];
const SORT_OPTIONS = [
    { value: "nearest", label: "📍 Nearest First" },
    { value: "newest", label: "Newest First" },
    { value: "price_asc", label: "Price: Low → High" },
    { value: "price_desc", label: "Price: High → Low" },
    { value: "rating", label: "Top Rated" },
];

const EquipmentListing = () => {
    const { user, authUser } = useAuthStore();
    const [equipment, setEquipment] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("All Types");
    const [listingFilter, setListingFilter] = useState("all");
    const [sort, setSort] = useState("nearest");
    const [priceMin, setPriceMin] = useState("");
    const [priceMax, setPriceMax] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // grid | list
    const [showFilters, setShowFilters] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [userLocation, setUserLocation] = useState(null); // { lat, lng }
    const [locLoading, setLocLoading] = useState(true);

    useEffect(() => {
        // Auto-detect user location silently
        getUserLocation()
            .then(loc => setUserLocation(loc))
            .catch(() => { })
            .finally(() => setLocLoading(false));

        const unsub = onValue(ref(db, "equipment"), (snap) => {
            if (snap.exists()) {
                setEquipment(
                    Object.keys(snap.val())
                        .map(k => ({ id: k, ...snap.val()[k] }))
                        .filter(e => e.status !== "rejected")
                );
            } else setEquipment([]);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const filtered = useMemo(() => {
        let list = [...equipment];

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(e =>
                e.name?.toLowerCase().includes(q) ||
                (e.location?.address || e.location || "").toLowerCase().includes(q) ||
                e.ownerName?.toLowerCase().includes(q) ||
                e.type?.toLowerCase().includes(q)
            );
        }

        // Equipment type
        if (typeFilter !== "All Types") list = list.filter(e => e.type === typeFilter);

        // Listing type
        if (listingFilter !== "all") list = list.filter(e => (e.listingType || "rent") === listingFilter);

        // Price range (use price for rent/both, salePrice for sell)
        if (priceMin !== "") list = list.filter(e => (Number(e.price) || 0) >= Number(priceMin));
        if (priceMax !== "") list = list.filter(e => (Number(e.price) || 0) <= Number(priceMax));

        // Sort
        // Distance sort (nearest first)
        if (sort === "nearest" && userLocation) {
            list.sort((a, b) => {
                const distA = (a.location?.lat && a.location?.lng)
                    ? getDistanceKm(userLocation.lat, userLocation.lng, a.location.lat, a.location.lng)
                    : 9999;
                const distB = (b.location?.lat && b.location?.lng)
                    ? getDistanceKm(userLocation.lat, userLocation.lng, b.location.lat, b.location.lng)
                    : 9999;
                return distA - distB;
            });
        } else if (sort === "nearest") {
            // Fallback if no location, sort by newest
            list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        if (sort === "newest") list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (sort === "price_asc") list.sort((a, b) => (a.price || 0) - (b.price || 0));
        if (sort === "price_desc") list.sort((a, b) => (b.price || 0) - (a.price || 0));
        if (sort === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));

        // Attach distance to each item for badge display
        if (userLocation) {
            list = list.map(eq => ({
                ...eq,
                _distKm: (eq.location?.lat && eq.location?.lng)
                    ? getDistanceKm(userLocation.lat, userLocation.lng, eq.location.lat, eq.location.lng)
                    : null,
            }));
        }

        return list;
    }, [equipment, search, typeFilter, listingFilter, sort, priceMin, priceMax, userLocation]);

    const stats = useMemo(() => ({
        total: equipment.length,
        forRent: equipment.filter(e => (e.listingType || "rent") === "rent" || e.listingType === "both").length,
        forSale: equipment.filter(e => e.listingType === "sell" || e.listingType === "both").length,
        avgPrice: equipment.length
            ? Math.round(equipment.reduce((s, e) => s + (e.price || 0), 0) / equipment.length)
            : 0,
    }), [equipment]);

    const clearFilters = () => {
        setSearch(""); setTypeFilter("All Types"); setListingFilter("all");
        setPriceMin(""); setPriceMax(""); setSort("newest");
    };

    const activeFilters = [
        search && `"${search}"`,
        typeFilter !== "All Types" && typeFilter,
        listingFilter !== "all" && LISTING_TYPES.find(l => l.value === listingFilter)?.label,
        priceMin && `Min ₹${priceMin}`,
        priceMax && `Max ₹${priceMax}`,
    ].filter(Boolean);

    return (
        <div className="min-h-screen bg-gray-50 pt-[68px]">
            <AddEquipmentModal open={showAddModal} onClose={() => setShowAddModal(false)} authUser={authUser} user={user} />

            {/* ── Header Banner ── */}
            <div className="bg-gradient-to-br from-green-800 to-emerald-700 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div>
                                <div className="flex items-center gap-2 text-green-300 text-sm font-semibold mb-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
                                    Live Equipment Marketplace
                                </div>
                                <h1 className="text-3xl md:text-4xl font-black font-display">
                                    Find Equipment Near You 🚜
                                </h1>
                                <p className="text-green-100 mt-1 text-sm">Rent or buy equipment from farmers in your area</p>
                            </div>

                            {/* List button added here */}
                            {user && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="flex items-center gap-2 px-6 py-3 bg-white text-green-800 font-bold rounded-2xl hover:bg-green-50 transition-all shadow-xl"
                                >
                                    <MdAddCircle className="h-5 w-5 text-green-600" />
                                    List My Equipment
                                </button>
                            )}
                        </div>

                        {/* Quick stats */}
                        <div className="flex gap-3 flex-wrap">
                            {[
                                { label: "Total Listings", value: stats.total, color: "bg-white/10" },
                                { label: "For Rent", value: stats.forRent, color: "bg-blue-500/30" },
                                { label: "For Sale", value: stats.forSale, color: "bg-orange-500/30" },
                                { label: "Avg. ₹/hr", value: `₹${stats.avgPrice}`, color: "bg-purple-500/30" },
                            ].map((s, i) => (
                                <div key={i} className={`${s.color} backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10 text-center min-w-[80px]`}>
                                    <p className="font-black text-lg text-white">{s.value}</p>
                                    <p className="text-xs text-green-200">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="mt-6 flex gap-3">
                        <div className="relative flex-1">
                            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name, location, owner, type..."
                                className="w-full bg-white/15 border-2 border-white/20 text-white placeholder-white/50 rounded-2xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all"
                            />
                            {search && (
                                <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
                                    <MdClose className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-sm border-2 transition-all ${showFilters ? "bg-white text-green-800 border-white" : "bg-white/10 text-white border-white/20 hover:bg-white/20"}`}
                        >
                            <MdTune className="h-5 w-5" />
                            Filters {activeFilters.length > 0 && <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">{activeFilters.length}</span>}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Filters panel ── */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white border-b border-gray-200 overflow-hidden shadow-sm"
                    >
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                {/* Equipment Type */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Equipment Type</label>
                                    <div className="flex flex-wrap gap-2">
                                        {TYPES.map(t => (
                                            <button key={t} onClick={() => setTypeFilter(t)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${typeFilter === t ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600 hover:border-green-400"}`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Listing Type */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Listing Type</label>
                                    <div className="flex flex-wrap gap-2">
                                        {LISTING_TYPES.map(l => (
                                            <button key={l.value} onClick={() => setListingFilter(l.value)}
                                                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${listingFilter === l.value ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600 hover:border-green-400"}`}>
                                                {l.icon} {l.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Price Range */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Price Range (₹/hr)</label>
                                    <div className="flex gap-2">
                                        <input type="number" placeholder="Min" value={priceMin} onChange={e => setPriceMin(e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-green-400" />
                                        <input type="number" placeholder="Max" value={priceMax} onChange={e => setPriceMax(e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-green-400" />
                                    </div>
                                </div>

                                {/* Sort */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Sort By</label>
                                    <select value={sort} onChange={e => setSort(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400">
                                        {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {activeFilters.length > 0 && (
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                    <span className="text-xs text-gray-500 font-medium">Active:</span>
                                    {activeFilters.map((f, i) => (
                                        <span key={i} className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">{f}</span>
                                    ))}
                                    <button onClick={clearFilters} className="ml-auto text-xs text-red-500 font-semibold hover:text-red-700 flex items-center gap-1">
                                        <MdClose className="h-3 w-3" /> Clear all
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Type quick-filter chips ── */}
            <div className="bg-white border-b border-gray-100 sticky top-[68px] z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide py-3">
                        {[
                            { label: "🌾 All", value: "All Types" },
                            { label: "🚜 Tractor", value: "Tractor" },
                            { label: "🌾 Harvester", value: "Harvester" },
                            { label: "💦 Sprayer", value: "Sprayer" },
                            { label: "⚙️ Rotavator", value: "Rotavator" },
                            { label: "🌱 Plough", value: "Plough" },
                            { label: "🔧 Tools", value: "Tools" },
                        ].map(t => (
                            <button key={t.value} onClick={() => setTypeFilter(t.value)}
                                className={`flex-shrink-0 px-4 py-1.5 mr-2 rounded-full text-sm font-semibold transition-all border ${typeFilter === t.value
                                    ? "bg-green-600 text-white border-green-600 shadow-sm"
                                    : "text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700"
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}

                        {/* Right side: result count + view toggle */}
                        <div className="ml-auto flex items-center gap-2 flex-shrink-0 pl-4 border-l border-gray-100">
                            <span className="text-sm text-gray-500 whitespace-nowrap font-medium">{filtered.length} results</span>
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                {[
                                    { mode: "grid", icon: <MdGridView className="h-4 w-4" /> },
                                    { mode: "list", icon: <MdViewList className="h-4 w-4" /> },
                                ].map(v => (
                                    <button key={v.mode} onClick={() => setViewMode(v.mode)}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === v.mode ? "bg-white text-green-700 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                                        {v.icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Listing Type pill filter ── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
                <div className="flex gap-2 flex-wrap">
                    {LISTING_TYPES.map(l => (
                        <button key={l.value} onClick={() => setListingFilter(l.value)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${listingFilter === l.value
                                ? "bg-green-600 text-white border-green-600"
                                : "border-gray-200 text-gray-600 hover:border-green-400 bg-white"
                                }`}>
                            {l.icon}{l.label}
                        </button>
                    ))}
                    <select value={sort} onChange={e => setSort(e.target.value)}
                        className="ml-auto border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 focus:outline-none focus:border-green-400 bg-white">
                        {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Equipment Grid / List ── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {loading ? (
                    <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                        {Array(6).fill(0).map((_, i) => <EquipmentCardSkeleton key={i} />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200"
                    >
                        <div className="text-7xl mb-5">🔍</div>
                        <h3 className="text-2xl font-black text-gray-800 mb-2">No equipment found</h3>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                            Try adjusting your filters or search term. There may not be any listings for this combination yet.
                        </p>
                        {activeFilters.length > 0 && (
                            <button onClick={clearFilters} className="px-6 py-3 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 shadow-green transition-all">
                                Clear all filters
                            </button>
                        )}
                    </motion.div>
                ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map((eq, i) => <EquipmentCard key={eq.id} equipment={eq} index={i} />)}
                    </div>
                ) : (
                    /* ── LIST VIEW ── */
                    <div className="space-y-4">
                        {filtered.map((eq, i) => (
                            <motion.div
                                key={eq.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all overflow-hidden flex"
                            >
                                <div className="w-44 sm:w-56 flex-shrink-0 relative overflow-hidden">
                                    <img
                                        src={eq.imageUrl || "https://images.unsplash.com/photo-1592982537447-6f23dbdc7e90?auto=format&fit=crop&w=400&q=70"}
                                        alt={eq.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                                        <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{eq.type}</span>
                                        {eq.listingType === "sell" && <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">Sale</span>}
                                        {eq.listingType === "both" && <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">Rent+Sell</span>}
                                    </div>
                                </div>

                                <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg truncate">{eq.name}</h3>
                                        <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                                            <MdLocationOn className="h-4 w-4 text-green-500 flex-shrink-0" />
                                            <span className="truncate">{eq.location?.address || eq.location || "India"}</span>
                                        </div>
                                        {eq.ownerName && <p className="text-xs text-gray-400 mt-1">By <span className="font-semibold text-gray-600">{eq.ownerName}</span></p>}
                                        {eq.description && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{eq.description}</p>}
                                    </div>

                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                                        <div className="flex gap-3">
                                            {(eq.listingType === "rent" || !eq.listingType || eq.listingType === "both") && (
                                                <div className="text-center">
                                                    <p className="font-black text-green-700 text-lg">₹{eq.price}<span className="text-xs text-gray-400 font-normal">/hr</span></p>
                                                </div>
                                            )}
                                            {(eq.listingType === "sell" || eq.listingType === "both") && (
                                                <div className="text-center">
                                                    <p className="font-black text-orange-600 text-lg">₹{eq.salePrice || eq.price}<span className="text-xs text-gray-400 font-normal"> sell</span></p>
                                                </div>
                                            )}
                                            {eq.rating && (
                                                <div className="flex items-center gap-1 text-amber-500 text-sm font-bold">
                                                    <MdStar className="h-4 w-4" /> {Number(eq.rating).toFixed(1)}
                                                </div>
                                            )}
                                        </div>
                                        <Link
                                            to={`/equipment/${eq.id}`}
                                            className="px-5 py-2 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-700 transition-all shadow-md"
                                        >
                                            View Details →
                                        </Link>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Results footer */}
                {!loading && filtered.length > 0 && (
                    <div className="text-center mt-10 text-sm text-gray-400">
                        Showing all <span className="font-bold text-gray-600">{filtered.length}</span> results
                        {activeFilters.length > 0 && (
                            <> · <button onClick={clearFilters} className="text-green-600 font-semibold hover:underline">Clear filters</button></>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EquipmentListing;
