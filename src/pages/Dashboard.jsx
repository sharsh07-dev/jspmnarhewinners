import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { db } from "../firebase";
import { ref, onValue, push, set, remove } from "firebase/database";
import { compressAndUpload } from "../services/cloudinary";
import { suggestPrice } from "../utils/priceSuggestion";
import { getUserLocation, reverseGeocode } from "../utils/geo";
import { getBookingCategory } from "../utils/geo";
import toast from "react-hot-toast";
import {
    MdHistory, MdList, MdAddCircle, MdTrendingUp,
    MdPerson, MdLocationOn, MdDelete, MdClose,
    MdCheckCircle, MdHourglassEmpty, MdCancel,
    MdNotifications, MdAccessTime, MdShoppingCart,
    MdPhone, MdMessage, MdInbox, MdDone, MdReceipt, MdDownload, MdLightbulb,
    MdReportProblem, MdVideoCall, MdVerifiedUser, MdHistoryEdu
} from "react-icons/md";
import { generateGSTInvoice } from "../utils/invoiceGenerator";
import DamageReportModal from "../components/DamageReportModal";
import { FaTractor } from "react-icons/fa";
import { format, isAfter, isBefore, parseISO } from "date-fns";

const TABS = [
    { id: "overview", label: "Overview", icon: <MdTrendingUp /> },
    { id: "bookings", label: "My Bookings", icon: <MdHistory /> },
    { id: "received", label: "Received Bookings", icon: <MdInbox /> },
    { id: "invoices", label: "Fin & Invoices", icon: <MdReceipt /> },
    { id: "listings", label: "My Listings", icon: <MdList /> },
    { id: "add", label: "Add Equipment", icon: <MdAddCircle /> },
    { id: "notifs", label: "Notifications", icon: <MdNotifications /> },
];

const EQUIPMENT_TYPES = ["Tractor", "Harvester", "Sprayer", "Rotavator", "Plough", "Tools"];

const BOOKING_STATUS_TABS = [
    { id: "all", label: "All" },
    { id: "upcoming", label: "⏰ Upcoming" },
    { id: "ongoing", label: "🟢 Ongoing" },
    { id: "completed", label: "✅ Completed" },
    { id: "cancelled", label: "❌ Cancelled" },
];

