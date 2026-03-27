import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { ref, onValue, remove, set } from "firebase/database";
import { motion } from "framer-motion";
import { format } from "date-fns";
import toast from "react-hot-toast";
import {
    MdPeople, MdBookOnline, MdTrendingUp,
    MdDelete, MdCheckCircle, MdBlock, MdDashboard
} from "react-icons/md";
import { FaTractor } from "react-icons/fa";

const TABS = ["dashboard", "equipment", "bookings", "users"];

const AdminPanel = () => {
    const [tab, setTab] = useState("dashboard");
    const [users, setUsers] = useState([]);
    const [equipment, setEquipment] = useState([]);
    const [bookings, setBookings] = useState([]);

    useEffect(() => {
        const subs = [
            onValue(ref(db, "users"), (s) => setUsers(s.exists() ? Object.keys(s.val()).map((k) => ({ id: k, ...s.val()[k] })) : [])),
            onValue(ref(db, "equipment"), (s) => setEquipment(s.exists() ? Object.keys(s.val()).map((k) => ({ id: k, ...s.val()[k] })) : [])),
            onValue(ref(db, "bookings"), (s) => setBookings(s.exists() ? Object.keys(s.val()).map((k) => ({ id: k, ...s.val()[k] })) : [])),
        ];
        return () => subs.forEach((u) => u());
    }, []);

    const approveEquipment = async (id) => {
        await set(ref(db, `equipment/${id}/status`), "approved");
        toast.success("Equipment approved ✓");
    };
    const rejectEquipment = async (id) => {
        await set(ref(db, `equipment/${id}/status`), "rejected");
        toast.error("Equipment rejected");
    };
    const deleteEquipment = async (id) => {
        if (!confirm("Delete this equipment?")) return;
        await remove(ref(db, `equipment/${id}`));
        toast.success("Equipment deleted");
    };
    const updateBookingStatus = async (id, status) => {
        await set(ref(db, `bookings/${id}/status`), status);
        toast.success(`Booking ${status}`);
    };

    const revenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + (b.totalPrice || 0), 0);

    const STATS = [
        { label: "Total Users", value: users.length, icon: <MdPeople />, color: "from-blue-500 to-blue-600" },
        { label: "Equipment", value: equipment.length, icon: <FaTractor />, color: "from-green-500 to-green-600" },
        { label: "Bookings", value: bookings.length, icon: <MdBookOnline />, color: "from-purple-500 to-purple-600" },
        { label: "Revenue", value: `₹${revenue}`, icon: <MdTrendingUp />, color: "from-amber-500 to-orange-500" },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-green">
                        <MdDashboard className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 font-display">Admin Panel</h1>
                        <p className="text-sm text-gray-500">Full system control</p>
                    </div>
                </div>

                {/* Tab nav */}
                <div className="flex gap-2 mb-8 bg-white rounded-2xl border border-gray-100 p-1.5 shadow-sm w-fit">
                    {TABS.map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all duration-200 ${tab === t ? "bg-green-600 text-white shadow-green" : "text-gray-600 hover:bg-gray-50"}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* DASHBOARD TAB */}
                {tab === "dashboard" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                            {STATS.map((s, i) => (
                                <motion.div
                                    key={i}
                                    whileHover={{ y: -5, shadow: "0 20px 40px rgba(0,0,0,0.1)" }}
                                    className={`bg-gradient-to-br ${s.color} rounded-2xl p-6 text-white shadow-lg`}
                                >
                                    <div className="text-4xl mb-3 opacity-90">{s.icon}</div>
                                    <p className="text-3xl font-black">{s.value}</p>
                                    <p className="text-sm font-medium opacity-80 mt-1">{s.label}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Pending equipment */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h3 className="font-bold text-gray-900 mb-4">⏳ Pending Equipment Approval</h3>
                            {equipment.filter((e) => e.status === "pending").length === 0 ? (
                                <p className="text-gray-400 text-sm py-4 text-center">All equipment reviewed 🎉</p>
                            ) : (
                                <div className="space-y-3">
                                    {equipment.filter((e) => e.status === "pending").map((eq) => (
                                        <div key={eq.id} className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                                            <div>
                                                <p className="font-bold text-gray-900">{eq.name}</p>
                                                <p className="text-sm text-gray-500">{eq.type} · {eq.ownerName} · ₹{eq.price}/hr</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => approveEquipment(eq.id)} className="btn-primary text-sm py-1.5 px-3">Approve</button>
                                                <button onClick={() => rejectEquipment(eq.id)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition">Reject</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* EQUIPMENT TAB */}
                {tab === "equipment" && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="font-bold text-gray-900">All Equipment ({equipment.length})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {["Name", "Type", "Owner", "Price/hr", "Location", "Status", "Actions"].map((h) => (
                                            <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {equipment.map((eq) => (
                                        <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                                                        {eq.imageUrl && <img src={eq.imageUrl} className="w-full h-full object-cover" />}
                                                    </div>
                                                    <p className="font-semibold text-gray-900 text-sm">{eq.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-gray-500">{eq.type}</td>
                                            <td className="px-5 py-4 text-sm text-gray-500">{eq.ownerName || "—"}</td>
                                            <td className="px-5 py-4 text-sm font-bold text-green-700">₹{eq.price}</td>
                                            <td className="px-5 py-4 text-sm text-gray-500 max-w-[120px] truncate">{eq.location?.address || eq.location}</td>
                                            <td className="px-5 py-4">
                                                <span className={`badge ${eq.status === "approved" ? "badge-green" : eq.status === "rejected" ? "badge-red" : "badge-yellow"}`}>{eq.status || "pending"}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex gap-2">
                                                    {eq.status !== "approved" && (
                                                        <button onClick={() => approveEquipment(eq.id)} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition" title="Approve"><MdCheckCircle className="h-5 w-5" /></button>
                                                    )}
                                                    <button onClick={() => deleteEquipment(eq.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition" title="Delete"><MdDelete className="h-5 w-5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* BOOKINGS TAB */}
                {tab === "bookings" && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="font-bold text-gray-900">All Bookings ({bookings.length})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {["Equipment", "User", "Date", "Duration", "Amount", "Status", "Actions"].map((h) => (
                                            <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {bookings.map((b) => (
                                        <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-4 text-sm font-semibold text-gray-900">{b.equipmentName}</td>
                                            <td className="px-5 py-4 text-sm text-gray-500">{b.userId?.slice(0, 8)}...</td>
                                            <td className="px-5 py-4 text-sm text-gray-500">{b.startTime ? format(new Date(b.startTime), "MMM dd") : b.date}</td>
                                            <td className="px-5 py-4 text-sm text-gray-500">{b.duration}h</td>
                                            <td className="px-5 py-4 text-sm font-bold text-green-700">₹{b.totalPrice}</td>
                                            <td className="px-5 py-4">
                                                <span className={`badge ${b.status === "confirmed" ? "badge-green" : b.status === "cancelled" ? "badge-red" : "badge-yellow"}`}>{b.status}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {b.status === "pending" && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => updateBookingStatus(b.id, "confirmed")} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg font-semibold hover:bg-green-100 transition">Confirm</button>
                                                        <button onClick={() => updateBookingStatus(b.id, "cancelled")} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition">Cancel</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* USERS TAB */}
                {tab === "users" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {users.map((u) => (
                            <motion.div key={u.id} whileHover={{ y: -4 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">👤</div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-gray-900 truncate">{u.name}</p>
                                    <p className="text-sm text-gray-400 truncate mt-0.5">{u.email}</p>
                                    <p className="text-xs text-gray-500 mt-1">{u.village}</p>
                                    <span className={`badge mt-2 ${u.role === "admin" ? "badge-red" : u.role === "owner" ? "badge-blue" : "badge-green"}`}>{u.role}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
