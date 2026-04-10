import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { ref, onValue, push, set } from "firebase/database";
import { compressAndUpload } from "../services/cloudinary";
import { getUserLocation, reverseGeocode } from "../utils/geo";
import toast from "react-hot-toast";
import { generateGSTInvoice } from "../utils/invoiceGenerator";
import {
    MdSearch, MdLocationOn, MdFilterList, MdEco, MdVerified,
    MdWarning, MdCheckCircle, MdLocalOffer, MdShare, MdVolunteerActivism,
    MdAddCircle, MdInfo, MdClose, MdDownload, MdPrint, MdHourglassEmpty
} from "react-icons/md";
import { FaBug, FaSeedling, FaLeaf, FaRecycle } from "react-icons/fa";

// Mock Data for the marketplace with improved images
const MOCK_LISTINGS = [
    {
        id: "p1",
        name: "Super Nova - Natural Seaweed Extract",
        crop: "Vegetables",
        quantity: "500 ml",
        price: 250,
        type: "buy",
        expiry: "2026-12-10",
        distance: "1.2 km",
        ownerName: "Rajendra Patil",
        rating: 4.9,
        aiSafe: true,
        image: "/1.png",
        warning: "100% Natural Organic Bio-Stimulant for growth."
    },
    {
        id: "p2",
        name: "Cromin+ Ammonium Polyphosphate",
        crop: "Wheat",
        quantity: "1 Liter",
        price: 450,
        type: "buy",
        expiry: "2026-10-15",
        distance: "3.4 km",
        ownerName: "Swapnil Deshmukh",
        rating: 4.8,
        aiSafe: true,
        image: "/2.png",
        warning: "Concentrated NPK 10:34:00 formulation."
    },
    {
        id: "p3",
        name: "GACIL Enriched Micronutrients",
        crop: "Cotton",
        quantity: "5 kg",
        price: 600,
        type: "buy",
        expiry: "2027-01-20",
        distance: "5.1 km",
        ownerName: "Amol Jadhav",
        rating: 5.0,
        aiSafe: true,
        image: "/3.png",
        warning: "Gujarat Grade 2 Growth Formula."
    },
    {
        id: "p4",
        name: "Zeal Agrilla - Reproductive Process",
        crop: "Sugarcane",
        quantity: "250 gm",
        price: 0,
        type: "share",
        expiry: "2026-09-30",
        distance: "2.8 km",
        ownerName: "Sanjay Shinde",
        rating: 4.7,
        aiSafe: true,
        image: "/4.png",
        warning: "Enhances reproductive efficiency in crops."
    },
    {
        id: "p5",
        name: "Multiplex Chamak Growth Promoter",
        crop: "Rice",
        quantity: "1 Liter",
        price: 0,
        type: "donate",
        expiry: "2026-11-15",
        distance: "0.8 km",
        ownerName: "Kishor Mane",
        rating: 4.9,
        aiSafe: true,
        image: "/5.png",
        warning: "Enhances yield and plant vigor."
    }
];

const CROPS = ["All", "Cotton", "Wheat", "Rice", "Vegetables", "Sugarcane"];
const TYPES = [
    { id: "All", label: "All Types" },
    { id: "buy", label: "Buy 💰" },
    { id: "share", label: "Share 🤝" },
    { id: "donate", label: "Donate 🌿" }
];

