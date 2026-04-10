import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase";
import { ref, get, onValue, push, set } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { format, addHours } from "date-fns";
import toast from "react-hot-toast";
import { generateGSTInvoice } from "../utils/invoiceGenerator";
import {
    MdLocationOn, MdStar, MdAccessTime, MdCalendarToday,
    MdVerified, MdShare, MdFavorite, MdHourglassEmpty, MdPrint, MdClose
} from "react-icons/md";

const EquipmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, authUser } = useAuthStore();
    const location = useLocation();
    const wizardData = location.state?.dates;

    const [equipment, setEquipment] = useState(null);
    const [owner, setOwner] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    // Booking states
    const [bookDate, setBookDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [duration, setDuration] = useState(2);
    const [bookLoading, setBookLoading] = useState(false);
    const [bookingId, setBookingId] = useState(null);
    const [step, setStep] = useState(0); // 0: Form, 2: Success Receipt

    // Review form
    const [rating, setRating] = useState(5);
    const [reviewText, setReviewText] = useState("");

    useEffect(() => {
        const eqRef = ref(db, `equipment/${id}`);
        get(eqRef).then((snap) => {
            if (!snap.exists()) { toast.error("Equipment not found"); navigate("/equipment"); return; }
            const eq = snap.val();
            setEquipment(eq);
            get(ref(db, `users/${eq.ownerId}`)).then((s) => s.exists() && setOwner(s.val()));
        });
        const revRef = ref(db, `reviews/${id}`);
        const unsub = onValue(revRef, (snap) => {
            if (snap.exists()) {
                setReviews(Object.values(snap.val()));
            }
        });
        setLoading(false);
        return () => unsub();
    }, [id, navigate]);

    useEffect(() => {
        if (wizardData) {
            setBookDate(wizardData.start);
            setStartTime(wizardData.startTime);
            try {
                const s = new Date(`${wizardData.start}T${wizardData.startTime}`);
                const e = new Date(`${wizardData.end}T${wizardData.endTime}`);
                const diffHours = (e - s) / (1000 * 60 * 60);
                if (diffHours > 0) setDuration(Math.max(1, Math.round(diffHours)));
            } catch (err) { console.error("Duration calc failed", err); }
        }
    }, [wizardData]);

    const totalPrice = equipment ? (equipment.listingType === "sell" ? equipment.salePrice : equipment.price * duration) : 0;

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!authUser) { toast.error("Please login to book"); navigate("/auth"); return; }
        
        if (equipment.listingType !== "sell") {
            if (!bookDate || !startTime) { toast.error("Fill all booking fields"); return; }
        }

        if (equipment && authUser.uid === equipment.ownerId) {
            toast.error("You cannot book your own equipment.");
            return;
        }

        setBookLoading(true);
        try {
            let startISO = new Date().toISOString();
            let endISO = new Date().toISOString();

            if (equipment.listingType !== "sell") {
                startISO = new Date(`${bookDate}T${startTime}`).toISOString();
                endISO = addHours(new Date(`${bookDate}T${startTime}`), duration).toISOString();

                const bookSnap = await get(ref(db, "bookings"));
                if (bookSnap.exists()) {
                    const allBookings = Object.values(bookSnap.val()).filter(
                        (b) => b.equipmentId === id && b.status !== "cancelled"
                    );
                    const hasOverlap = allBookings.some((b) => {
                        const bStart = new Date(b.startTime).getTime();
                        const bEnd = new Date(b.endTime).getTime();
                        const rStart = new Date(startISO).getTime();
                        const rEnd = new Date(endISO).getTime();
                        return rStart < bEnd && bStart < rEnd;
                    });
                    if (hasOverlap) {
                        toast.error("⚠️ Overlap detected. Choose another time.");
                        setBookLoading(false);
                        return;
                    }
                }
            }

            const newRef = push(ref(db, "bookings"));
            const bId = newRef.key;
            setBookingId(bId.toUpperCase());

            await set(newRef, {
                userId: authUser.uid,
                userName: user?.name || "Farmer",
                equipmentId: id,
                equipmentName: equipment.name,
                ownerId: equipment.ownerId,
                ownerName: owner?.name || "Equipment Owner",
                startTime: startISO,
                endTime: endISO,
                duration: equipment.listingType === "sell" ? "One-time" : duration,
                totalPrice,
                status: "pending",
                paymentStatus: "paid",
                listingType: equipment.listingType || "rent",
                createdAt: new Date().toISOString(),
            });

            await push(ref(db, `notifications/${equipment.ownerId}`), {
                type: "new_booking_request",
                message: `New request for "${equipment.name}" from ${user?.name}. ₹${totalPrice}.`,
                createdAt: new Date().toISOString(),
                read: false,
            });

            setTimeout(() => {
                setBookLoading(false);
                setStep(2);
            }, 1000);
        } catch (err) {
            toast.error("Booking failed");
            setBookLoading(false);
        }
    };

    const handlePrint = () => {
        toast.success("Generating GST Invoice...");
        generateGSTInvoice(
            { 
                id: bookingId, 
                price: totalPrice, 
                equipmentName: equipment.name, 
                duration: equipment.listingType === "sell" ? "1 Unit" : `${duration} Hours`,
                createdAt: new Date().toISOString() 
            },
            { name: owner?.name || "AgroShare Vendor", address: owner?.village || "Farmer Hub", state: "Maharashtra" },
            { name: user?.name || "Farmer", address: user?.village || "Local", state: "Maharashtra" }
        );
    };

    const handleReview = async (e) => {
        e.preventDefault();
        if (!authUser) { toast.error("Login to review"); return; }
        const revRef = push(ref(db, `reviews/${id}`));
        await set(revRef, {
            userId: authUser.uid,
            userName: user?.name || "Anonymous",
            rating,
            text: reviewText,
            createdAt: new Date().toISOString(),
        });
        toast.success("Review submitted! ⭐");
        setReviewText(""); setRating(5);
    };

    const avgRating = reviews.length
        ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
        : null;

    if (loading || !equipment) return (
        <div className="min-h-screen pt-24 flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-200 border-t-green-600" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pt-20">
            {/* Success Modal - matching previous design */}
            <AnimatePresence>
                {step === 2 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl relative"
                        >
                            <div className="text-6xl mb-4 animate-bounce">🎉</div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Booking Placed!</h3>
                            <p className="text-gray-500 mb-6 font-medium">
                                Your request for <strong>{equipment.name}</strong> is confirmed.
                            </p>
                            
                            <div className="bg-green-50 rounded-2xl p-5 mb-6 text-left border border-green-100">
                                <p className="text-sm font-bold text-gray-800 mb-2 flex justify-between uppercase tracking-wider text-[10px]">Order Details</p>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-600">ID: <span className="font-bold text-gray-800">#{bookingId}</span></p>
                                    <p className="text-xs text-gray-600 text-right font-bold text-green-700">PAID</p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={handlePrint} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition">
                                    <MdPrint /> Receipt
                                </button>
                                <button onClick={() => navigate("/dashboard")} className="flex-1 btn-primary py-3 rounded-xl font-bold">
                                    Dashboard
                                </button>
                            </div>
                            
                            <button onClick={() => setStep(0)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                                <MdClose className="text-xl" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Details */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="relative rounded-3xl overflow-hidden shadow-xl h-72 md:h-96 bg-gray-200">
                            <img
                                src={equipment.imageUrl || "https://images.unsplash.com/photo-1592982537447-6f23dbdc7e90?auto=format&fit=crop&w=1200&q=80"}
                                alt={equipment.name}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                                <div>
                                    <span className="badge badge-green mb-2">{equipment.type}</span>
                                    <h1 className="text-3xl md:text-4xl font-bold text-white font-display uppercase">{equipment.name}</h1>
                                </div>
                                <div className="flex gap-2">
                                    <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition">
                                        <MdFavorite className="h-5 w-5" />
                                    </button>
                                    <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition">
                                        <MdShare className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <MdLocationOn className="h-5 w-5 text-green-500" />
                                    <span className="font-bold">{equipment.location?.address || equipment.location || "Location not set"}</span>
                                </div>
                                {avgRating && (
                                    <div className="flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-full">
                                        <MdStar className="h-4 w-4 text-amber-400" />
                                        <span className="font-bold text-amber-700">{avgRating}</span>
                                        <span className="text-amber-600 text-sm">({reviews.length} reviews)</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-gray-600 leading-relaxed font-medium">
                                {equipment.description || "Well-maintained agricultural equipment available for rent. Cleaned after every use. Reliable and efficient for all farming needs."}
                            </p>
                        </div>

                        {owner && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
                                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 animate-pulse">👨‍🌾</div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-900">{owner.name}</p>
                                        <MdVerified className="h-4 w-4 text-green-500" />
                                    </div>
                                    <p className="text-sm text-gray-500 font-bold">{owner.village} · Certified Owner</p>
                                </div>
                                <span className="badge badge-green font-bold">⭐ {owner.rating || "TOP"}</span>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-5">Reviews</h3>
                            {reviews.length === 0 ? (
                                <p className="text-gray-400 text-sm py-4">No reviews yet.</p>
                            ) : (
                                <div className="space-y-4 mb-6">
                                    {reviews.map((r, i) => (
                                        <div key={i} className="border-b border-gray-50 pb-4 last:border-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="font-bold text-gray-900 text-sm">{r.userName}</p>
                                                <div className="flex text-amber-400 text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                                            </div>
                                            <p className="text-gray-600 text-sm italic">"{r.text}"</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {user && (
                                <form onSubmit={handleReview} className="border-t border-gray-100 pt-4">
                                    <p className="font-bold text-gray-700 mb-3 text-sm">Leave a review</p>
                                    <div className="flex gap-1 mb-3">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <button type="button" key={s} onClick={() => setRating(s)} className={`text-2xl transition ${s <= rating ? "text-amber-400" : "text-gray-200"}`}>★</button>
                                        ))}
                                    </div>
                                    <textarea
                                        value={reviewText}
                                        onChange={(e) => setReviewText(e.target.value)}
                                        required
                                        rows={3}
                                        placeholder="Share your experience..."
                                        className="input-field text-sm font-medium"
                                    />
                                    <button type="submit" className="btn-primary mt-3 text-sm py-2 font-bold px-6">Submit Review</button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Booking Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 bg-white rounded-3xl border border-gray-100 shadow-green-lg p-6">
                            <div className="mb-6 pb-6 border-b border-gray-100">
                                {(equipment.listingType === "rent" || !equipment.listingType) && (
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-gray-900 tracking-tight">₹{equipment.price}</span>
                                        <span className="text-gray-500 font-bold uppercase text-[10px]">/ hour</span>
                                    </div>
                                )}
                                {equipment.listingType === "sell" && (
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-orange-600 tracking-tight">₹{equipment.salePrice}</span>
                                    </div>
                                )}
                                {equipment.listingType === "both" && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-blue-600 uppercase">Rent</p>
                                            <p className="text-2xl font-bold text-gray-900 tracking-tight">₹{equipment.price}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-orange-600 uppercase">Buy</p>
                                            <p className="text-2xl font-bold text-gray-900 tracking-tight">₹{equipment.salePrice}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {authUser && equipment.ownerId === authUser.uid ? (
                                <div className="text-center py-6">
                                    <button onClick={() => navigate("/dashboard")} className="w-full py-3 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all shadow-green">
                                        Manage in Dashboard →
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleBooking} className="space-y-4">
                                    {equipment.listingType !== "sell" && (
                                        <>
                                            <div>
                                                <label className="label flex items-center gap-1.5"><MdCalendarToday className="text-green-600" />Date</label>
                                                <input type="date" required min={format(new Date(), "yyyy-MM-dd")} value={bookDate} onChange={(e) => setBookDate(e.target.value)}
                                                    className="input-field font-bold" />
                                            </div>
                                            <div>
                                                <label className="label flex items-center gap-1.5"><MdAccessTime className="text-green-600" />Start Time</label>
                                                <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)}
                                                    className="input-field font-bold" />
                                            </div>
                                            <div>
                                                <label className="label font-bold text-sm">Duration: <span className="text-green-600">{duration}h</span></label>
                                                <input type="range" min={1} max={12} value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                                                    className="w-full accent-green-600" />
                                            </div>
                                        </>
                                    )}

                                    <div className="bg-green-50 rounded-2xl p-4 border border-green-100 flex justify-between items-center">
                                        <span className="font-bold text-gray-900">Total Price</span>
                                        <span className="text-2xl font-bold text-green-700 tracking-tighter">₹{getBookingTotal(equipment, duration)}</span>
                                    </div>

                                    {!authUser ? (
                                        <button type="button" onClick={() => navigate("/auth")} className="w-full btn-primary py-4 rounded-xl font-bold">
                                            Login to Book 🔐
                                        </button>
                                    ) : (
                                        <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={bookLoading}
                                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-green transition-all ${bookLoading ? "bg-green-300 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                                            {bookLoading ? "Processing..." : "Pay & Book Now"}
                                        </motion.button>
                                    )}
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getBookingTotal = (eq, dur) => {
    if (!eq) return 0;
    if (eq.listingType === "sell") return eq.salePrice;
    return eq.price * dur;
};

export default EquipmentDetail;
