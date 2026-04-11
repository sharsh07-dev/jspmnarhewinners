import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import useAuthStore from "../store/useAuthStore";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import toast from "react-hot-toast";

const QUICK_ACTIONS = [
    { label: "Rent Equipment", icon: "🚜", color: "#16a34a", bg: "#dcfce7", path: "/equipment" },
    { label: "Mandi Prices",   icon: "📊", color: "#2563eb", bg: "#dbeafe", path: "/mandi-prices" },
    { label: "Agro Exchange",  icon: "🌿", color: "#7c3aed", bg: "#ede9fe", path: "/pesticide-exchange" },
    { label: "AI Advisor",     icon: "🤖", color: "#d97706", bg: "#fef3c7", path: "/ai-recommendations" },
    { label: "Govt Schemes",   icon: "🏛️", color: "#0f766e", bg: "#ccfbf1", path: "/schemes" },
    { label: "Crop Claims",    icon: "🛡️", color: "#dc2626", bg: "#fee2e2", path: "/crop-claims" },
    { label: "Find Labour",    icon: "👷", color: "#ea580c", bg: "#ffedd5", path: "/find-labour" },
    { label: "Disease Scan",   icon: "🔬", color: "#4f46e5", bg: "#e0e7ff", path: "/crop-disease" },
];