/* ─── Add Pesticide Modal ──────────────────────────── */
const AddPesticideModal = ({ open, onClose, authUser, user }) => {
    const [form, setForm] = useState({ name: "", crop: "All", quantity: "", price: "", expiry: "", type: "buy", location: "", warning: "" });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [uploading, setUploading] = useState(false);

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
        if (!form.name || !form.location || !form.expiry || !form.quantity) { toast.error("Fill all required fields"); return; }
        if (form.type === "buy" && !form.price) { toast.error("Enter a price"); return; }
        
        setUploading(true);
        try {
            let imageUrl = "https://placehold.co/400x400/9ca3af/FFF?font=montserrat&text=AgroChemical"; // default fallback
            if (imageFile) imageUrl = await compressAndUpload(imageFile);
            
            const newRef = push(ref(db, "pesticides"));
            await set(newRef, {
                name: form.name, 
                crop: form.crop,
                quantity: form.quantity,
                type: form.type,
                price: form.price ? Number(form.price) : 0,
                expiry: form.expiry,
                location: form.lat ? { address: form.location, lat: form.lat, lng: form.lng } : form.location,
                warning: form.warning,
                ownerId: authUser.uid,
                ownerName: user?.name,
                image: imageUrl, 
                status: "approved", 
                rating: null,
                aiSafe: form.warning ? false : true, // primitive AI check map
                distance: "0.0 km", // Mock distance for newly added
                createdAt: new Date().toISOString(),
            });
            toast.success("Pesticide listed successfully! 🌱");
            setForm({ name: "", crop: "All", quantity: "", price: "", expiry: "", type: "buy", location: "", warning: "" });
            setImageFile(null); setImagePreview(null);
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
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 flex items-center justify-between rounded-t-3xl z-10">
                    <h2 className="text-xl font-black text-gray-900">List Pesticide / Fertilizer 🌿</h2>
                    <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition">
                        <MdClose className="h-5 w-5 text-gray-600" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">Product Name *</label>
                            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:outline-none" placeholder="e.g. Neem Oil" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">Target Crop *</label>
                            <select value={form.crop} onChange={e => setForm(f => ({ ...f, crop: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:outline-none bg-white">
                                {CROPS.filter(c => c !== "All").map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">Quantity/Volume *</label>
                            <input required value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:outline-none" placeholder="e.g. 500 ml" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">Expiry Date *</label>
                            <input type="date" required value={form.expiry} onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:outline-none" />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">Listing Type *</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: "buy", label: "💰 Sell", desc: "Set a price" },
                                { value: "share", label: "🤝 Share", desc: "Lend/Share" },
                                { value: "donate", label: "🌿 Donate", desc: "Give for free" },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                                    className={`p-3 rounded-xl border-2 text-center transition-all ${form.type === opt.value
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

                    {form.type === "buy" && (
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">Price (₹) *</label>
                            <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:outline-none" placeholder="e.g. 150" />
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1 flex justify-between">
                            <span>Location *</span>
                            <button type="button" onClick={handleGPS} className="text-green-600 text-xs font-bold hover:underline flex items-center gap-1">
                                <MdLocationOn className="h-3 w-3" /> Use GPS
                            </button>
                        </label>
                        <input required value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:outline-none" placeholder="e.g. Shirur, Pune" />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">Safety Warnings <span className="text-gray-400 font-normal">(optional)</span></label>
                        <textarea rows={2} value={form.warning} onChange={e => setForm(f => ({ ...f, warning: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:outline-none" placeholder="Any side effects or usage restrictions?" />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">Photo <span className="text-gray-400 font-normal">(optional)</span></label>
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
                                    <input type="file" accept="image/*" id="modal-img-upload-pest" className="hidden"
                                        onChange={e => {
                                            const f = e.target.files[0];
                                            if (!f) return;
                                            setImageFile(f);
                                            setImagePreview(URL.createObjectURL(f));
                                        }}
                                    />
                                    <label htmlFor="modal-img-upload-pest" className="cursor-pointer">
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
                        ) : "List Pesticide 🌿"}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

/* ─── Request / Checkout Modal ──────────────────────────── */
const RequestPesticideModal = ({ item, step, setStep, onClose, user, authUser }) => {
    if (!item) return null;

    const [processing, setProcessing] = useState(false);
    
    const handleConfirm = async () => {
        setProcessing(true);
        if (user) {
            try {
                // Sync to user's dashboard bookings
                await push(ref(db, "bookings"), {
                    equipmentId: item.id,
                    equipmentName: `🌿 ${item.name}`,
                    ownerId: item.ownerId || "mock",
                    ownerName: item.ownerName,
                    userId: authUser.uid,
                    userName: user.name || "Farmer",
                    startTime: new Date().toISOString(),
                    status: "pending",
                    category: "pending",
                    totalPrice: item.price > 0 ? Number(item.price) : 0,
                    listingType: item.type,
                    isPesticide: true,
                    createdAt: new Date().toISOString()
                });

                // Send notification to owner
                if (item.ownerId && item.ownerId !== "mock") {
                    await push(ref(db, `notifications/${item.ownerId}`), {
                        type: "pesticide_request",
                        message: `${user.name || "A farmer"} has requested your listing: ${item.name}. Please check your dashboard to approve.`,
                        createdAt: new Date().toISOString(),
                        read: false,
                    });
                }
            } catch (err) {
                console.error("Failed to sync transaction:", err);
            }
        }
        
        setTimeout(() => {
            setProcessing(false);
            setStep(2);
        }, 1500); // Simulate transaction
    };

    const handlePrint = () => {
        toast.success("Generating GST Invoice PDF...");
        generateGSTInvoice(
            { 
                id: Math.random().toString(36).substr(2, 9).toUpperCase(), 
                price: parseFloat(item.price) || 0, 
                equipmentName: item.name, 
                duration: item.quantity,
                createdAt: new Date().toISOString() 
            },
            { name: item.ownerName || "AgroShare Vendor", address: "Local Hub", state: "Maharashtra", gstin: "27AABCU9603R1Z2" },
            { name: user?.name || "Farmer", address: user?.village || "Local", state: "Maharashtra" }
        );
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
                {step === 0 && (
                    <>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-black text-gray-900">Request {item.type === "buy" ? "Purchase" : item.type === "share" ? "Share" : "Donation"}</h2>
                            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                                <MdClose className="text-xl text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="flex gap-4 items-center mb-6">
                                <img src={item.image} alt={item.name} className="w-20 h-20 rounded-2xl object-cover shadow-sm bg-gray-100" />
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                                    <p className="text-sm text-gray-500">{item.quantity} • By {item.ownerName}</p>
                                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><MdLocationOn className="text-green-500"/> {item.distance || "Near you"} away</p>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-semibold">Item Price</span>
                                    <span className="font-bold text-gray-900">{item.price > 0 ? `₹${item.price}` : "Free"}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-semibold">Platform Fee</span>
                                    <span className="font-bold text-gray-900">₹0 (Waived)</span>
                                </div>
                                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                                    <span className="font-bold text-gray-800">Total Amount</span>
                                    <span className="text-2xl font-black text-green-600">{item.price > 0 ? `₹${item.price}` : "Free"}</span>
                                </div>
                            </div>

                            <p className="text-xs text-gray-400 mt-4 text-center px-2">
                                By confirming, you agree to inspect the item and verify safety standards directly with the owner upon pickup.
                            </p>
                        </div>
                        <div className="p-6 border-t border-gray-100">
                            <button 
                                onClick={handleConfirm}
                                disabled={processing}
                                className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${processing ? "bg-green-400" : "bg-green-600 hover:bg-green-700"}`}>
                                {processing ? (
                                    <><svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Processing...</>
                                ) : item.price > 0 ? `Pay Securely ₹${item.price}` : "Confirm Request" }
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center text-4xl mb-4 animate-[bounce_0.5s_ease-in-out_1.5]">
                            <MdHourglassEmpty />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">Request Pending!</h2>
                        <p className="text-gray-500 mb-6 px-4">
                            You've officially requested <strong>{item.name}</strong> from {item.ownerName}. The owner must approve this request before pickup. Here is your request slip.
                        </p>
                        
                        {/* Invoice Preview */}
                        <div className="w-full bg-white border border-gray-200 rounded-2xl p-5 text-left mb-6 shadow-sm print:shadow-none print:border-black" id="print-invoice-section">
                            <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-3 print:border-black">
                                <div>
                                    <h4 className="font-black text-gray-800 text-lg">AgroShare Request Slip</h4>
                                    <p className="text-xs text-gray-400">Order ID: #{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-gray-500">Date: {new Date().toLocaleDateString()}</p>
                                    <p className="text-xs font-bold text-amber-600">Status: PENDING APPROVAL</p>
                                </div>
                            </div>
                            <div className="space-y-1 mb-4">
                                <p className="text-sm"><span className="font-semibold text-gray-600">Item:</span> {item.name} ({item.quantity})</p>
                                <p className="text-sm"><span className="font-semibold text-gray-600">Seller:</span> {item.ownerName}</p>
                                <p className="text-sm"><span className="font-semibold text-gray-600">Buyer:</span> {user?.name || "Farmer"}</p>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 print:bg-white print:border-black">
                                <span className="font-bold text-gray-700">Amount Settled</span>
                                <span className="font-black text-green-700 text-lg">{item.price > 0 ? `₹${item.price}` : "FREE"}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 w-full">
                            <button onClick={handlePrint} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                                <MdPrint className="text-xl" /> Print Receipt
                            </button>
                            <button onClick={onClose} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors">
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};


const PesticideExchange = () => {
    const { user, authUser } = useAuthStore();
    const [search, setSearch] = useState("");
    const [filterCrop, setFilterCrop] = useState("All");
    const [filterType, setFilterType] = useState("All");
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Checkout states
    const [requestItem, setRequestItem] = useState(null);
    const [checkoutStep, setCheckoutStep] = useState(0);

    // State for firebase listings
    const [dbListings, setDbListings] = useState([]);

    useEffect(() => {
        const unsub = onValue(ref(db, "pesticides"), (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                const items = Object.keys(data).map(k => ({
                    id: k,
                    ...data[k]
                }));
                setDbListings(items);
            } else {
                setDbListings([]);
            }
        });
        return () => unsub();
    }, []);

    const getExpiryStatus = (dateStr) => {
        if (!dateStr) return { label: "Unknown", color: "bg-gray-100 text-gray-700 border-gray-200" };
        const exp = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: "Expired", color: "bg-red-100 text-red-700 border-red-200" };
        if (diffDays < 60) return { label: "Near Expiry", color: "bg-orange-100 text-orange-700 border-orange-200" };
        return { label: "Safe", color: "bg-green-100 text-green-700 border-green-200" };
    };

    // Combine mock data and database listings
    const allListings = [...dbListings.reverse(), ...MOCK_LISTINGS];

    const filteredListings = allListings.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || (item.crop && item.crop.toLowerCase().includes(search.toLowerCase()));
        const matchCrop = filterCrop === "All" || item.crop === filterCrop;
        const matchType = filterType === "All" || item.type === filterType;
        return matchSearch && matchCrop && matchType;
    });

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-12">
            <AddPesticideModal open={showAddModal} onClose={() => setShowAddModal(false)} authUser={authUser} user={user} />
            <RequestPesticideModal item={requestItem} step={checkoutStep} setStep={setCheckoutStep} onClose={() => setRequestItem(null)} user={user} authUser={authUser} />
            
            {/* Header / Hero */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
                <div className="bg-gradient-to-br from-emerald-800 to-green-900 rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <FaLeaf className="text-9xl" />
                    </div>
                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 border border-white/30 backdrop-blur-md text-sm font-bold mb-4">
                            <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                            Smart Marketplace
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight mb-4">
                            Agro <span className="text-green-400">Exchange</span>
                        </h1>
                        <p className="text-green-100 text-lg max-w-2xl leading-relaxed mb-8">
                            A circular economy platform to safely buy, sell, or donate unused agricultural chemicals. Reduce waste, save money, and farm sustainably.
                        </p>
                        
                        {/* Search & Quick Filters */}
                        <div className="flex flex-col md:flex-row gap-4 max-w-3xl">
                            <div className="relative flex-1">
                                <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                                <input 
                                    type="text" 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search pesticides for your crop..." 
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl text-gray-900 font-medium focus:outline-none focus:ring-4 ring-green-500/30"
                                />
                            </div>
                            <button onClick={() => {
                                if (!user) toast.error("Please login to list items.");
                                else setShowAddModal(true);
                            }} className="px-6 py-4 bg-green-500 hover:bg-green-400 text-white font-bold rounded-2xl shadow-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
                                <MdAddCircle className="text-xl" /> List Pesticide
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Horizontal Filters Section */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-8">
                        {/* Crop Filter */}
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Filter by Crop</label>
                            <div className="flex flex-wrap gap-2">
                                {CROPS.map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => setFilterCrop(c)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filterCrop === c ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-gray-50 text-gray-500 border-transparent hover:border-green-300'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider for Desktop */}
                        <div className="hidden md:block w-px h-10 bg-gray-100 mx-2" />

                        {/* Listing Type Filter */}
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Listing Type</label>
                            <div className="flex flex-wrap gap-2">
                                {TYPES.map(t => (
                                    <button 
                                        key={t.id}
                                        onClick={() => setFilterType(t.id)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${filterType === t.id ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-gray-50 text-gray-500 border-transparent hover:border-gray-300'}`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Feed - Now Full Width */}
                <div className="space-y-6">
                        
  

                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Available Near You</h2>
                            <span className="text-sm font-semibold text-gray-500">{filteredListings.length} items found</span>
                        </div>

                        {/* Listings Grid - More compact 3-column layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            <AnimatePresence>
                                {filteredListings.map(item => {
                                    const expStatus = getExpiryStatus(item.expiry);
                                    return (
                                        <motion.div 
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            key={item.id} 
                                            className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-green-200 transition-all overflow-hidden group flex flex-col"
                                        >
                                            <div className="relative h-40 overflow-hidden bg-gray-100">
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                
                                                {/* Top Badges */}
                                                <div className="absolute top-3 left-3 flex flex-col gap-2">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md flex items-center gap-1 ${expStatus.color}`}>
                                                        {expStatus.label}
                                                    </span>
                                                    {!item.aiSafe && (
                                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 backdrop-blur-md flex items-center gap-1 shadow-sm">
                                                            <MdWarning /> Use Caution
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {/* Type Badge */}
                                                <div className="absolute top-3 right-3">
                                                    <span className={`shadow-md px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-white ${
                                                        item.type === 'buy' ? 'bg-blue-600' :
                                                        item.type === 'share' ? 'bg-purple-600' : 'bg-emerald-600'
                                                    }`}>
                                                        {item.type}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-5 flex-1 flex flex-col">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{item.name}</h3>
                                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                                            <span className="bg-gray-100 px-2 py-0.5 rounded-lg font-semibold">{item.crop}</span>
                                                            <span className="flex items-center gap-1"><FaBug className="text-gray-400"/> {item.quantity}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {item.warning && (
                                                    <p className="text-xs font-semibold text-amber-700 bg-amber-50 p-2 rounded-lg mt-2 mb-3 leading-snug">
                                                        {item.warning}
                                                    </p>
                                                )}

                                                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                                                    <div>
                                                        {item.price > 0 ? (
                                                            <p className="text-lg font-bold text-green-700">₹{item.price}</p>
                                                        ) : (
                                                            <p className="text-lg font-bold text-emerald-600">FREE</p>
                                                        )}
                                                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 font-bold">
                                                            <MdLocationOn className="text-green-500"/> {item.distance || "Near you"}
                                                        </p>
                                                    </div>
                                                    
                                                    <div className="flex gap-2">
                                                        <button className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center transition-colors">
                                                            <MdInfo className="text-xl" />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                if (!user) toast.error("Please login to request items.");
                                                                else { setRequestItem(item); setCheckoutStep(0); }
                                                            }}
                                                            className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition-transform active:scale-95 shadow-md">
                                                            Request
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                            
                            {filteredListings.length === 0 && (
                                <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-gray-100">
                                    <div className="text-4xl mb-4">🌱</div>
                                    <h3 className="text-lg font-bold text-gray-900">No pesticides found</h3>
                                    <p className="text-gray-500 text-sm mt-1">Try adjusting your filters or crop selection.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
};

export default PesticideExchange;
