import React, { useState, useEffect } from 'react';
import { firestore } from '../firebase';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import useAuthStore from '../store/useAuthStore';
import { motion } from 'framer-motion';
import { 
    MdTrendingUp, MdTrendingDown, MdPower, MdSettings, 
    MdWarning, MdSchedule, MdHistory, MdAutoGraph
} from "react-icons/md";
import { Droplet, Thermometer, CloudRain } from "lucide-react";
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

const FarmMonitoring = () => {
    const { user } = useAuthStore();
    const deviceId = user?.deviceId || "esp32_01";
    
    const [monitorData, setMonitorData] = useState({
        mode: 'AUTO', 
        motorOverride: false,
        moisture: 42, 
        temperature: 28.5, 
        humidity: 65, 
        motorStatus: false
    });

    const [history, setHistory] = useState([
        { timestamp: new Date().toISOString(), moisture: 45, temperature: 27 },
        { timestamp: new Date(Date.now() - 3600000).toISOString(), moisture: 43, temperature: 28 },
        { timestamp: new Date(Date.now() - 7200000).toISOString(), moisture: 42, temperature: 29 },
    ]);

    useEffect(() => {
        if (!deviceId) return;
        
        const deviceRef = doc(firestore, `farm_devices`, deviceId);
        const unsub = onSnapshot(deviceRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setMonitorData(prev => ({
                    ...prev,
                    ...data
                }));
            } else {
                // Seed initial data if device node is empty!
                setDoc(deviceRef, {
                    mode: 'AUTO', 
                    motorOverride: false,
                    moisture: 42, 
                    temperature: 28.5, 
                    humidity: 65, 
                    motorStatus: false
                });
            }
        });
        
        return () => unsub();
    }, [deviceId]);

    useEffect(() => {
        const interval = setInterval(() => {
            setHistory(prev => {
                const lastMoist = prev[0]?.moisture || 42;
                const newMoist = Math.max(10, Math.min(95, lastMoist + (Math.random() * 2 - 1.1)));
                return [{ timestamp: new Date().toISOString(), moisture: newMoist, temperature: 28.5 }, ...prev].slice(0, 20);
            });
        }, 3000); 
        return () => clearInterval(interval);
    }, []);

    const toggleMode = async () => {
        const newMode = monitorData.mode === 'AUTO' ? 'MANUAL' : 'AUTO';
        try {
            await updateDoc(doc(firestore, `farm_devices`, deviceId), { mode: newMode });
        } catch (error) {
            console.error("Failed to update mode:", error);
        }
    };

    const toggleMotor = async () => {
        if (monitorData.mode === 'AUTO') return;
        const newStatus = !monitorData.motorStatus;
        try {
            await updateDoc(doc(firestore, `farm_devices`, deviceId), {
                motorStatus: newStatus,
                motorOverride: newStatus
            });
        } catch (error) {
            console.error("Failed to toggle motor:", error);
        }
    };

    const formattedHistory = history.map(d => ({
        ...d,
        time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-poppins">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 font-bold text-sm mb-2 px-3 py-1 bg-blue-50 w-fit rounded-full border border-blue-100 uppercase tracking-widest">
                            <MdTrendingUp /> Real-time Analytics
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Farm Monitoring</h1>
                        <p className="text-gray-500 mt-2 font-medium max-w-xl">Monitor soil health, atmospheric conditions, and control irrigation systems remotely.</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         <div className={`px-4 py-2 rounded-2xl font-black shadow-sm flex items-center gap-2 text-xs uppercase tracking-widest border transition-all ${
                            monitorData.motorStatus 
                            ? 'bg-green-600 border-green-500 text-white animate-pulse' 
                            : 'bg-white border-gray-100 text-gray-400'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${monitorData.motorStatus ? 'bg-white' : 'bg-gray-300'}`} />
                            Irrigation {monitorData.motorStatus ? 'RUNNING' : 'STANDBY'}
                        </div>
                        <div className="px-4 py-2 rounded-2xl bg-white border border-gray-100 font-black text-gray-400 text-xs uppercase tracking-widest flex items-center gap-2">
                             <MdSchedule className="text-blue-500" /> Auto-Sync: Active
                        </div>
                    </div>
                </div>

                {/* Main Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left: Alerts & Metrics */}
                    <div className="lg:col-span-8 space-y-6">
                        
                        {/* Alerts */}
                        {monitorData.moisture < 25 && (
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-center gap-4 border border-amber-100 shadow-sm"
                            >
                                <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
                                    <MdWarning className="text-xl" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Critical Alert</p>
                                    <p className="text-sm font-bold text-amber-900 leading-tight">Soil moisture is at {Number(monitorData.moisture || 0).toFixed(1)}%. Irrigation recommended.</p>
                                </div>
                            </motion.div>
                        )}

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-blue-500 transition-colors cursor-pointer relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Droplet className="w-20 h-20 text-blue-500" />
                                </div>
                                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-sm">
                                    <Droplet className="text-blue-500 w-8 h-8" />
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Soil Moisture</p>
                                <p className="text-4xl font-black text-gray-900">{Number(monitorData.moisture || 0).toFixed(1)}%</p>
                            </div>

                            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-orange-500 transition-colors cursor-pointer relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Thermometer className="w-20 h-20 text-orange-500" />
                                </div>
                                <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-sm">
                                    <Thermometer className="text-orange-500 w-8 h-8" />
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Temperature</p>
                                <p className="text-4xl font-black text-gray-900">{Number(monitorData.temperature || 0).toFixed(1)}°C</p>
                            </div>

                            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-emerald-500 transition-colors cursor-pointer relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <CloudRain className="w-20 h-20 text-emerald-500" />
                                </div>
                                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-sm">
                                    <CloudRain className="text-emerald-500 w-8 h-8" />
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Humidity</p>
                                <p className="text-4xl font-black text-gray-900">{Number(monitorData.humidity || 0).toFixed(0)}%</p>
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                    <MdAutoGraph className="text-blue-500" /> Live Moisture Index
                                </h3>
                            </div>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={formattedHistory}>
                                        <defs>
                                            <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="time" hide />
                                        <YAxis hide domain={[0, 100]} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ fontWeight: 'black', color: '#111827' }}
                                        />
                                        <Area type="monotone" dataKey="moisture" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorMoisture)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Right: Controls Page */}
                    <div className="lg:col-span-4 h-full">
                        <div className="bg-gray-900 rounded-[32px] h-full p-8 flex flex-col shadow-2xl relative overflow-hidden group">
                            {/* Background Glow */}
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full transition-colors duration-1000 ${monitorData.motorStatus ? 'bg-green-500/20' : 'bg-red-500/10'}`} />
                            
                            <div className="relative flex-1 flex flex-col">
                                <h3 className="text-white font-black text-lg tracking-tight mb-8">Device Interface</h3>

                                <div className="space-y-10">
                                    {/* System Mode Switch */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                                            <span className="text-white/40 flex items-center gap-2 italic"><MdSettings className="text-blue-400" /> Mode Select</span>
                                            <span className={`px-3 py-1 rounded-full border ${monitorData.mode === 'AUTO' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-purple-500/20 border-purple-500 text-purple-400'}`}>
                                                {monitorData.mode}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={toggleMode}
                                            className="w-full py-4 bg-white/10 hover:bg-white/15 border border-white/5 rounded-2xl text-white font-black text-sm transition-all active:scale-95 shadow-lg group-hover:border-white/10 italic"
                                        >
                                            Switch to {monitorData.mode === 'AUTO' ? 'MANUAL' : 'AUTO'}
                                        </button>
                                    </div>

                                    {/* Motor Toggle */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] italic ml-1">Manual Override</p>
                                        <button 
                                            onClick={toggleMotor}
                                            disabled={monitorData.mode === 'AUTO'}
                                            className={`w-full py-10 rounded-[28px] flex flex-col items-center justify-center gap-3 transition-all ${
                                                monitorData.mode === 'AUTO' 
                                                ? 'bg-white/5 border border-white/5 cursor-not-allowed grayscale' 
                                                : (monitorData.motorStatus 
                                                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-[0_10px_30px_rgba(16,185,129,0.3)] border-green-400 hover:scale-[1.02]' 
                                                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                                )
                                            }`}
                                        >
                                            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 ${monitorData.motorStatus ? 'bg-white text-green-600 rotate-180' : 'bg-white/10 text-white/40'}`}>
                                                <MdPower size={32} />
                                            </div>
                                            <div className="text-center">
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${monitorData.motorStatus ? 'text-white' : 'text-white/40'}`}>
                                                    {monitorData.mode === 'AUTO' ? 'Mode: AUTO' : (monitorData.motorStatus ? 'Active' : 'Standby')}
                                                </p>
                                                <p className={`text-xl font-black italic ${monitorData.motorStatus ? 'text-white' : 'text-gray-500'}`}>
                                                    {monitorData.motorStatus ? 'SHUT DOWN' : 'START MOTOR'}
                                                </p>
                                            </div>
                                        </button>
                                        {monitorData.mode === 'AUTO' && (
                                            <p className="text-center text-[9px] font-bold text-white/20 uppercase tracking-widest animate-pulse">Switch to Manual to bypass auto-logic</p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40"><MdHistory /></div>
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">Last Command: 2m ago</span>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-ping" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FarmMonitoring;
