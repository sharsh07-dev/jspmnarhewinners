import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { ref, onValue, update, runTransaction } from "firebase/database";
import { 
    MdWorkOutline, MdCheck, MdClose, MdChat, MdLocationOn, 
    MdAttachMoney, MdCalendarToday, MdFilterList,
    MdChevronLeft, MdChevronRight, MdEventBusy, MdEventAvailable
} from "react-icons/md";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import useAuthStore from "../store/useAuthStore";
import toast from "react-hot-toast";

const LabourMyWork = () => {
    const { authUser } = useAuthStore();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all"); 

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const busyDatesMap = useMemo(() => {
        const map = {};
        requests.filter(r => r.status === 'accepted').forEach(r => {
            map[r.date] = r;
        });
        return map;
    }, [requests]);

    const daysInMonth = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    useEffect(() => {
        if (!authUser?.uid) return;
        const reqRef = ref(db, "labour_requests");
        const unsub = onValue(reqRef, (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(req => req.labourerId === authUser.uid)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setRequests(list);
            } else {
                setRequests([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [authUser]);

    const handleRequestAction = async (request, action, counterPrice = null) => {
        try {
            // Conflict check
            if ((action === 'accepted' || action === 'countered') && busyDatesMap[request.date]) {
                toast.error(`Auto-rejected! You are already booked on ${request.date} 📅`);
                return;
            }

            // Expiration Logic (15 min)
            const reqAgeMins = (new Date() - new Date(request.createdAt)) / 60000;
            if (reqAgeMins > 15 && action === 'accepted') {
                toast.error("This request has expired (15 mins timeout)");
                await update(ref(db, `labour_requests/${request.id}`), { status: 'expired' });
                return;
            }

            if (action === 'accepted' && request.campaignId) {
                let finalStatus = 'accepted';
                const campRef = ref(db, `labour_campaigns/${request.campaignId}`);
                
                const result = await runTransaction(campRef, (campaign) => {
                    if (campaign) {
                        if (campaign.confirmedCount < campaign.requiredSlots) {
                            campaign.confirmedCount = (campaign.confirmedCount || 0) + 1;
                            if (!campaign.confirmedRequests) campaign.confirmedRequests = {};
                            campaign.confirmedRequests[request.id] = Date.now();
                            campaign._assignedNow = true;
                        } else {
                            if (!campaign.waitlistedRequests) campaign.waitlistedRequests = {};
                            campaign.waitlistedRequests[request.id] = Date.now();
                            campaign._assignedNow = false;
                        }
                    }
                    return campaign;
                });

                if (result?.snapshot?.val()?._assignedNow === false) {
                    finalStatus = 'waitlisted';
                    toast('Slots filled! Added to Waitlist ⏳', { icon: '⏳' });
                } else {
                    toast.success('Confirmed! You got the job ✅');
                }

                const updates = { status: finalStatus };
                if (counterPrice) updates.counterPrice = Number(counterPrice);
                await update(ref(db, `labour_requests/${request.id}`), updates);
                
                return;

            } else if (action === 'cancelled_by_labour' && request.campaignId) {
                let promotedReqId = null;
                const campRef = ref(db, `labour_campaigns/${request.campaignId}`);
                
                await runTransaction(campRef, (campaign) => {
                    if (campaign && campaign.confirmedRequests && campaign.confirmedRequests[request.id]) {
                        delete campaign.confirmedRequests[request.id];
                        campaign.confirmedCount = Math.max(0, campaign.confirmedCount - 1);
                        
                        // Auto-Promote waitlisted if any
                        if (campaign.waitlistedRequests && Object.keys(campaign.waitlistedRequests).length > 0) {
                            const waitlistedIds = Object.keys(campaign.waitlistedRequests);
                            waitlistedIds.sort((a,b) => campaign.waitlistedRequests[a] - campaign.waitlistedRequests[b]);
                            
                            promotedReqId = waitlistedIds[0];
                            if (!campaign.confirmedRequests) campaign.confirmedRequests = {};
                            campaign.confirmedRequests[promotedReqId] = Date.now();
                            delete campaign.waitlistedRequests[promotedReqId];
                            campaign.confirmedCount++;
                        }
                    }
                    return campaign;
                });

                await update(ref(db, `labour_requests/${request.id}`), { status: 'cancelled' });
                toast.error("You have cancelled this job.");

                if (promotedReqId) {
                    // Update the newly promoted request
                    await update(ref(db, `labour_requests/${promotedReqId}`), { status: 'accepted' });
                }
                
                return;
            }

            // Normal flow
            const updates = { status: action };
            if (counterPrice) updates.counterPrice = Number(counterPrice);
            await update(ref(db, `labour_requests/${request.id}`), updates);
            toast.success(`Request ${action}!`);
        } catch (err) { toast.error("Action failed"); console.error(err); }
    };

    const filteredRequests = useMemo(() => {
        if (filter === "all") return requests;
        return requests.filter(r => r.status === filter);
    }, [requests, filter]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin h-10 w-10 border-4 border-yellow-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-16 pb-12 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-display">Find Work</h1>
                        <p className="text-gray-500 text-sm font-medium">Review and negotiate hiring proposals from local farmers.</p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar">
                        {["all", "sent", "accepted", "countered"].map(f => (
                            <button 
                                key={f} 
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    filter === f ? "bg-gray-900 text-white shadow-lg" : "text-gray-400 hover:text-gray-600"
                                }`}
                            >
                                {f === 'sent' ? 'New' : f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* --- MY WORK CALENDAR --- */}
                <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm my-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2 font-display"><MdCalendarToday/> My Availability</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div className="flex justify-between items-center mb-4 text-sm">
                                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100"><MdChevronLeft className="text-xl"/></button>
                                <h3 className="font-bold text-gray-900 tracking-widest uppercase text-sm mt-1">{format(currentMonth, "MMMM yyyy")}</h3>
                                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100"><MdChevronRight className="text-xl"/></button>
                            </div>
                            
                            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] uppercase font-black text-gray-400 tracking-widest">
                                {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => <div key={d}>{d}</div>)}
                            </div>
                            
                            <div className="grid grid-cols-7 gap-2">
                                {daysInMonth.map((day, idx) => {
                                    const dateStr = format(day, "yyyy-MM-dd");
                                    const isBusy = !!busyDatesMap[dateStr];
                                    const isSelected = isSameDay(day, selectedDate);
                                    const isCurrMonth = isSameMonth(day, currentMonth);
                                    
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedDate(day)}
                                            className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-bold transition-all relative
                                                ${!isCurrMonth ? 'text-gray-300 bg-transparent opacity-50' : 
                                                  isSelected ? 'ring-2 ring-black bg-gray-100 shadow-md' :
                                                  isBusy ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-transparent'}
                                                ${isToday(day) && !isSelected ? 'border-2 border-dashed border-gray-400' : ''}
                                            `}
                                        >
                                            <span className="z-10">{format(day, "d")}</span>
                                        </button>
                                    )
                                })}
                            </div>
                            
                            <div className="flex items-center gap-5 mt-6 text-[10px] tracking-widest uppercase font-black">
                                <div className="flex items-center gap-2 text-red-600"><div className="w-4 h-4 bg-red-100 rounded-md border border-red-300 flex items-center justify-center text-[10px]" /> Booked</div>
                                <div className="flex items-center gap-2 text-green-600"><div className="w-4 h-4 bg-green-100 rounded-md border border-green-300 flex items-center justify-center text-[10px]" /> Available</div>
                            </div>
                        </div>

                        <div className="bg-gray-50/50 rounded-[24px] p-6 border border-gray-100 flex flex-col">
                            <h3 className="text-[10px] tracking-widest uppercase font-black text-gray-400 mb-4">{format(selectedDate, "MMM d, yyyy")} • Status</h3>
                            
                            {busyDatesMap[format(selectedDate, "yyyy-MM-dd")] ? (
                                <div className="bg-white border border-red-100 shadow-sm shadow-red-50 rounded-2xl p-5 mb-4 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
                                    <div className="flex items-center gap-2 text-red-600 font-bold mb-3 uppercase tracking-widest text-[9px]">
                                        <MdEventBusy className="text-base"/> BUSY - Job Accepted
                                    </div>
                                    <h4 className="font-black text-gray-900 text-lg">{busyDatesMap[format(selectedDate, "yyyy-MM-dd")].farmerName}'s Farm</h4>
                                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{busyDatesMap[format(selectedDate, "yyyy-MM-dd")].skill}</p>
                                    <div className="mt-4 pt-4 border-t border-red-50 flex items-center justify-between">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Base Wage</p>
                                        <p className="text-sm font-black text-red-600 flex items-center gap-1"><MdAttachMoney/> ₹{busyDatesMap[format(selectedDate, "yyyy-MM-dd")].offeredPrice} / day</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white border-2 border-dashed border-green-100 rounded-2xl p-8 mb-4 flex flex-col items-center justify-center text-center h-full min-h-[160px]">
                                    <div className="text-green-500 text-4xl mb-3"><MdEventAvailable /></div>
                                    <h4 className="font-black text-green-800 text-lg">You are Free!</h4>
                                    <p className="text-[10px] font-bold text-green-600/60 mt-2 uppercase tracking-widest">Available to accept jobs</p>
                                </div>
                            )}
                            
                            <div className="mt-auto border-t border-gray-200 pt-5">
                                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-3">Upcoming Active Jobs</p>
                                {requests.filter(r => r.status === 'accepted' && new Date(r.date) >= new Date(format(new Date(), "yyyy-MM-dd"))).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, 3).length === 0 ? (
                                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No upcoming jobs.</p>
                                ) : requests.filter(r => r.status === 'accepted' && new Date(r.date) >= new Date(format(new Date(), "yyyy-MM-dd"))).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, 3).map(r => (
                                    <div key={r.id} className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-100 px-3 -mx-3 rounded-xl transition" onClick={() => {
                                         setSelectedDate(parseISO(r.date));
                                         setCurrentMonth(parseISO(r.date));
                                    }}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-red-400 rounded-full" />
                                            <div>
                                                <p className="font-black text-[13px] text-gray-900">{format(parseISO(r.date), "MMM dd")}</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hidden sm:block bg-gray-100 px-2 py-1 rounded-md">{r.skill.substring(0,10)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4 mt-8">
                    <h2 className="text-xl font-black text-gray-900 font-display">Contract Offers</h2>
                </div>
                
                {filteredRequests.length === 0 ? (
                    <div className="bg-white rounded-[40px] p-20 text-center border border-gray-100 shadow-sm">
                        <div className="text-6xl mb-6">🌾</div>
                        <h3 className="text-xl font-bold text-gray-800">No work proposals found</h3>
                        <p className="text-gray-400 max-w-xs mx-auto mt-2">Farmers will reach out to you based on your skills and location. Keep your profile updated!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        <AnimatePresence mode="popLayout">
                            {filteredRequests.map(req => (
                                <motion.div 
                                    key={req.id} 
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
                                >
                                    {req.status === 'sent' && (
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-500" />
                                    )}

                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="space-y-4 flex-grow">
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-yellow-100 italic">
                                                    {req.skill}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                                                    <MdCalendarToday /> {req.date}
                                                </span>
                                            </div>

                                            <div>
                                                <h3 className="text-xl font-black text-gray-900 leading-tight">Project Offer from {req.farmerName}</h3>
                                                <p className="text-[11px] text-gray-500 font-medium mt-1">Location: Local Farm (Jalgaon District)</p>
                                            </div>

                                            <div className="flex items-center gap-8 pt-2">
                                                <div className="p-3 bg-green-50 rounded-2xl border border-green-100">
                                                    <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Offered Wage</p>
                                                    <p className="text-2xl font-black text-green-700">₹{req.offeredPrice}</p>
                                                </div>
                                                
                                                {req.counterPrice ? (
                                                    <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100">
                                                        <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1">Your Counter</p>
                                                        <p className="text-2xl font-black text-orange-700">₹{req.counterPrice}</p>
                                                    </div>
                                                ) : (
                                                    <div className="hidden md:block">
                                                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Status</p>
                                                        <p className={`text-xs font-black uppercase ${req.status === 'sent' ? 'text-yellow-600' : 'text-gray-400'}`}>{req.status}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row md:flex-col items-stretch md:items-end justify-center gap-2 min-w-[160px]">
                                            {req.status === 'sent' && (
                                                <>
                                                    <button 
                                                        disabled={!!busyDatesMap[req.date]}
                                                        onClick={() => handleRequestAction(req, 'accepted')} 
                                                        className={`px-6 py-3.5 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition shadow-xl ${busyDatesMap[req.date] ? 'bg-gray-300 shadow-none cursor-not-allowed' : 'bg-gray-900 hover:bg-black shadow-gray-200'}`}>
                                                        <MdCheck className="text-lg" /> {busyDatesMap[req.date] ? 'Date Booked ❌' : 'Accept Offer'}
                                                    </button>
                                                    <button 
                                                        disabled={!!busyDatesMap[req.date]}
                                                        onClick={() => {
                                                            const cp = prompt("Enter your counter daily wage", req.offeredPrice + 50);
                                                            if (cp) handleRequestAction(req, 'countered', cp);
                                                        }} className={`px-6 py-3.5 bg-white border-2 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition ${busyDatesMap[req.date] ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-orange-200 text-orange-600 hover:bg-orange-50'}`}>
                                                        <MdChat className="text-lg" /> Negotiate
                                                    </button>
                                                    <button onClick={() => handleRequestAction(req, 'rejected')} className="px-6 py-3 text-red-400 font-bold text-xs uppercase hover:bg-red-50 rounded-2xl transition">
                                                        Decline
                                                    </button>
                                                </>
                                            )}
                                            {req.status === 'accepted' && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-center border bg-green-500 text-white border-green-500 shadow-lg shadow-green-100">
                                                        Hired ✅
                                                    </div>
                                                    <button onClick={() => {
                                                        if(confirm("Cancel this job? This will automatically promote someone from the waitlist.")) {
                                                            handleRequestAction(req, 'cancelled_by_labour');
                                                        }
                                                    }} className="text-[10px] uppercase font-bold text-red-500 hover:text-red-700 mx-auto">
                                                        Cancel Job ✕
                                                    </button>
                                                </div>
                                            )}
                                            {req.status === 'waitlisted' && (
                                                <div className="px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.1em] text-center bg-amber-100/50 text-amber-700 border border-amber-200 flex flex-col">
                                                    <span>⏳ Waitlisted</span>
                                                    <span className="text-[9px] mt-1 text-amber-600/70">Will auto-promote if slot opens</span>
                                                </div>
                                            )}
                                            {(req.status !== 'sent' && req.status !== 'accepted' && req.status !== 'waitlisted') && (
                                                <div className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-center border ${
                                                    req.status === 'countered' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-gray-100 text-gray-400 border-transparent'
                                                }`}>
                                                    {req.status}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LabourMyWork;
