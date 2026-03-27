import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { ref, get, onValue, push, set, runTransaction } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import useUIStore from "../store/useUIStore";
import { format, addHours, parseISO } from "date-fns";
import toast from "react-hot-toast";
import {
    MdLocationOn, MdStar, MdAccessTime, MdCalendarToday,
    MdVerified, MdPerson, MdShare, MdFavorite
} from "react-icons/md";

const EquipmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, authUser } = useAuthStore();
    const { addNotification } = useUIStore();

    const [equipment, setEquipment] = useState(null);
    const [owner, setOwner] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    // Booking form state
    const [bookDate, setBookDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [duration, setDuration] = useState(2);
    const [bookLoading, setBookLoading] = useState(false);
    const [bookSuccess, setBookSuccess] = useState(false);

    // Review form
    const [rating, setRating] = useState(5);
    const [reviewText, setReviewText] = useState("");

    useEffect(() => {
        const eqRef = ref(db, `equipment/${id}`);
        get(eqRef).then((snap) => {
            if (!snap.exists()) { toast.error("Equipment not found"); navigate("/equipment"); return; }
            const eq = snap.val();
            setEquipment(eq);
            // Fetch owner
            get(ref(db, `users/${eq.ownerId}`)).then((s) => s.exists() && setOwner(s.val()));
        });
        // Reviews
        const revRef = ref(db, `reviews/${id}`);
        const unsub = onValue(revRef, (snap) => {
            if (snap.exists()) {
                setReviews(Object.values(snap.val()));
            }
        });
        setLoading(false);
        return () => unsub();
    }, [id, navigate]);

    const totalPrice = equipment ? equipment.price * duration : 0;

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!authUser) { toast.error("Please login to book"); navigate("/auth"); return; }
        if (!bookDate || !startTime) { toast.error("Fill all booking fields"); return; }

        // ── Owner cannot book their own equipment ──
        if (equipment && authUser.uid === equipment.ownerId) {
            toast.error("You cannot book your own equipment.");
            return;
        }

        const startISO = new Date(`${bookDate}T${startTime}`).toISOString();
        const endISO = addHours(new Date(`${bookDate}T${startTime}`), duration).toISOString();

        setBookLoading(true);
        try {
            // Check existing bookings for overlap
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
                    toast.error("⚠️ This slot is already booked. Please choose a different time.");
                    setBookLoading(false);
                    return;
                }
            }

            const newRef = push(ref(db, "bookings"));
            const bookingId = newRef.key;
            await set(newRef, {
                userId: authUser.uid,
                userName: user?.name || "Farmer",
                userPhone: user?.phone || "",
                userAddress: user?.village || "",
                equipmentId: id,
                equipmentName: equipment.name,
                ownerId: equipment.ownerId,
                startTime: startISO,
                endTime: endISO,
                duration,
                totalPrice,
                status: "pending",
                paymentStatus: "unpaid",
                createdAt: new Date().toISOString(),
            });

            // ── Notify booker ──
            await push(ref(db, `notifications/${authUser.uid}`), {
                type: "booking_placed",
                message: `Booking request sent for "${equipment.name}" on ${bookDate} at ${startTime}. Waiting for owner confirmation. 🕐`,
                createdAt: new Date().toISOString(),
                read: false,
            });

            // ── Notify equipment owner ──
            if (equipment.ownerId) {
                await push(ref(db, `notifications/${equipment.ownerId}`), {
                    type: "new_booking_request",
                    message: `New booking request for "${equipment.name}" on ${bookDate} at ${startTime}. ₹${totalPrice}. Please confirm in your Dashboard.`,
                    createdAt: new Date().toISOString(),
                    read: false,
                });
            }

            setBookSuccess(true);
        } catch (err) {
            console.error(err);
            toast.error("Booking failed. Try again.");
        } finally {
            setBookLoading(false);
        }
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
            {/* Booking success overlay */}
            <AnimatePresence>
                {bookSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                            className="bg-white rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl"
                        >
                            <motion.div
                                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.6 }}
                                className="text-7xl mb-4"
                            >🎉</motion.div>
                            <h3 className="text-2xl font-black text-gray-900 mb-2">Booking Placed!</h3>
                            <p className="text-gray-500 mb-6">
                                Your booking for <strong>{equipment.name}</strong> is <span className="text-green-600 font-bold">pending confirmation</span>.
                            </p>
                            <div className="bg-green-50 rounded-2xl p-4 mb-6 text-left">
                                <p className="text-sm text-gray-600">Date: <strong>{bookDate}</strong></p>
                                <p className="text-sm text-gray-600">Time: <strong>{startTime}</strong> · {duration}h</p>
                                <p className="text-sm text-gray-600">Total: <strong className="text-green-700">₹{totalPrice}</strong></p>
                            </div>
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="btn-primary w-full"
                            >
                                View in Dashboard →
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ─── Left: Details ─── */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Hero image */}
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
                                    <h1 className="text-3xl md:text-4xl font-black text-white font-display">{equipment.name}</h1>
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

                        {/* Info row */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <MdLocationOn className="h-5 w-5 text-green-500" />
                                    <span>{equipment.location?.address || equipment.location || "Location not set"}</span>
                                </div>
                                {avgRating && (
                                    <div className="flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-full">
                                        <MdStar className="h-4 w-4 text-amber-400" />
                                        <span className="font-bold text-amber-700">{avgRating}</span>
                                        <span className="text-amber-600 text-sm">({reviews.length} reviews)</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-gray-600 leading-relaxed">
                                {equipment.description || "Well-maintained agricultural equipment available for rent. Cleaned after every use. Reliable and efficient for all farming needs."}
                            </p>
                        </div>

                        {/* Owner card */}
                        {owner && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
                                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">👨‍🌾</div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-900">{owner.name}</p>
                                        <MdVerified className="h-4 w-4 text-green-500" title="Verified Owner" />
                                    </div>
                                    <p className="text-sm text-gray-500">{owner.village} · Equipment Owner</p>
                                </div>
                                <span className="badge badge-green">⭐ {owner.rating || "New"}</span>
                            </div>
                        )}

                        {/* Reviews */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-5">Reviews</h3>
                            {reviews.length === 0 ? (
                                <p className="text-gray-400 text-sm py-4">No reviews yet. Be the first!</p>
                            ) : (
                                <div className="space-y-4 mb-6">
                                    {reviews.map((r, i) => (
                                        <div key={i} className="border-b border-gray-50 pb-4 last:border-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="font-semibold text-gray-900 text-sm">{r.userName}</p>
                                                <div className="flex text-amber-400 text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                                            </div>
                                            <p className="text-gray-600 text-sm">{r.text}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Review form */}
                            {user && (
                                <form onSubmit={handleReview} className="border-t border-gray-100 pt-4">
                                    <p className="font-semibold text-gray-700 mb-3 text-sm">Leave a review</p>
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
                                        className="input-field text-sm"
                                    />
                                    <button type="submit" className="btn-primary mt-3 text-sm py-2">Submit Review</button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* ─── Right: Booking / Purchase Sidebar ─── */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 bg-white rounded-3xl border border-gray-100 shadow-green-lg p-6">

                            {/* ── Price Header ── */}
                            <div className="mb-6 pb-6 border-b border-gray-100">
                                {(equipment.listingType === "rent" || !equipment.listingType) && (
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-gray-900">₹{equipment.price}</span>
                                        <span className="text-gray-500 font-medium">/hour</span>
                                    </div>
                                )}
                                {equipment.listingType === "sell" && (
                                    <div>
                                        <p className="text-xs text-orange-600 font-semibold uppercase tracking-wider mb-1">Sale Price</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-black text-orange-600">₹{equipment.salePrice}</span>
                                            <span className="text-gray-500 font-medium">one-time</span>
                                        </div>
                                    </div>
                                )}
                                {equipment.listingType === "both" && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Rent</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-gray-900">₹{equipment.price}</span>
                                                    <span className="text-gray-400 text-sm">/hr</span>
                                                </div>
                                            </div>
                                            <div className="w-px h-10 bg-gray-200" />
                                            <div className="text-right">
                                                <p className="text-xs text-orange-600 font-semibold uppercase tracking-wider">Buy</p>
                                                <div className="flex items-baseline gap-1 justify-end">
                                                    <span className="text-2xl font-black text-orange-600">₹{equipment.salePrice}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Owner view ── */}
                            {authUser && equipment.ownerId === authUser.uid ? (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🚜</div>
                                    <p className="font-bold text-gray-900 text-lg mb-1">This is your listing</p>
                                    <p className="text-gray-500 text-sm mb-5">Share it with other farmers!</p>
                                    <button onClick={() => navigate("/dashboard")}
                                        className="w-full py-3 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all shadow-green">
                                        Manage in Dashboard →
                                    </button>
                                </div>

                            ) : equipment.listingType === "sell" ? (
                                /* ── SELL: Contact-to-buy panel ── */
                                <div className="space-y-4">
                                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                                        <p className="font-bold text-orange-800 mb-1">💰 Available for Purchase</p>
                                        <p className="text-sm text-orange-700">This equipment is listed for outright sale. Contact the owner to negotiate and finalise the deal.</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 text-sm">Sale Price</span>
                                            <span className="font-black text-orange-600 text-lg">₹{equipment.salePrice?.toLocaleString("en-IN")}</span>
                                        </div>
                                    </div>
                                    {!authUser ? (
                                        <button onClick={() => navigate("/auth")}
                                            className="w-full py-4 rounded-2xl font-bold text-lg bg-orange-500 text-white hover:bg-orange-600 shadow-lg transition-all">
                                            Login to Contact 🔐
                                        </button>
                                    ) : (
                                        <button onClick={() => {
                                            toast.success("Interest noted! Contact the owner via Dashboard.");
                                        }} className="w-full py-4 rounded-2xl font-bold text-lg bg-orange-500 text-white hover:bg-orange-600 shadow-lg transition-all hover:-translate-y-0.5">
                                            🛒 Express Interest
                                        </button>
                                    )}
                                    <p className="text-xs text-gray-400 text-center">Price may be negotiable — contact the owner</p>
                                </div>

                            ) : (
                                /* ── RENT or BOTH: Booking form ── */
                                <form onSubmit={handleBooking} className="space-y-4">
                                    {equipment.listingType === "both" && (
                                        <p className="text-xs text-blue-600 font-semibold bg-blue-50 rounded-xl px-3 py-2">
                                            📅 Booking below is for <strong>rental only</strong>. For purchase, contact the owner.
                                        </p>
                                    )}
                                    <div>
                                        <label className="label flex items-center gap-1.5"><MdCalendarToday className="text-green-600" />Date</label>
                                        <input type="date" required
                                            min={format(new Date(), "yyyy-MM-dd")}
                                            value={bookDate} onChange={(e) => setBookDate(e.target.value)}
                                            className="input-field" />
                                    </div>
                                    <div>
                                        <label className="label flex items-center gap-1.5"><MdAccessTime className="text-green-600" />Start Time</label>
                                        <input type="time" required
                                            value={startTime} onChange={(e) => setStartTime(e.target.value)}
                                            className="input-field" />
                                    </div>
                                    <div>
                                        <label className="label">Duration (hours): <span className="text-green-600 font-bold">{duration}h</span></label>
                                        <input type="range" min={1} max={12} value={duration}
                                            onChange={(e) => setDuration(Number(e.target.value))}
                                            className="w-full accent-green-600 mt-1" />
                                        <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1h</span><span>12h</span></div>
                                    </div>

                                    {/* Cost breakdown */}
                                    <div className="bg-green-50 rounded-2xl p-4 border border-green-100 space-y-2">
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>₹{equipment.price} × {duration} hours</span>
                                            <span>₹{equipment.price * duration}</span>
                                        </div>
                                        <div className="flex justify-between font-black text-lg border-t border-green-200 pt-2">
                                            <span className="text-gray-900">Total</span>
                                            <span className="text-green-700">₹{equipment.price * duration}</span>
                                        </div>
                                    </div>

                                    {!authUser ? (
                                        <button type="button" onClick={() => navigate("/auth")}
                                            className="w-full py-4 rounded-2xl font-bold text-lg bg-green-600 text-white hover:bg-green-700 transition-all shadow-green">
                                            Login to Book 🔐
                                        </button>
                                    ) : (
                                        <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={bookLoading}
                                            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-green transition-all ${bookLoading
                                                ? "bg-green-400 text-white cursor-not-allowed"
                                                : "bg-green-600 text-white hover:bg-green-700 hover:-translate-y-0.5"}`}>
                                            {bookLoading ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                                    </svg>
                                                    Confirming...
                                                </span>
                                            ) : "Book Now 🚜"}
                                        </motion.button>
                                    )}
                                    <p className="text-xs text-gray-400 text-center">Free cancellation up to 24 hours before</p>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EquipmentDetail;