const statusBadge = {
    upcoming: "bg-blue-50 text-blue-700 border-blue-200",
    ongoing: "bg-green-50 text-green-700 border-green-200",
    completed: "bg-purple-50 text-purple-700 border-purple-200",
    cancelled: "bg-red-50 text-red-600 border-red-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const Dashboard = () => {
    const { user, authUser } = useAuthStore();
    const [tab, setTab] = useState("overview");
    const [myBookings, setMyBookings] = useState([]);
    const [myEquipment, setMyEquipment] = useState([]);
    const [ownerBookings, setOwnerBookings] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [bookingStatusTab, setBookingStatusTab] = useState("all");
    const [selectedBookingForDamage, setSelectedBookingForDamage] = useState(null);

    // Add Equipment form
    const [form, setForm] = useState({
        name: "", type: "Tractor", price: "", salePrice: "",
        location: "", description: "", listingType: "rent",
        contactPhone: "", contactName: "", contactAddress: ""
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [priceSuggestion, setPriceSuggestion] = useState(null);

    useEffect(() => {
        if (!authUser) return;

        // Bookings
        const bRef = ref(db, "bookings");
        const ubSub = onValue(bRef, (snap) => {
            const data = snap.val() || {};
            const all = Object.keys(data).map(k => ({ id: k, ...data[k] }));
            setMyBookings(all.filter(b => b.userId === authUser.uid));
            setOwnerBookings(all.filter(b => b.ownerId === authUser.uid));
        });

        // Equipment
        const eSub = onValue(ref(db, "equipment"), (snap) => {
            const data = snap.val() || {};
            setMyEquipment(
                Object.keys(data).map(k => ({ id: k, ...data[k] }))
                    .filter(e => e.ownerId === authUser.uid)
            );
        });

        // Notifications
        const nSub = onValue(ref(db, `notifications/${authUser.uid}`), (snap) => {
            if (snap.exists()) {
                const items = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
                setNotifications(items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            } else setNotifications([]);
        });

        return () => { ubSub(); eSub(); nSub(); };
    }, [authUser]);

    const handleTypeChange = (type) => {
        setForm(f => ({ ...f, type }));
        setPriceSuggestion(suggestPrice(type));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleGetMyLocation = async () => {
        try {
            const loc = await getUserLocation();
            const address = await reverseGeocode(loc.lat, loc.lng);
            setForm(f => ({ ...f, location: address, lat: loc.lat, lng: loc.lng }));
            toast.success(`📍 ${address}`);
        } catch {
            toast.error("Could not get location");
        }
    };

    const handleAddEquipment = async (e) => {
        e.preventDefault();
        const needsRent = form.listingType === "rent" || form.listingType === "both";
        const needsSell = form.listingType === "sell" || form.listingType === "both";
        if (!form.name || !form.location) { toast.error("Fill all required fields"); return; }
        if (needsRent && !form.price) { toast.error("Enter rental price/hr"); return; }
        if (needsSell && !form.salePrice) { toast.error("Enter sale price"); return; }

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
                contactPhone: form.contactPhone || user?.phone || "",
                contactName: form.contactName || user?.name || "",
                contactAddress: form.contactAddress || "",
                ownerId: authUser.uid,
                ownerName: user?.name,
                imageUrl, status: "approved", rating: null,
                createdAt: new Date().toISOString(),
            });
            // Notify owner
            await push(ref(db, `notifications/${authUser.uid}`), {
                type: "listing",
                message: `Your equipment "${form.name}" has been listed successfully! 🚜`,
                createdAt: new Date().toISOString(),
                read: false,
            });
            toast.success("Equipment listed successfully! 🎉");
            setForm({ name: "", type: "Tractor", price: "", salePrice: "", location: "", description: "", listingType: "rent", contactPhone: "", contactName: "", contactAddress: "" });
            setImageFile(null); setImagePreview(null); setPriceSuggestion(null);
            setTab("listings");
        } catch (err) {
            const msg = err?.message || "Upload failed";
            toast.error(`❌ ${msg}`, { duration: 6000 });
            console.error("Equipment add error:", err);
        } finally {
            setUploading(false);
        }
    };

    const handleCancelBooking = async (bookingId, equipName) => {
        await set(ref(db, `bookings/${bookingId}/status`), "cancelled");
        // Notify
        await push(ref(db, `notifications/${authUser.uid}`), {
            type: "booking_cancelled",
            message: `Your booking for "${equipName}" has been cancelled.`,
            createdAt: new Date().toISOString(),
            read: false,
        });
        toast.success("Booking cancelled");
    };

    const handleDeleteEquipment = async (eqId) => {
        if (!confirm("Delete this listing?")) return;
        await remove(ref(db, `equipment/${eqId}`));
        toast.success("Equipment removed");
    };

    const markAllRead = async () => {
        for (const n of notifications.filter(n => !n.read)) {
            await set(ref(db, `notifications/${authUser.uid}/${n.id}/read`), true);
        }
    };

    const totalEarnings = ownerBookings
        .filter(b => b.status === "completed")
        .reduce((s, b) => s + (b.totalPrice || 0), 0);

    const pendingOwnerBookings = ownerBookings.filter(b => b.status === "pending");
    const unreadCount = notifications.filter(n => !n.read).length;

    // Booking categories
    const categorizedBookings = myBookings.map(b => ({
        ...b, _category: getBookingCategory(b)
    }));

    const filteredBookings = bookingStatusTab === "all"
        ? categorizedBookings
        : categorizedBookings.filter(b => b._category === bookingStatusTab);

    return (
        <div className="min-h-screen bg-gray-50 pt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* ─── Sidebar ─── */}
                    <aside className="lg:w-64 flex-shrink-0">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4 text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl shadow-green">👨‍🌾</div>
                            <p className="font-bold text-gray-900">{user?.name}</p>
                            <p className="text-sm text-gray-500 capitalize">{user?.role} · {user?.village}</p>
                            <span className="badge badge-green mt-2">✓ Verified</span>
                        </div>

                        <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {TABS.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTab(t.id)}
                                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm font-semibold transition-all duration-200 ${tab === t.id ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"
                                        }`}
                                >
                                    <span className="text-xl">{t.icon}</span>
                                    {t.label}
                                    {t.id === "notifs" && unreadCount > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadCount}</span>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* ─── Main ─── */}
                    <main className="flex-1 min-w-0">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={tab}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* ─ OVERVIEW ─ */}
                                {tab === "overview" && (
                                    <div className="space-y-6">
                                        <h2 className="text-2xl font-black text-gray-900 font-display">
                                            Welcome back, {user?.name?.split(" ")[0]}! 👋
                                        </h2>

                                        {/* Stats */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[
                                                { label: "Total Bookings", value: myBookings.length, color: "bg-blue-50 text-blue-700" },
                                                { label: "Upcoming", value: categorizedBookings.filter(b => b._category === "upcoming").length, color: "bg-yellow-50 text-yellow-700" },
                                                { label: "My Listings", value: myEquipment.length, color: "bg-purple-50 text-purple-700" },
                                                { label: "Earnings", value: `₹${totalEarnings}`, color: "bg-green-50 text-green-700" },
                                            ].map((s, i) => (
                                                <motion.div key={i} whileHover={{ y: -4 }} className={`rounded-2xl p-5 ${s.color}`}>
                                                    <p className="text-2xl font-black">{s.value}</p>
                                                    <p className="text-xs font-semibold mt-1 opacity-70">{s.label}</p>
                                                </motion.div>
                                            ))}
                                        </div>

                                        {/* Pending bookings on owner's equipment */}
                                        {pendingOwnerBookings.length > 0 && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                                                <h3 className="font-bold text-amber-900 mb-3">⏳ {pendingOwnerBookings.length} Pending Booking Request{pendingOwnerBookings.length > 1 ? "s" : ""}</h3>
                                                <div className="space-y-3">
                                                    {pendingOwnerBookings.map(b => (
                                                        <div key={b.id} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                                                            <div>
                                                                <p className="font-semibold text-sm text-gray-900">{b.equipmentName}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {b.startTime ? format(new Date(b.startTime), "MMM dd · HH:mm") : b.date} {b.duration ? `· ${b.duration}h ` : ""}· ₹{b.totalPrice}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={async () => {
                                                                    await set(ref(db, `bookings/${b.id}/status`), "upcoming");
                                                                    await push(ref(db, `notifications/${b.userId}`), {
                                                                        type: "booking_upcoming",
                                                                        message: `Your booking for "${b.equipmentName}" has been verified and is now Upcoming! ✅`,
                                                                        createdAt: new Date().toISOString(), read: false,
                                                                    });
                                                                    toast.success("Booking verified — marked Upcoming ✓");
                                                                }} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition">
                                                                    Verify & Confirm ✓
                                                                </button>
                                                                <button onClick={async () => {
                                                                    await set(ref(db, `bookings/${b.id}/status`), "cancelled");
                                                                    await push(ref(db, `notifications/${b.userId}`), {
                                                                        type: "booking_rejected",
                                                                        message: `Your booking for "${b.equipmentName}" was declined.`,
                                                                        createdAt: new Date().toISOString(), read: false,
                                                                    });
                                                                    toast.success("Booking rejected");
                                                                }} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 border border-red-200 transition">
                                                                    Decline
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Recent bookings */}
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-bold text-gray-900">Recent Activity</h3>
                                                <button onClick={() => setTab("bookings")} className="text-green-600 text-sm font-semibold hover:underline">View all →</button>
                                            </div>
                                            {myBookings.slice(0, 4).length === 0 ? (
                                                <p className="text-gray-400 text-sm py-4 text-center">No bookings yet</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {myBookings.slice(0, 4).map(b => {
                                                        const cat = getBookingCategory(b);
                                                        return (
                                                            <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                                <div>
                                                                    <p className="font-semibold text-sm text-gray-900">{b.equipmentName}</p>
                                                                    <p className="text-xs text-gray-400">
                                                                        {b.startTime ? format(new Date(b.startTime), "MMM dd, yyyy · HH:mm") : b.date}
                                                                    </p>
                                                                </div>
                                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${statusBadge[cat] || statusBadge.pending}`}>{cat}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ─ BOOKINGS ─ */}
                                {tab === "bookings" && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                        <h2 className="text-xl font-bold text-gray-900 mb-4">My Bookings</h2>

                                        {/* Status tabs */}
                                        <div className="flex gap-2 flex-wrap mb-5 bg-gray-50 rounded-2xl p-1.5">
                                            {BOOKING_STATUS_TABS.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setBookingStatusTab(t.id)}
                                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${bookingStatusTab === t.id
                                                        ? "bg-white text-gray-900 shadow-sm"
                                                        : "text-gray-500 hover:text-gray-700"
                                                        }`}
                                                >
                                                    {t.label}
                                                    <span className="ml-1.5 text-xs text-gray-400">
                                                        ({t.id === "all" ? categorizedBookings.length : categorizedBookings.filter(b => b._category === t.id).length})
                                                    </span>
                                                </button>
                                            ))}
                                        </div>

                                        {filteredBookings.length === 0 ? (
                                            <div className="text-center py-16">
                                                <span className="text-5xl block mb-3">📅</span>
                                                <p className="text-gray-400">No {bookingStatusTab !== "all" ? bookingStatusTab : ""} bookings found</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {filteredBookings.map(b => (
                                                    <motion.div
                                                        key={b.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className={`border rounded-2xl p-5 transition-all ${b._category === "ongoing"
                                                            ? "border-green-300 bg-green-50"
                                                            : "border-gray-100 hover:border-green-200"
                                                            }`}
                                                    >
                                                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                                                            <div className="flex items-start gap-3">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mt-0.5 ${b._category === "ongoing" ? "bg-green-200" : "bg-gray-100"
                                                                    }`}>
                                                                    🚜
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-900">{b.equipmentName}</p>
                                                                    <p className="text-sm text-gray-500 mt-0.5">
                                                                        {b.startTime
                                                                            ? `${format(new Date(b.startTime), "MMM dd, yyyy • HH:mm")}${b.endTime ? ` – ${format(new Date(b.endTime), "HH:mm")}` : ""}`
                                                                            : b.date
                                                                        }
                                                                    </p>
                                                                    <p className="text-sm text-gray-500">{b.duration ? `${b.duration}h · ` : ""}<span className="font-bold text-green-700">₹{b.totalPrice}</span></p>
                                                                    {b._category === "ongoing" && (
                                                                        <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live Now
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-start gap-2 flex-wrap">
                                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${statusBadge[b._category] || statusBadge.pending}`}>
                                                                    {b._category}
                                                                </span>
                                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${statusBadge[b.status] || statusBadge.pending}`}>
                                                                    {b.status}
                                                                </span>
                                                                {(b.status === "pending" || b._category === "upcoming") && (
                                                                    <button
                                                                        onClick={() => handleCancelBooking(b.id, b.equipmentName)}
                                                                        className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-50 transition"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ─ RECEIVED BOOKINGS (Owner's Incoming) ─ */}
                                {tab === "received" && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h2 className="text-xl font-bold text-gray-900">Received Bookings</h2>
                                            <div className="flex gap-2">
                                                {["all", "pending", "upcoming", "confirmed", "completed", "cancelled"].map(s => (
                                                    <button key={s} onClick={() => setBookingStatusTab(s)}
                                                        className={`px-3 py-1 rounded-xl text-xs font-bold border capitalize transition-all ${bookingStatusTab === s ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-500 hover:border-green-400"}`}>
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {ownerBookings.length === 0 ? (
                                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
                                                <span className="text-6xl block mb-4">📭</span>
                                                <p className="text-gray-500 font-semibold text-lg">No bookings received yet</p>
                                                <p className="text-gray-400 text-sm mt-1">Once farmers book your equipment, they'll appear here.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {ownerBookings
                                                    .filter(b => bookingStatusTab === "all" || b.status === bookingStatusTab)
                                                    .map(b => (
                                                        <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                                            {/* Status bar */}
                                                            <div className={`h-1.5 w-full ${b.status === "pending" ? "bg-yellow-400" :
                                                                b.status === "upcoming" ? "bg-blue-500" :
                                                                    b.status === "confirmed" ? "bg-indigo-500" :
                                                                        b.status === "completed" ? "bg-purple-500" :
                                                                            "bg-red-400"
                                                                }`} />
                                                            <div className="p-5">
                                                                {/* Header */}
                                                                <div className="flex items-start justify-between mb-4">
                                                                    <div>
                                                                        <h3 className="font-bold text-gray-900 text-base">{b.equipmentName}</h3>
                                                                        <p className="text-sm text-gray-500 mt-0.5">
                                                                            {b.startTime
                                                                                ? `${format(new Date(b.startTime), "MMM dd, yyyy • HH:mm")}${b.endTime ? ` – ${format(new Date(b.endTime), "HH:mm")}` : ""}`
                                                                                : b.date
                                                                            } · {b.duration}h
                                                                        </p>
                                                                    </div>
                                                                    <span className={`text-xs font-bold px-3 py-1 rounded-full border capitalize ${statusBadge[b.status] || statusBadge.pending}`}>
                                                                        {b.status}
                                                                    </span>
                                                                </div>

                                                                {/* Booking Details Grid */}
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 bg-gray-50 rounded-xl p-4">
                                                                    <div>
                                                                        <p className="text-xs text-gray-400 font-medium">Booked By</p>
                                                                        <p className="font-semibold text-gray-800 text-sm mt-0.5">{b.userName || "Farmer"}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-gray-400 font-medium">Duration</p>
                                                                        <p className="font-semibold text-gray-800 text-sm mt-0.5">{b.duration} hours</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-gray-400 font-medium">Total Amount</p>
                                                                        <p className="font-bold text-green-700 text-sm mt-0.5">₹{b.totalPrice}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-gray-400 font-medium">Booked On</p>
                                                                        <p className="font-semibold text-gray-800 text-sm mt-0.5">
                                                                            {b.createdAt ? format(new Date(b.createdAt), "MMM dd, yyyy") : "—"}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Contact Strip */}
                                                                {b.userPhone && (
                                                                    <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                                                        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                                            <MdPhone className="h-5 w-5 text-blue-600" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs text-blue-500 font-medium">Booker's Contact</p>
                                                                            <p className="font-bold text-blue-900 text-sm">{b.userPhone}</p>
                                                                            {b.userAddress && <p className="text-xs text-blue-600 truncate mt-0.5">{b.userAddress}</p>}
                                                                        </div>
                                                                        <div className="flex gap-2 flex-shrink-0">
                                                                            <a href={`tel:${b.userPhone}`}
                                                                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition">
                                                                                <MdPhone className="h-3.5 w-3.5" /> Call
                                                                            </a>
                                                                            <a href={`https://wa.me/91${String(b.userPhone || "").replace(/[^0-9]/g, '')}`}
                                                                                target="_blank" rel="noreferrer"
                                                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition">
                                                                                <MdMessage className="h-3.5 w-3.5" /> WhatsApp
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Status Action Buttons */}
                                                                <div className="flex gap-3 flex-wrap items-center">
                                                                    {b.status === "pending" && (
                                                                        <>
                                                                            <button onClick={async () => {
                                                                                await set(ref(db, `bookings/${b.id}/status`), "upcoming");
                                                                                await push(ref(db, `notifications/${b.userId}`), {
                                                                                    type: "booking_upcoming",
                                                                                    message: `Your booking for "${b.equipmentName}" has been verified! It is now Upcoming. ⏰`,
                                                                                    createdAt: new Date().toISOString(), read: false,
                                                                                });
                                                                                toast.success("Marked as Upcoming ✓");
                                                                            }} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition">
                                                                                <MdCheckCircle className="h-4 w-4" /> Verify & Mark Upcoming
                                                                            </button>
                                                                            <button onClick={async () => {
                                                                                await set(ref(db, `bookings/${b.id}/status`), "cancelled");
                                                                                await push(ref(db, `notifications/${b.userId}`), {
                                                                                    type: "booking_rejected",
                                                                                    message: `Your booking for "${b.equipmentName}" was declined by the owner.`,
                                                                                    createdAt: new Date().toISOString(), read: false,
                                                                                });
                                                                                toast.success("Booking declined");
                                                                            }} className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-xl hover:bg-red-100 border border-red-200 transition">
                                                                                <MdCancel className="h-4 w-4" /> Decline
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {b.status === "upcoming" && (
                                                                        <button onClick={async () => {
                                                                            await set(ref(db, `bookings/${b.id}/status`), "confirmed");
                                                                            await push(ref(db, `notifications/${b.userId}`), {
                                                                                type: "booking_confirmed",
                                                                                message: `Your booking for "${b.equipmentName}" has been confirmed by the owner! 🎉`,
                                                                                createdAt: new Date().toISOString(), read: false,
                                                                            });
                                                                            toast.success("Booking confirmed ✓");
                                                                        }} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition">
                                                                            <MdCheckCircle className="h-4 w-4" /> Confirm Receipt
                                                                        </button>
                                                                    )}
                                                                    {b.status === "confirmed" && (
                                                                        <button onClick={async () => {
                                                                            await set(ref(db, `bookings/${b.id}/status`), "completed");
                                                                            await push(ref(db, `notifications/${b.userId}`), {
                                                                                type: "booking_completed",
                                                                                message: `Your booking for "${b.equipmentName}" has been marked as completed. Thank you! 🌾`,
                                                                                createdAt: new Date().toISOString(), read: false,
                                                                            });
                                                                            toast.success("Booking completed ✓");
                                                                        }} className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition">
                                                                            <MdDone className="h-4 w-4" /> Mark as Completed
                                                                        </button>
                                                                    )}
                                                                    {b.status === "completed" && (
                                                                        <div className="flex flex-col gap-2">
                                                                            <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                                                                                ✅ Booking Completed
                                                                            </span>
                                                                            {!b.damageReported ? (
                                                                                <button 
                                                                                    onClick={() => setSelectedBookingForDamage(b)}
                                                                                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 border border-red-200 transition"
                                                                                >
                                                                                    <MdReportProblem /> Report Damage
                                                                                </button>
                                                                            ) : (
                                                                                <span className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-600 text-[10px] font-black uppercase rounded-xl border border-amber-200">
                                                                                    Claim Under Review 🛡️
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {b.status === "cancelled" && (
                                                                        <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl bg-red-50 text-red-600 border border-red-200">
                                                                            ❌ Booking Declined
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ─ LISTINGS ─ */}
                                {tab === "listings" && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-xl font-bold text-gray-900">My Listings ({myEquipment.length})</h2>
                                            <button onClick={() => setTab("add")} className="btn-primary text-sm py-2">+ Add New</button>
                                        </div>
                                        {myEquipment.length === 0 ? (
                                            <div className="text-center py-16">
                                                <FaTractor className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                                                <p className="text-gray-400">No listings yet.</p>
                                                <button onClick={() => setTab("add")} className="btn-primary mt-4">+ List Equipment</button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {myEquipment.map(eq => (
                                                    <div key={eq.id} className="rounded-2xl border border-gray-100 overflow-hidden hover:border-green-200 transition-colors">
                                                        <div className="relative h-40 bg-gray-100">
                                                            <img
                                                                src={eq.imageUrl || "https://images.unsplash.com/photo-1592982537447-6f23dbdc7e90?auto=format&fit=crop&w=400&q=60"}
                                                                className="w-full h-full object-cover" loading="lazy"
                                                            />
                                                            <div className="absolute top-2 left-2 flex gap-1">
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${eq.status === "approved" ? "bg-green-500 text-white" : "bg-yellow-400 text-white"}`}>
                                                                    {eq.status || "pending"}
                                                                </span>
                                                                {eq.listingType === "sell" && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">Sale</span>}
                                                                {eq.listingType === "both" && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500 text-white">Rent+Sell</span>}
                                                            </div>
                                                            <button onClick={() => handleDeleteEquipment(eq.id)} className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600">
                                                                <MdDelete className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <div className="p-4">
                                                            <p className="font-bold text-gray-900 truncate">{eq.name}</p>
                                                            <p className="text-sm text-gray-500">{eq.type}</p>
                                                            <div className="flex gap-3 mt-1">
                                                                {eq.price > 0 && <p className="font-black text-green-700 text-sm">₹{eq.price}/hr</p>}
                                                                {eq.salePrice && <p className="font-black text-orange-600 text-sm">₹{eq.salePrice} sell</p>}
                                                            </div>
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                {ownerBookings.filter(b => b.equipmentId === eq.id).length} booking(s)
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ─ ADD EQUIPMENT ─ */}
                                {tab === "add" && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
                                        <h2 className="text-xl font-bold text-gray-900 mb-6">List New Equipment 🌾</h2>
                                        <form onSubmit={handleAddEquipment} className="space-y-5">

                                            {/* Listing Type */}
                                            <div>
                                                <label className="label">Listing Type *</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[
                                                        { value: "rent", label: "🕐 For Rent", desc: "Hourly rental" },
                                                        { value: "sell", label: "🏷️ For Sale", desc: "One-time sale" },
                                                        { value: "both", label: "🤝 Both", desc: "Rent & Sell" },
                                                    ].map(opt => (
                                                        <button key={opt.value} type="button"
                                                            onClick={() => setForm(f => ({ ...f, listingType: opt.value }))}
                                                            className={`p-3 rounded-xl border-2 text-center transition-all ${form.listingType === opt.value ? "border-green-500 bg-green-50 text-green-800" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                                                            <div className="font-bold text-sm">{opt.label}</div>
                                                            <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="label">Equipment Name *</label>
                                                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="e.g. Mahindra 575 DI" />
                                                </div>
                                                <div>
                                                    <label className="label">Equipment Type *</label>
                                                    <select value={form.type} onChange={e => handleTypeChange(e.target.value)} className="input-field">
                                                        {EQUIPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Rent price */}
                                            {(form.listingType === "rent" || form.listingType === "both") && (
                                                <div>
                                                    <label className="label flex justify-between">
                                                        <span>Rental Price per Hour (₹) *</span>
                                                        {priceSuggestion && (
                                                            <button type="button" onClick={() => setForm(f => ({ ...f, price: priceSuggestion.suggested }))}
                                                                className="text-green-600 text-xs font-bold hover:underline">
                                                                AI: ₹{priceSuggestion.suggested} (×{priceSuggestion.demand} seasonal)
                                                            </button>
                                                        )}
                                                    </label>
                                                    <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="input-field" placeholder="e.g. 250" />
                                                </div>
                                            )}

                                            {/* Sale price */}
                                            {(form.listingType === "sell" || form.listingType === "both") && (
                                                <div>
                                                    <label className="label">Sale Price (₹) *</label>
                                                    <input type="number" min="0" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} className="input-field" placeholder="e.g. 450000" />
                                                </div>
                                            )}

                                            <div>
                                                <label className="label flex justify-between">
                                                    <span>Location *</span>
                                                    <button type="button" onClick={handleGetMyLocation} className="text-green-600 text-xs font-bold hover:underline flex items-center gap-1">
                                                        <MdLocationOn className="h-3 w-3" /> Use GPS (auto address)
                                                    </button>
                                                </label>
                                                <input required value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="input-field" placeholder="e.g. Shirur, Pune" />
                                            </div>

                                            <div>
                                                <label className="label">Description</label>
                                                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" placeholder="Condition, accessories, working hours, etc." />
                                            </div>

                                            {/* Contact Details */}
                                            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-4">
                                                <p className="text-sm font-bold text-blue-800 flex items-center gap-2">
                                                    <MdPhone className="h-4 w-4" /> Contact Details (visible to bookers)
                                                </p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="label">Contact Name</label>
                                                        <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className="input-field" placeholder={user?.name || "Your full name"} />
                                                    </div>
                                                    <div>
                                                        <label className="label">Contact Phone *</label>
                                                        <input required value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} type="tel" className="input-field" placeholder={user?.phone || "e.g. 9876543210"} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="label">Address / Village</label>
                                                    <input value={form.contactAddress} onChange={e => setForm(f => ({ ...f, contactAddress: e.target.value }))} className="input-field" placeholder="e.g. Shirur, Pune, Maharashtra" />
                                                </div>
                                            </div>

                                            {/* Photo */}
                                            <div>
                                                <label className="label">Equipment Photo <span className="text-gray-400 font-normal">(optional)</span></label>
                                                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-green-400 transition-colors">
                                                    {imagePreview ? (
                                                        <div className="relative">
                                                            <img src={imagePreview} className="h-40 w-full object-cover rounded-xl" />
                                                            <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                                                                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                                                                <MdClose className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="img-upload" />
                                                            <label htmlFor="img-upload" className="cursor-pointer">
                                                                <span className="text-3xl block mb-2">📷</span>
                                                                <p className="text-sm text-gray-500">Click to upload (auto-compressed)</p>
                                                                <p className="text-xs text-gray-400 mt-1">JPG, PNG up to 10MB · Cloudinary</p>
                                                            </label>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <button type="submit" disabled={uploading}
                                                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-green ${uploading ? "bg-green-300 text-white cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"}`}
                                            >
                                                {uploading ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                                                        Uploading & Saving...
                                                    </span>
                                                ) : "List Equipment 🌾"}
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {/* ─ FIN & INVOICES ─ */}
                                {tab === "invoices" && (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-gray-900">Financials & GST Invoices</h2>
                                                <p className="text-sm text-gray-500 mt-1">Legally compliant GST reporting platform.</p>
                                            </div>
                                            <button 
                                                onClick={() => toast("🤖 xAI Grok: Your equipment rentals are highly efficient. You have accumulated enough GST to claim Input Tax Credit on next harvest's seeds!", { icon: '🤖', duration: 6000 })}
                                                className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition"
                                            >
                                                <MdLightbulb /> AI Insights
                                            </button>
                                        </div>

                                        {/* Financial Summary */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-400">Total Spent</p>
                                                    <p className="text-2xl font-black text-gray-900 mt-1">₹{myBookings.filter(b => b.status === 'completed').reduce((s,b) => s + (b.totalPrice||0), 0)}</p>
                                                </div>
                                                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-xl">💸</div>
                                            </div>
                                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-400">GST Paid (18%)</p>
                                                    <p className="text-2xl font-black text-gray-900 mt-1">₹{(myBookings.filter(b => b.status === 'completed').reduce((s,b) => s + (b.totalPrice||0), 0) * 0.18).toFixed(0)}</p>
                                                </div>
                                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-xl">🧾</div>
                                            </div>
                                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center justify-between border-b-4 border-b-green-500">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-400">Total Earnings</p>
                                                    <p className="text-2xl font-black text-green-600 mt-1">₹{totalEarnings}</p>
                                                </div>
                                                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-xl">💰</div>
                                            </div>
                                        </div>

                                        {/* Invoice List */}
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                                                <h3 className="font-bold text-gray-900">Recent Transactions</h3>
                                                <div className="flex gap-2">
                                                    <select className="input-field py-1 text-sm bg-gray-50 border-none cursor-pointer">
                                                        <option>All Transactions</option>
                                                        <option>Bookings</option>
                                                        <option>Earnings</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            {myBookings.filter(b => b.status === "completed").length === 0 ? (
                                                <div className="p-12 text-center text-gray-500">
                                                    <span className="text-4xl block mb-2">🧾</span>
                                                    <p>No completed transactions yet to generate invoices.</p>
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-gray-100">
                                                    {myBookings.filter(b => b.status === "completed").map(b => (
                                                        <div key={b.id} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 hover:bg-gray-50 transition">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-lg">🚜</div>
                                                                <div>
                                                                    <p className="font-bold text-gray-900 text-sm">{b.equipmentName}</p>
                                                                    <p className="text-xs text-gray-500 mt-0.5">Txn ID: {b.id.substring(1, 9)} • {b.createdAt ? format(new Date(b.createdAt), "MMM dd, yyyy") : "N/A"}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-6">
                                                                <div className="text-right">
                                                                    <p className="font-black text-gray-900">₹{b.totalPrice}</p>
                                                                    <p className="text-xs text-gray-400">Incl. ₹{(b.totalPrice * 0.18).toFixed(0)} GST</p>
                                                                </div>
                                                                <button 
                                                                    onClick={() => {
                                                                        toast.success("Generating GST Invoice PDF...");
                                                                        generateGSTInvoice({
                                                                            id: b.id, price: b.totalPrice, equipmentName: b.equipmentName, duration: b.duration, createdAt: b.createdAt
                                                                        }, { name: "AgroShare Vendor", address: "Local Hub", state: "Maharashtra", gstin: "27AABCU9603R1Z2" }, { name: user?.name, address: user?.village, state: "Maharashtra" });
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition"
                                                                >
                                                                    <MdDownload /> Download PDF
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ─ NOTIFICATIONS ─ */}
                                {tab === "notifs" && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                        <div className="flex items-center justify-between mb-5">
                                            <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
                                            {unreadCount > 0 && (
                                                <button onClick={markAllRead} className="text-sm text-green-600 font-semibold hover:underline">
                                                    Mark all as read
                                                </button>
                                            )}
                                        </div>
                                        {notifications.length === 0 ? (
                                            <div className="text-center py-16">
                                                <span className="text-5xl block mb-3">🔔</span>
                                                <p className="text-gray-400">No notifications yet</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {notifications.map(n => (
                                                    <div key={n.id} className={`flex gap-3 p-4 rounded-xl border transition-all ${n.read ? "bg-gray-50 border-gray-100" : "bg-green-50 border-green-200"}`}>
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${n.type?.includes("confirm") ? "bg-green-100" :
                                                            n.type?.includes("cancel") || n.type?.includes("reject") ? "bg-red-100" : "bg-blue-100"
                                                            }`}>
                                                            {n.type?.includes("confirm") ? "✅" : n.type?.includes("cancel") || n.type?.includes("reject") ? "❌" : "📢"}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm leading-relaxed ${n.read ? "text-gray-600" : "text-gray-900 font-semibold"}`}>{n.message}</p>
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                {n.createdAt ? format(new Date(n.createdAt), "MMM dd · HH:mm") : ""}
                                                            </p>
                                                        </div>
                                                        {!n.read && <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
