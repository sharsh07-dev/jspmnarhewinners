import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import { ref as storageRef, push, set } from "firebase/database";
import useAuthStore from "../store/useAuthStore";
import EquipmentCard, { EquipmentCardSkeleton } from "../components/EquipmentCard";
import { compressAndUpload } from "../services/cloudinary";
import { getUserLocation, reverseGeocode } from "../utils/geo";
import { suggestPrice } from "../utils/priceSuggestion";
import { useStagger, useFadeUp } from "../hooks/useGSAP";
import toast from "react-hot-toast";
import {
    MdAddCircle, MdSearch, MdLocationOn, MdStar,
    MdVerified, MdFlashOn, MdSecurity, MdClose
} from "react-icons/md";
import { FaTractor, FaSeedling } from "react-icons/fa";
import tractorsImg from "../assets/TRACTORS.jpg";

/* ─── Static data ─────────────────────────────────── */
const STATS = [
    { icon: <FaTractor />, value: "2,400+", label: "Equipment Listed" },
    { icon: <FaSeedling />, value: "18,000+", label: "Farmers Benefited" },
    { icon: <MdStar />, value: "4.8 ★", label: "Average Rating" },
    { icon: <MdLocationOn />, value: "320+", label: "Villages Covered" },
];

const FEATURES = [
    { icon: <MdFlashOn className="h-7 w-7" />, title: "Instant Booking", desc: "Real-time slot validation prevents double bookings.", gradient: "from-green-500 to-emerald-600" },
    { icon: <MdLocationOn className="h-7 w-7" />, title: "Nearby Search", desc: "GPS-powered search finds equipment in your village.", gradient: "from-blue-500 to-cyan-600" },
    { icon: <MdVerified className="h-7 w-7" />, title: "Verified Owners", desc: "Every owner is verified with real farmer ratings.", gradient: "from-purple-500 to-violet-600" },
    { icon: <MdSecurity className="h-7 w-7" />, title: "Secure Payments", desc: "All transactions are logged and protected.", gradient: "from-orange-500 to-amber-600" },
];

const EQUIPMENT_TYPES = [
    { label: "Tractor", emoji: "🚜", type: "Tractor" },
    { label: "Harvester", emoji: "🌾", type: "Harvester" },
    { label: "Sprayer", emoji: "💦", type: "Sprayer" },
    { label: "Rotavator", emoji: "⚙️", type: "Rotavator" },
    { label: "Plough", emoji: "🌱", type: "Plough" },
    { label: "Tools", emoji: "🔧", type: "Tools" },
];

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