const MobileHome = () => {
    const { user, authUser } = useAuthStore();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [myBookings, setMyBookings]       = useState([]);
    const [showNotifs, setShowNotifs]       = useState(false);

    useEffect(() => {
        if (!authUser?.uid) return;

        const nRef = ref(db, `notifications/${authUser.uid}`);
        const unsub1 = onValue(nRef, snap => {
            if (snap.exists()) {
                const list = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
                setNotifications(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            }
        });

        const bRef = ref(db, "bookings");
        const unsub2 = onValue(bRef, snap => {
            if (snap.exists()) {
                const all = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
                const mine = all.filter(b => b.userId === authUser.uid);
                setMyBookings(mine.slice(0, 3));
            }
        });

        return () => { unsub1(); unsub2(); };
    }, [authUser]);

    const unread = notifications.filter(n => !n.read).length;
    const hour   = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const dayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

    const handleLogout = async () => {
        await signOut(auth);
        toast.success("Logged out");
        navigate("/");
    };

    const statusColor = { completed: "#16a34a", upcoming: "#2563eb", confirmed: "#7c3aed", pending: "#d97706", cancelled: "#dc2626" };

    return (
        <div
            className="md:hidden"
            style={{
                minHeight: "100dvh",
                background: "#f6f8fa",
                display: "flex",
                flexDirection: "column",
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 68px)"
            }}
        >
            {/* ── Top Bar ── */}
            <div style={{ background: "#fff", padding: "14px 20px 12px", borderBottom: "1px solid #f0f0f0" }}>
                <div className="flex items-center justify-between">
                    <div>
                        <p style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>{dayStr}</p>
                        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>
                            {greeting}, {user?.name?.split(" ")[0]} 👋
                        </h1>
                        <p style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, marginTop: 2 }}>
                            {user?.village && `📍 ${user.village}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowNotifs(v => !v)}
                            style={{
                                width: 42, height: 42, borderRadius: 14, background: "#f3f4f6",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 20, position: "relative", border: "none"
                            }}
                        >
                            🔔
                            {unread > 0 && (
                                <span style={{
                                    position: "absolute", top: 6, right: 6,
                                    width: 8, height: 8, borderRadius: "50%",
                                    background: "#ef4444", border: "2px solid #fff"
                                }} />
                            )}
                        </button>
                        <button
                            onClick={handleLogout}
                            style={{
                                width: 42, height: 42, borderRadius: 14, background: "#fff1f1",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 18, border: "none"
                            }}
                        >
                            🚪
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Notification Drawer ── */}
            <AnimatePresence>
                {showNotifs && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        style={{
                            position: "fixed", top: 80, left: 12, right: 12, zIndex: 200,
                            background: "#fff", borderRadius: 20, boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
                            maxHeight: 340, overflow: "hidden", display: "flex", flexDirection: "column"
                        }}
                    >
                        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontWeight: 800, fontSize: 14 }}>Notifications {unread > 0 && <span style={{ color: "#ef4444" }}>({unread})</span>}</p>
                            <button onClick={() => setShowNotifs(false)} style={{ fontSize: 18, border: "none", background: "none", lineHeight: 1 }}>✕</button>
                        </div>
                        <div style={{ overflowY: "auto", flex: 1 }}>
                            {notifications.length === 0 ? (
                                <p style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 13 }}>No notifications yet</p>
                            ) : notifications.slice(0, 8).map(n => (
                                <div key={n.id} style={{
                                    padding: "12px 16px", borderBottom: "1px solid #f9f9f9",
                                    background: n.read ? "#fff" : "#f0fdf4"
                                }}>
                                    <p style={{ fontSize: 13, fontWeight: n.read ? 400 : 700, color: "#111827", lineHeight: 1.4 }}>{n.message}</p>
                                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                                        {n.createdAt ? new Date(n.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : ""}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Scrollable Content ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 12px" }}>

                {/* Primary CTA Row */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => navigate("/equipment")}
                        style={{
                            flex: 1, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #16a34a, #15803d)",
                            color: "#fff", fontWeight: 800, fontSize: 14, border: "none",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            boxShadow: "0 4px 16px rgba(22,163,74,0.3)"
                        }}
                    >
                        🚜 Book Equipment
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => navigate("/mandi-prices")}
                        style={{
                            flex: 1, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                            color: "#fff", fontWeight: 800, fontSize: 14, border: "none",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            boxShadow: "0 4px 16px rgba(37,99,235,0.3)"
                        }}
                    >
                        📊 Live Prices
                    </motion.button>
                </div>

                {/* Quick Actions Grid */}
                <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                        Quick Actions
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                        {QUICK_ACTIONS.map(action => (
                            <motion.button
                                key={action.path}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => navigate(action.path)}
                                style={{
                                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                    padding: "12px 4px 10px", borderRadius: 16, background: "#fff",
                                    border: "1px solid #f0f0f0", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", gap: 6
                                }}
                            >
                                <span style={{
                                    width: 38, height: 38, borderRadius: 12, background: action.bg,
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
                                }}>
                                    {action.icon}
                                </span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: "#374151", textAlign: "center", lineHeight: 1.2, letterSpacing: "0.01em" }}>
                                    {action.label}
                                </span>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* My Recent Bookings */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            My Bookings
                        </p>
                        <button
                            onClick={() => navigate("/dashboard")}
                            style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, border: "none", background: "none" }}
                        >
                            View All →
                        </button>
                    </div>
                    {myBookings.length === 0 ? (
                        <div style={{
                            background: "#fff", borderRadius: 16, padding: 24, textAlign: "center",
                            border: "1.5px dashed #e5e7eb"
                        }}>
                            <span style={{ fontSize: 28 }}>📋</span>
                            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 8, fontWeight: 500 }}>No bookings yet</p>
                            <button
                                onClick={() => navigate("/equipment")}
                                style={{
                                    marginTop: 12, padding: "8px 20px", background: "#16a34a", color: "#fff",
                                    borderRadius: 10, fontSize: 12, fontWeight: 700, border: "none"
                                }}
                            >
                                Browse Equipment
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {myBookings.map(b => (
                                <div key={b.id} style={{
                                    background: "#fff", borderRadius: 14, padding: "12px 14px",
                                    border: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                                    display: "flex", alignItems: "center", justifyContent: "space-between"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{
                                            width: 38, height: 38, background: "#f3f4f6", borderRadius: 10,
                                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
                                        }}>🚜</div>
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{b.equipmentName}</p>
                                            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>₹{b.totalPrice} · {b.date || ""}</p>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em",
                                        padding: "4px 8px", borderRadius: 8,
                                        background: (statusColor[b.status] || "#6b7280") + "18",
                                        color: statusColor[b.status] || "#6b7280"
                                    }}>
                                        {b.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* AI Tip Banner */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    onClick={() => navigate("/ai-recommendations")}
                    style={{
                        background: "linear-gradient(135deg, #1e1b4b, #312e81)",
                        borderRadius: 18, padding: "16px 18px",
                        display: "flex", alignItems: "center", gap: 14,
                        cursor: "pointer", marginBottom: 16
                    }}
                >
                    <div style={{
                        width: 44, height: 44, background: "rgba(255,255,255,0.12)", borderRadius: 14,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0
                    }}>🤖</div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, color: "#a5b4fc", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>AI Advisor</p>
                        <p style={{ fontSize: 14, color: "#fff", fontWeight: 700, marginTop: 2 }}>Smart crop & market insights</p>
                        <p style={{ fontSize: 11, color: "#818cf8", marginTop: 2 }}>Tap for personalized recommendations →</p>
                    </div>
                </motion.div>

                {/* Damage Protection */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    onClick={() => navigate("/dashboard")}
                    style={{
                        background: "linear-gradient(135deg, #7f1d1d, #991b1b)",
                        borderRadius: 18, padding: "16px 18px",
                        display: "flex", alignItems: "center", gap: 14,
                        cursor: "pointer"
                    }}
                >
                    <div style={{
                        width: 44, height: 44, background: "rgba(255,255,255,0.12)", borderRadius: 14,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0
                    }}>🛡️</div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, color: "#fca5a5", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Active Protection</p>
                        <p style={{ fontSize: 14, color: "#fff", fontWeight: 700, marginTop: 2 }}>Damage Protection Fund</p>
                        <p style={{ fontSize: 11, color: "#f87171", marginTop: 2 }}>xAI-verified claims • 5-7 day payout →</p>
                    </div>
                </motion.div>

            </div>
        </div>
    );
};

export default MobileHome;
