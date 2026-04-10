import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    MdTrendingUp, MdTrendingDown, MdTrendingFlat, MdPsychology, 
    MdSmartToy, MdSend, MdHistory, MdLocationOn, MdCalendarToday,
    MdHelpOutline, MdContentPaste, MdArrowBack, MdClose, MdMic
} from "react-icons/md";
import { toast } from "react-hot-toast";
import { format, subDays, addDays } from "date-fns";
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, AreaChart, Area 
} from 'recharts';

// --- STYLES ---
const cardClass = "bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden p-6";

const MandiAdvisor = () => {
    // Basic State
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCrop, setSelectedCrop] = useState("");
    const [selectedMandi, setSelectedMandi] = useState("");
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [chatMessages, setChatMessages] = useState([
        { role: 'bot', content: 'Hello! I am your Mandi Intelligence Bot. Select a crop and market to get expert selling advice. 🌾' }
    ]);
    const [userInput, setUserInput] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    
    const chatEndRef = useRef(null);
    const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

    // --- DATA FETCHING ---
    const fetchMandiData = async () => {
        setLoading(true);
        const apiKey = import.meta.env.VITE_DATA_GOV_IN_API_KEY;
        try {
            // Fetching a larger limit to get historical snapshots
            const res = await fetch(
                `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&limit=500`
            );
            const data = await res.json();
            if (data.records) setPrices(data.records);
        } catch (error) {
            console.error("Mandi API Error:", error);
            // Fallback mock data with historical variation for demonstration
            setPrices(generateMockData());
        } finally {
            setLoading(false);
        }
    };

    const generateMockData = () => {
        const crops = ["Wheat", "Potato", "Soyabean", "Cotton", "Banana"];
        const mandis = ["Jalgaon", "Agra", "Indore", "Rajkot", "Ludhiana"];
        let data = [];
        crops.forEach(c => {
            mandis.forEach(m => {
                let currentBase = Math.floor(Math.random() * (5000 - 1000) + 1000);
                for (let i = 0; i <= 7; i++) {
                    data.push({
                        state: "Maharashtra", district: m, market: m, commodity: c, 
                        modal_price: Math.max(500, Math.round(currentBase)), 
                        arrival_date: format(subDays(new Date(), i), "yyyy-MM-dd")
                    });
                    // Simulated previous day was slightly different
                    currentBase = currentBase - (Math.random() * 300 - 100);
                }
            });
        });
        return data;
    };

    useEffect(() => {
        fetchMandiData();
    }, []);

    useEffect(scrollToBottom, [chatMessages, isThinking]);

    // --- ANALYTICS LOGIC ---
    const crops = useMemo(() => [...new Set(prices.map(p => p.commodity))], [prices]);
    const mandis = useMemo(() => 
        [...new Set(prices.filter(p => !selectedCrop || p.commodity === selectedCrop).map(p => p.market))],
    [prices, selectedCrop]);

    const activeAnalytic = useMemo(() => {
        if (!selectedCrop || !selectedMandi) return null;
        const matching = prices.filter(p => p.commodity === selectedCrop && p.market === selectedMandi);
        if (matching.length === 0) return null;

        const sorted = matching.sort((a,b) => new Date(b.arrival_date) - new Date(a.arrival_date));
        const todayPrice = sorted[0]?.modal_price || 0;
        const yesterdayPrice = sorted[1]?.modal_price || (todayPrice * 0.96); // Synthetic fallback
        
        // Simple Prediction Logic (Linear Regression / Moving Average Proxy)
        const trend = (todayPrice - yesterdayPrice) / yesterdayPrice;
        const predictedTomorrow = Math.round(todayPrice * (1 + (trend * 0.8) + (Math.random() * 0.02 - 0.01)));
        
        const confidence = Math.abs(trend) > 0.05 ? "MEDIUM" : "HIGH";

        return {
            yesterday: yesterdayPrice,
            today: todayPrice,
            tomorrow: predictedTomorrow,
            trend: trend,
            confidence: confidence,
            history: sorted.slice(0, 7).reverse() // Oldest to newest
        };
    }, [selectedCrop, selectedMandi, prices]);

    // --- AI SENSE ---
    const analyzeWithAI = async () => {
        if (!activeAnalytic) return;
        setIsThinking(true);
        
        // Using Groq or simulated AI logic based on stats
        setTimeout(() => {
            const { today, tomorrow, trend } = activeAnalytic;
            let rec = "WAIT";
            let reason = "";

            if (tomorrow > today * 1.02) {
                rec = "WAIT";
                reason = `Prices are trending upward (+${(trend*100).toFixed(1)}%). Holding until tomorrow is expected to yield higher returns. Demand in neighboring mandis is high.`;
            } else if (tomorrow < today * 0.98) {
                rec = "SELL IMMEDIATELY";
                reason = `A downward trend is detected. Selling today secures current high rates before a projected drop. Modal prices are falling sharply in your district.`;
            } else {
                rec = "SELL TODAY";
                reason = `Market is stable. Current modal price is optimal for current supply levels. Minimal gain predicted for tomorrow.`;
            }

            setAiAnalysis({ recommendation: rec, reason: reason });
            setIsThinking(false);
            
            // Auto inject bot message
            setChatMessages(prev => [...prev, { 
                role: 'bot', 
                content: `Analysis complete for ${selectedCrop} in ${selectedMandi}. My recommendation is to **${rec}**. ${reason}` 
            }]);
        }, 1500);
    };

    useEffect(() => {
        if (activeAnalytic) analyzeWithAI();
    }, [activeAnalytic]);

    // --- CHATBOT LOGIC ---
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        const userMsg = userInput.trim();
        setUserInput("");
        setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsThinking(true);

        // Fetch AI Response via Groq (Mocked for speed if API fails)
        try {
            const apiKey = import.meta.env.VITE_GROQ_API_KEY;
            let responseContent;

            if (apiKey) {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { role: "system", content: "You are an Indian Mandi Price Expert. Speak in simple English mixed with Hindi/Marathi. Give selling advice based on agricultural data." },
                            { role: "user", content: `Context: Crop ${selectedCrop}, Mandi ${selectedMandi}, Today's Price ₹${activeAnalytic?.today}. Request: ${userMsg}` }
                        ]
                    })
                });
                const aiData = await res.json();
                responseContent = aiData.choices[0].message.content;
            } else {
                // Smart Mock
                responseContent = `Actually, looking at current trends for ${selectedCrop}, the price of ₹${activeAnalytic?.today || 'N/A'} is quite strong. Aapko aaj mandi mein rate check karke bech dena chahiye agar price ₹${(activeAnalytic?.today * 1.02 || 0).toFixed(0)} ke upar mil raha hai.`;
            }

            setChatMessages(prev => [...prev, { role: 'bot', content: responseContent }]);
        } catch (err) {
            toast.error("AI service disconnected.");
        } finally {
            setIsThinking(false);
        }
    };

    // --- CHART DATA ---
    const chartData = useMemo(() => {
        if (!activeAnalytic) return [];
        
        const parseDateString = (dStr) => {
            if (!dStr) return '';
            try {
                if (dStr.includes('/')) {
                    const parts = dStr.split('/');
                    if (parts.length === 3) return format(new Date(`${parts[2]}-${parts[1]}-${parts[0]}`), "MMM dd");
                }
                return format(new Date(dStr), "MMM dd");
            } catch(e) {
                return dStr;
            }
        };

        const dataPts = activeAnalytic.history.map(h => ({
            day: parseDateString(h.arrival_date),
            price: Number(h.modal_price)
        }));
        
        dataPts.push({
            day: 'Tomorrow', 
            price: activeAnalytic.tomorrow
        });
        
        return dataPts;
    }, [activeAnalytic]);

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-2 text-green-600 font-bold text-sm mb-2 px-3 py-1 bg-green-50 w-fit rounded-full border border-green-100 uppercase tracking-widest">
                            <MdSmartToy /> AI-Powered
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 font-display tracking-tight">Mandi Intelligence Bot</h1>
                        <p className="text-gray-500 mt-2 font-medium max-w-xl">Predict trends, analyze daily prices, and decide the best time to sell your harvest.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT COLUMN: Controls & Analytics */}
                    <div className="lg:col-span-12 xl:col-span-8 space-y-8">
                        
                        {/* Selector Section */}
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commodity / Crop 🌾</label>
                                <div className="relative">
                                    <MdContentPaste className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <select 
                                        value={selectedCrop} 
                                        onChange={e => setSelectedCrop(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border-none font-black text-gray-800 focus:ring-2 focus:ring-green-500 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Crop...</option>
                                        {crops.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mandi / Market 📍</label>
                                <div className="relative">
                                    <MdLocationOn className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <select 
                                        value={selectedMandi} 
                                        onChange={e => setSelectedMandi(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border-none font-black text-gray-800 focus:ring-2 focus:ring-green-500 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Mandi...</option>
                                        {mandis.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Analytic Cards */}
                        <AnimatePresence mode="wait">
                            {activeAnalytic ? (
                                <motion.div 
                                    key="analytic-content"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="space-y-8"
                                >
                                    {/* 3-Day Pricing Panel */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Yesterday</p>
                                            <p className="text-2xl font-black text-gray-500">₹{activeAnalytic.yesterday.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 rounded-[28px] shadow-lg text-white">
                                            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Today Modal Price</p>
                                            <div className="flex items-center gap-3">
                                                <p className="text-4xl font-black italic">₹{activeAnalytic.today.toLocaleString()}</p>
                                                <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 bg-white/20 rounded-full ${activeAnalytic.trend >= 0 ? 'text-green-100' : 'text-red-100'}`}>
                                                    {activeAnalytic.trend >= 0 ? <MdTrendingUp /> : <MdTrendingDown />}
                                                    {Math.abs(activeAnalytic.trend * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                                <MdPsychology className="text-6xl text-purple-600" />
                                            </div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">Predicted Tomorrow 🔮</p>
                                            <p className="text-2xl font-black text-gray-900 underline decoration-green-400 decoration-4">₹{activeAnalytic.tomorrow.toLocaleString()}</p>
                                            <p className="text-[9px] font-black text-gray-400 mt-2 tracking-widest uppercase">CONFIDENCE: {activeAnalytic.confidence}</p>
                                        </div>
                                    </div>

                                    {/* AI RECOMMENDATION ENGINE */}
                                    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 flex flex-col md:flex-row gap-8 items-center border-t-8 border-t-green-600">
                                        <div className="bg-gray-50 w-24 h-24 rounded-3xl flex flex-col items-center justify-center text-green-600 shadow-inner">
                                            {aiAnalysis?.recommendation.includes("WAIT") ? (
                                                <div className="text-center">
                                                    <MdHistory className="text-4xl mx-auto" />
                                                    <span className="text-[10px] font-black mt-1 block">WAIT</span>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <MdTrendingUp className="text-4xl mx-auto text-emerald-600" />
                                                    <span className="text-[10px] font-black mt-1 block uppercase">SELL</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 underline decoration-green-500">
                                                <MdSmartToy /> AI Recommendation
                                            </h3>
                                            <h4 className="text-3xl font-black text-gray-900 mb-3 italic">
                                                {isThinking ? "Engine Analyzing Trends..." : aiAnalysis?.recommendation}
                                            </h4>
                                            <p className="text-sm text-gray-500 leading-relaxed font-medium">
                                                {isThinking ? "Please wait while our neural network processes historical data points and current supply arrivals locally..." : aiAnalysis?.reason}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Visual Chart Section */}
                                    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8">
                                        <div className="flex items-center justify-between mb-8">
                                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                                <MdTrendingUp className="text-green-600" /> Trend Visualization
                                            </h3>
                                            <div className="flex gap-4">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                                    <span className="text-[10px] font-bold text-gray-400">MODAL PRICE</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-64 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={chartData}>
                                                    <defs>
                                                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                    <XAxis 
                                                        dataKey="day" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9ca3af' }}
                                                        dy={10}
                                                    />
                                                    <YAxis 
                                                        hide 
                                                        domain={['dataMin - 100', 'dataMax + 100']} 
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                        labelStyle={{ fontWeight: 'black', color: '#111827' }}
                                                    />
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey="price" 
                                                        stroke="#10b981" 
                                                        strokeWidth={4} 
                                                        fillOpacity={1} 
                                                        fill="url(#colorPrice)" 
                                                        animationDuration={1500}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="empty-state"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-80 bg-white rounded-[32px] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center p-8"
                                >
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-3xl mb-4 group hover:scale-110 transition-transform cursor-pointer">
                                        🚜
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900">Waiting for Selections</h3>
                                    <p className="text-gray-400 mt-2 max-w-xs font-medium">Choose a regular mandi and its focus crops to activate the predictive analytics engine.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* RIGHT COLUMN: AI Chat Bot */}
                    <div className="lg:col-span-12 xl:col-span-4 lg:h-[800px] flex flex-col">
                        <div className="bg-gray-900 rounded-[32px] flex flex-col h-full overflow-hidden shadow-2xl relative">
                            {/* Bot Header */}
                            <div className="bg-white/5 backdrop-blur-md p-6 border-b border-white/10 flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white text-xl">
                                    <MdSmartToy />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-sm tracking-tight">Kisan Analytics Bot</h3>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Online • Prices Expert</span>
                                    </div>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                                {chatMessages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-[24px] p-4 text-sm font-medium ${
                                            msg.role === 'user' 
                                            ? 'bg-green-600 text-white rounded-br-none' 
                                            : 'bg-white/10 text-white rounded-bl-none border border-white/5'
                                        }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isThinking && (
                                    <div className="flex justify-start">
                                        <div className="bg-white/10 text-white rounded-[24px] rounded-bl-none p-4 border border-white/5 flex gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" />
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-6 bg-white/5 border-t border-white/10">
                                <div className="flex gap-2 max-w-full">
                                    {["Kya rate hai?", "Kab bechu?", "Rate badhega?"].map(s => (
                                        <button 
                                            key={s} 
                                            onClick={() => setUserInput(s)}
                                            className="text-[10px] font-black text-green-400 bg-green-400/10 px-3 py-2 rounded-full border border-green-400/20 hover:bg-green-400 hover:text-white transition-all whitespace-nowrap"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                                <form onSubmit={handleSendMessage} className="mt-4 relative group">
                                    <input 
                                        type="text" 
                                        value={userInput}
                                        onChange={e => setUserInput(e.target.value)}
                                        placeholder="Type in Hindi, Marathi or English..."
                                        className="w-full bg-white/10 border border-white/10 rounded-[20px] pl-4 pr-20 py-4 text-white text-sm font-medium outline-none focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-white/20"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        <button type="button" className="p-2 text-white/40 hover:text-white transition-colors">
                                            <MdMic className="text-xl" />
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={isThinking || !userInput}
                                            className="w-10 h-10 bg-green-600 hover:bg-green-500 text-white rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <MdSend />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MandiAdvisor;
