import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    MdTrendingUp, MdTrendingDown, MdPsychology, 
    MdSmartToy, MdSend, MdHistory, MdLocationOn,
    MdAutoGraph, MdPower, MdSettings, MdWarning
} from "react-icons/md";
import { Droplet, Thermometer, CloudRain } from "lucide-react";
import { toast } from "react-hot-toast";
import { format, subDays } from "date-fns";
import { 
    XAxis, YAxis, ResponsiveContainer, AreaChart, Area, LineChart, Line, CartesianGrid, Tooltip 
} from 'recharts';

const MandiBotWidget = () => {
    // Tab State: 'pricing' or 'monitor'
    const [activeTab, setActiveTab] = useState('pricing');

    // --- MANDI PRICING DATA & LOGIC ---
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCrop, setSelectedCrop] = useState("");
    const [selectedMandi, setSelectedMandi] = useState("");
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [chatMessages, setChatMessages] = useState([{ role: 'bot', content: 'Select details. 🌾' }]);
    const [userInput, setUserInput] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    
    const chatEndRef = useRef(null);
    const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

    const fetchMandiData = async () => {
        const apiKey = import.meta.env.VITE_DATA_GOV_IN_API_KEY;
        try {
            const res = await fetch(`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&limit=100`);
            const data = await res.json();
            if (data.records) setPrices(data.records);
        } catch (error) { setPrices(generateMockMandiData()); } finally { setLoading(false); }
    };

    const generateMockMandiData = () => {
        const crops = ["Soyabean", "Wheat", "Potato", "Cotton"];
        const mandis = ["APMC Nashik", "Jalgaon", "Agra", "Rajkot"];
        let data = [];
        crops.forEach(c => mandis.forEach(m => {
            const base = 5000 + Math.random() * 500;
            data.push({ district: m, market: m, commodity: c, modal_price: base, arrival_date: format(new Date(), "yyyy-MM-dd") });
            data.push({ district: m, market: m, commodity: c, modal_price: base - 200, arrival_date: format(subDays(new Date(), 1), "yyyy-MM-dd") });
        }));
        return data;
    };

    // --- FARM MONITOR DATA & LOGIC ---
    const [monitorData, setMonitorData] = useState({
        moisture: 42,
        temperature: 28.5,
        humidity: 65,
        motorStatus: false,
        mode: 'AUTO'
    });
    const [monitorHistory, setMonitorHistory] = useState([
        { time: '10:00', moisture: 45, temperature: 27 },
        { time: '11:00', moisture: 43, temperature: 28 },
        { time: '12:00', moisture: 42, temperature: 29 },
    ]);

    useEffect(() => {
        fetchMandiData();
        // Simulate live sensor data
        const interval = setInterval(() => {
            setMonitorData(prev => ({
                ...prev,
                moisture: Math.max(15, Math.min(95, prev.moisture + (Math.random() * 2 - 1.1))),
                temperature: 25 + Math.random() * 8
            }));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(scrollToBottom, [chatMessages]);

    const mandiCrops = useMemo(() => [...new Set(prices.map(p => p.commodity))], [prices]);
    const mandiMarkets = useMemo(() => [...new Set(prices.filter(p => !selectedCrop || p.commodity === selectedCrop).map(p => p.market))], [prices, selectedCrop]);

    const activeAnalytic = useMemo(() => {
        if (!selectedCrop || !selectedMandi) return null;
        const matching = prices.filter(p => p.commodity === selectedCrop && p.market === selectedMandi);
        if (matching.length === 0) return null;
        const sorted = matching.sort((a,b) => new Date(b.arrival_date) - new Date(a.arrival_date));
        const todayPrice = Number(sorted[0]?.modal_price || 0);
        const yesterdayPrice = Number(sorted[1]?.modal_price || (todayPrice * 0.98));
        return { yesterday: yesterdayPrice, today: todayPrice, tomorrow: Math.round(todayPrice * 1.02), trend: (todayPrice - yesterdayPrice) / yesterdayPrice };
    }, [selectedCrop, selectedMandi, prices]);

    useEffect(() => {
        if (activeAnalytic) {
            setIsThinking(true);
            setTimeout(() => {
                const rec = activeAnalytic.trend >= 0 ? "WAIT" : "SELL";
                setAiAnalysis({ recommendation: rec, reason: `Trend is ${rec === "WAIT" ? "Positive" : "Negative"}.` });
                setIsThinking(false);
                setChatMessages(prev => [...prev.slice(-1), { role: 'bot', content: `**${rec}** recommended.` }]);
            }, 500);
        }
    }, [activeAnalytic]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;
        setChatMessages(prev => [...prev.slice(-2), { role: 'user', content: userInput }]);
        setUserInput("");
    };

    return (
        <div className="font-poppins h-full max-h-[420px] overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
            {/* Nano Tab Switcher */}
            <div className="flex bg-gray-50 border-b border-gray-100">
                <button 
                    onClick={() => setActiveTab('pricing')}
                    className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'pricing' ? 'bg-white text-green-600 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Mandi Intel
                </button>
                <button 
                    onClick={() => setActiveTab('monitor')}
                    className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Farm Monitor
                </button>
            </div>

            <div className="p-3 flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    {activeTab === 'pricing' ? (
                        <motion.div 
                            key="pricing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-12 gap-3 h-full"
                        >
                            <div className="col-span-8 space-y-2.5">
                                <div className="grid grid-cols-2 gap-2">
                                    <select value={selectedCrop} onChange={e => setSelectedCrop(e.target.value)} className="w-full bg-gray-50 p-1.5 rounded-lg font-bold text-[9px] outline-none border-none cursor-pointer">
                                        <option value="">Crop...</option>
                                        {mandiCrops.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select value={selectedMandi} onChange={e => setSelectedMandi(e.target.value)} className="w-full bg-white border-2 border-green-500 p-1.5 rounded-lg font-bold text-[9px] outline-none cursor-pointer shadow-sm">
                                        <option value="">Mandi...</option>
                                        {mandiMarkets.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    <div className="bg-gray-50 p-2 rounded-xl text-center"><p className="text-[6px] text-gray-400 font-black">YEST</p><p className="text-[10px] font-black">₹{activeAnalytic?.yesterday.toLocaleString() || "--"}</p></div>
                                    <div className="bg-green-600 p-2 rounded-xl text-center text-white"><p className="text-[6px] opacity-80 font-black">TODAY</p><p className="text-[10px] font-black">₹{activeAnalytic?.today.toLocaleString() || "--"}</p></div>
                                    <div className="bg-gray-50 p-2 rounded-xl text-center"><p className="text-[6px] text-gray-400 font-black">PRED</p><p className="text-[10px] font-black">₹{activeAnalytic?.tomorrow.toLocaleString() || "--"}</p></div>
                                </div>
                                <div className="bg-blue-50/50 p-2 rounded-xl flex items-center justify-between border border-blue-100">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-5 h-5 bg-blue-100 rounded-md flex items-center justify-center shrink-0"><MdPsychology className="text-blue-600 text-xs" /></div>
                                        <p className="text-[9px] font-black text-blue-900 truncate">{isThinking ? "Thinking..." : (aiAnalysis?.recommendation || "Select Details")}</p>
                                    </div>
                                    <span className="text-[7px] font-black text-blue-500 bg-white px-1.5 py-0.5 rounded border border-blue-100">{activeAnalytic ? (Math.abs(activeAnalytic.trend * 100).toFixed(1) + "%") : "0%"}</span>
                                </div>
                                <div className="h-20 bg-white rounded-xl border border-gray-50 relative overflow-hidden p-1">
                                    <div className="absolute top-1 left-2 text-[6px] font-black text-gray-300 uppercase tracking-widest">Pricing Wave</div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={activeAnalytic ? [{ p: activeAnalytic.yesterday }, { p: activeAnalytic.today }, { p: activeAnalytic.tomorrow }] : []}>
                                            <Area type="monotone" dataKey="p" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.05} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="col-span-4 h-full flex flex-col">
                                <div className="flex-1 bg-[#1a1c24] rounded-2xl border-2 border-[#2d2f3a] flex flex-col overflow-hidden shadow-lg relative">
                                    <div className="p-1.5 bg-white/5 border-b border-white/5 flex items-center gap-1">
                                        <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center text-[8px] text-white"><MdSmartToy /></div>
                                        <span className="text-[7px] text-white font-black uppercase tracking-tighter">AI Assistant</span>
                                    </div>
                                    <div className="flex-1 p-2 space-y-2 overflow-y-auto no-scrollbar">
                                        {chatMessages.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[95%] rounded-lg px-2 py-1 text-[7.5px] font-medium leading-tight ${msg.role === 'user' ? 'bg-green-600 text-white shadow-sm' : 'bg-white/10 text-gray-300'}`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <form onSubmit={handleSendMessage} className="p-1 bg-[#1a1c24]">
                                        <div className="bg-[#2d2f3a] rounded-lg p-0.5 flex gap-1">
                                            <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="Ask..." className="flex-1 bg-transparent px-1.5 text-[7px] text-white outline-none" />
                                            <button type="submit" className="w-4 h-4 bg-green-600 text-white rounded-md flex items-center justify-center transition-transform active:scale-90"><MdSend size={6} /></button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="monitor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col h-full space-y-2.5"
                        >
                            {/* Nano Monitor Header */}
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-5 h-5 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center"><MdAutoGraph /></div>
                                    Live AgriSense
                                </h4>
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${monitorData.motorStatus ? 'bg-green-50 text-green-600 border border-green-100 animate-pulse' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                    Motor {monitorData.motorStatus ? 'Running' : 'Offline'}
                                </div>
                            </div>

                            {/* Nano Metric Grid */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100 flex flex-col items-center">
                                    <Droplet className="text-blue-500 w-3.5 h-3.5 mb-1" />
                                    <p className="text-[6px] text-blue-900/50 font-black uppercase">Moisture</p>
                                    <p className="text-xs font-black text-blue-900">{monitorData.moisture.toFixed(1)}%</p>
                                </div>
                                <div className="bg-orange-50/50 p-2 rounded-xl border border-orange-100 flex flex-col items-center">
                                    <Thermometer className="text-orange-500 w-3.5 h-3.5 mb-1" />
                                    <p className="text-[6px] text-orange-900/50 font-black uppercase">Temp</p>
                                    <p className="text-xs font-black text-orange-900">{monitorData.temperature.toFixed(1)}°C</p>
                                </div>
                                <div className="bg-cyan-50/50 p-2 rounded-xl border border-cyan-100 flex flex-col items-center">
                                    <CloudRain className="text-cyan-500 w-3.5 h-3.5 mb-1" />
                                    <p className="text-[6px] text-cyan-900/50 font-black uppercase">Humid</p>
                                    <p className="text-xs font-black text-cyan-900">{monitorData.humidity}%</p>
                                </div>
                            </div>

                            {/* Nano Monitor Chart */}
                            <div className="bg-white rounded-xl border border-gray-100 p-2 flex-1 min-h-[100px] relative">
                                <div className="absolute top-1 left-2 text-[6px] font-black text-gray-300 uppercase tracking-widest">Moisture Trend</div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={monitorHistory}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="time" hide />
                                        <YAxis hide domain={[0, 100]} />
                                        <Tooltip content={() => null} />
                                        <Line type="monotone" dataKey="moisture" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Quick Controls */}
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setMonitorData(p => ({...p, mode: p.mode === 'AUTO' ? 'MANUAL' : 'AUTO'}))}
                                    className="bg-gray-900 text-white rounded-xl py-2 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                                >
                                    <MdSettings className="text-xs text-blue-400" />
                                    <div className="text-left">
                                        <p className="text-[5px] opacity-70 font-black uppercase leading-none">System Mode</p>
                                        <p className="text-[8px] font-black uppercase leading-tight">{monitorData.mode}</p>
                                    </div>
                                </button>
                                <button 
                                    onClick={() => monitorData.mode === 'MANUAL' && setMonitorData(p => ({...p, motorStatus: !p.motorStatus}))}
                                    className={`rounded-xl py-2 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm border ${monitorData.motorStatus ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'} ${monitorData.mode === 'AUTO' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <MdPower className="text-xs" />
                                    <div className="text-left">
                                        <p className="text-[5px] opacity-70 font-black uppercase leading-none">Motor Switch</p>
                                        <p className="text-[8px] font-black uppercase leading-tight">{monitorData.motorStatus ? 'STOP' : 'START'}</p>
                                    </div>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MandiBotWidget;