/* ─── Main Page ────────────────────────────────────── */
const HomePage = () => {
    const { user, authUser } = useAuthStore();
    const navigate = useNavigate();
    const statsRef = useStagger();
    const featRef = useStagger();
    const featuredRef = useFadeUp();

    const [allEquipment, setAllEquipment] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("All");
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        const unsub = onValue(ref(db, "equipment"), (snap) => {
            if (snap.exists()) {
                setAllEquipment(Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })).filter(e => e.status !== "rejected"));
            } else setAllEquipment([]);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const allFiltered = allEquipment.filter(eq => {
        const matchSearch = eq.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (eq.location?.address || eq.location || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchType = filterType === "All" || eq.type === filterType;
        return matchSearch && matchType;
    });

    const featuredEquipment = allEquipment.slice(0, 6); // Just show some featured items on home

    /* ──────────────────────────────────────────────────
       PUBLIC / GUEST VIEW (Video Hero)
    ────────────────────────────────────────────────── */
    return (
        <div className="overflow-x-hidden">
            {/* ─── HERO with Image background ─── */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
                {/* Background Image */}
                <img
                    src={tractorsImg}
                    alt="Farm tractors"
                    className="absolute inset-0 w-full h-full object-cover object-center scale-105"
                />

                {/* Stronger dark overlay for readability */}
                <div className="absolute inset-0 bg-black/65" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

                {/* ── Centered Content ── */}
                <div className="relative z-10 w-full max-w-4xl mx-auto px-6 sm:px-10 text-center py-24">

                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 bg-green-500/25 text-green-300 border border-green-500/40 px-5 py-2 rounded-full text-sm font-semibold mb-6"
                    >
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        India's #1 Agri Equipment Platform 🌾
                    </motion.div>

                    {/* Heading */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.75 }}
                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight font-display mb-5 drop-shadow-lg"
                    >
                        Rent Farm Equipment{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
                            Near You
                        </span>
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-lg sm:text-xl text-gray-200 leading-relaxed mb-10 max-w-2xl mx-auto drop-shadow"
                    >
                        Connect with local farmers to rent tractors, harvesters, and tools.
                        Save costs, increase yield — one tap away.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.65 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
                    >
                        <Link
                            to="/auth?signup=1"
                            className="px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-bold text-lg rounded-2xl shadow-2xl shadow-green-900/50 hover:-translate-y-1 transition-all duration-300"
                        >
                            Create Free Account 🌱
                        </Link>
                        <Link
                            to="/auth"
                            className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/40 text-white font-bold text-lg rounded-2xl hover:bg-white/20 hover:border-white/70 hover:-translate-y-1 transition-all duration-300"
                        >
                            Sign In →
                        </Link>
                    </motion.div>

                    {/* Trust Stats Pills */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.85 }}
                        className="flex flex-wrap items-center justify-center gap-3"
                    >
                        {[
                            { emoji: "🌾", text: "18,000+ Farmers" },
                            { emoji: "🚜", text: "2,400+ Equipment" },
                            { emoji: "⭐", text: "4.8 / 5 Rating" },
                            { emoji: "📍", text: "320+ Villages" },
                        ].map((item, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 text-white text-sm font-semibold px-4 py-2 rounded-full"
                            >
                                <span>{item.emoji}</span>
                                <span>{item.text}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Scroll indicator */}
                <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-xs flex flex-col items-center gap-1"
                >
                    <span className="tracking-widest uppercase text-[10px]">Scroll</span>
                    <div className="w-px h-8 bg-white/30" />
                </motion.div>
            </section>

            {/* ─── STATS ─── */}
            <section className="relative -mt-16 z-10 pb-8">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {STATS.map((s, i) => (
                            <div key={i} className="bg-white rounded-2xl p-6 text-center shadow-xl border border-gray-50">
                                <div className="text-2xl text-green-600 mb-2 flex justify-center">{s.icon}</div>
                                <p className="text-2xl font-black text-gray-900 font-display">{s.value}</p>
                                <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CATEGORY BROWSE ─── */}
            <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="section-title">Browse by Category</h2>
                        <p className="text-gray-500 mt-2">Find the right equipment for every farming need</p>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        {EQUIPMENT_TYPES.map((t, i) => (
                            <Link
                                key={i}
                                to="/auth?signup=1"
                                className="group flex flex-col items-center gap-2 p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl hover:border-green-400 hover:bg-green-50 hover:-translate-y-1 transition-all duration-200"
                            >
                                <span className="text-4xl group-hover:scale-110 transition-transform">{t.emoji}</span>
                                <span className="text-xs font-bold text-gray-700 group-hover:text-green-700">{t.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FEATURES ─── */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="section-title">Why Farmers Love AgroShare</h2>
                        <p className="text-gray-500 mt-3 max-w-xl mx-auto">Built for rural India – fast, simple, and reliable even on 2G networks.</p>
                    </div>
                    <div ref={featRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {FEATURES.map((f, i) => (
                            <motion.div key={i} whileHover={{ y: -8 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white mb-5 shadow-lg`}>{f.icon}</div>
                                <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA ─── */}
            <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-green-700 to-emerald-800">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-5xl font-black text-white font-display mb-4">Start sharing today 🌾</h2>
                    <p className="text-green-100 text-lg mb-8">Join 18,000+ Indian farmers earning extra income with their equipment.</p>
                    <div className="flex justify-center gap-4 flex-wrap">
                        <Link to="/auth?signup=1" className="bg-white text-green-800 hover:bg-green-50 px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all">
                            Create Free Account
                        </Link>
                        <Link to="/auth" className="border-2 border-white/40 text-white hover:bg-white/10 px-8 py-4 rounded-2xl font-bold text-lg hover:-translate-y-1 transition-all">
                            Sign In
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;
