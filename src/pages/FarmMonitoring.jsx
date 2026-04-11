import React, { useState, useEffect } from 'react';
import { firestore } from '../firebase';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import useAuthStore from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MdTrendingUp, MdTrendingDown, MdPower, MdSettings, 
    MdWarning, MdSchedule, MdHistory, MdAutoGraph, MdThermostat, MdWaterDrop,
    MdCloud, MdWbSunny, MdAir, MdScience, MdLightbulb, MdSmartToy, MdDoubleArrow
} from "react-icons/md";
import { Droplet, Thermometer, CloudRain, Wind, Sun, Beaker } from "lucide-react";
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
    BarChart, Bar, Cell
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const FarmMonitoring = () => {
    const { user } = useAuthStore();
    const deviceId = user?.deviceId || "esp32_01";
    
    const [monitorData, setMonitorData] = useState({
        mode: 'AUTO', 
        motorOverride: false,
        moisture: 42, 
        temperature: 28.5, 
        humidity: 65, 
        motorStatus: false,
        nitrogen: 45,
        phosphorus: 38,
        potassium: 52,
        waterFlow: 0.8 // Liters per minute
    });

    const [history, setHistory] = useState([
        { timestamp: new Date().toISOString(), moisture: 45, temperature: 27 },
        { timestamp: new Date(Date.now() - 3600000).toISOString(), moisture: 43, temperature: 28 },
        { timestamp: new Date(Date.now() - 7200000).toISOString(), moisture: 42, temperature: 29 },
    ]);

    const [weather, setWeather] = useState({
        current: 31,
        condition: 'Sunny',
        wind: 12,
        forecast: [
            { day: 'Tomorrow', temp: 32, icon: <MdWbSunny className="text-orange-400" /> },
            { day: 'Mon', temp: 29, icon: <MdCloud className="text-blue-400" /> },
            { day: 'Tue', temp: 30, icon: <MdWbSunny className="text-orange-400" /> },
        ]
    });

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
                setDoc(deviceRef, {
                    mode: 'AUTO', 
                    motorOverride: false,
                    moisture: 42, 
                    temperature: 28.5, 
                    humidity: 65, 
                    motorStatus: false,
                    nitrogen: 45,
                    phosphorus: 38,
                    potassium: 52,
                    waterFlow: 0
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

    const npkData = [
        { name: 'N', value: monitorData.nitrogen || 0, color: '#10b981' },
        { name: 'P', value: monitorData.phosphorus || 0, color: '#3b82f6' },
        { name: 'K', value: monitorData.potassium || 0, color: '#f59e0b' },
    ];

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-poppins pb-24 md:pb-8">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center gap-2 text-blue-600 font-bold text-sm mb-2 px-3 py-1 bg-blue-50 w-fit rounded-full border border-blue-100 uppercase tracking-widest">
                            <MdTrendingUp /> Multi-Sensor Intelligence
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Farm Monitoring</h1>
                        <p className="text-gray-500 mt-2 font-medium max-w-xl">IoT-powered precision agriculture with real-time telemetry and AI-driven irrigation control.</p>
                    </motion.div>
                    
                    <div className="flex items-center gap-3">
                         <div className={`px-4 py-2 rounded-2xl font-black shadow-sm flex items-center gap-2 text-xs uppercase tracking-widest border transition-all ${
                            monitorData.motorStatus 
                            ? 'bg-green-600 border-green-500 text-white animate-pulse' 
                            : 'bg-white border-gray-100 text-gray-400'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${monitorData.motorStatus ? 'bg-white' : 'bg-gray-300'}`} />
                            Pump {monitorData.motorStatus ? 'ON' : 'OFF'}
                        </div>
                        <div className="px-4 py-2 rounded-2xl bg-white border border-gray-100 font-black text-gray-400 text-xs uppercase tracking-widest flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" /> ESP32-Live
                        </div>
                    </div>
                </div>

                {/* Top Statistics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Soil Moisture */}
                    <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                            <Droplet className="w-16 h-16 text-blue-500" />
                        </div>
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                            <Droplet className="text-blue-500 w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Soil Moisture</p>
                        <div className="flex items-baseline gap-1">
                            <h3 className="text-3xl font-black text-gray-900">{Number(monitorData.moisture || 0).toFixed(1)}%</h3>
                            <span className="text-[10px] font-bold text-green-500 flex items-center gap-1"><MdTrendingUp /> Optimal</span>
                        </div>
                    </motion.div>

                    {/* Temp/Humidity */}
                    <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                            <Thermometer className="w-16 h-16 text-orange-500" />
                        </div>
                        <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
                            <Thermometer className="text-orange-500 w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ambient Temp</p>
                        <h3 className="text-3xl font-black text-gray-900">{Number(monitorData.temperature || 0).toFixed(1)}°C</h3>
                    </motion.div>

                    {/* Air Humidity */}
                    <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                            <CloudRain className="w-16 h-16 text-emerald-500" />
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                            <CloudRain className="text-emerald-500 w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Humidity</p>
                        <h3 className="text-3xl font-black text-gray-900">{Number(monitorData.humidity || 0).toFixed(0)}%</h3>
                    </motion.div>

                    {/* Water Flow */}
                    <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                            <MdWaterDrop className="w-16 h-16 text-cyan-500" />
                        </div>
                        <div className="w-12 h-12 bg-cyan-50 rounded-2xl flex items-center justify-center mb-4">
                            <MdWaterDrop className="text-cyan-500 w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Flow</p>
                        <h3 className="text-3xl font-black text-gray-900">{monitorData.motorStatus ? '0.8' : '0.0'} L/m</h3>
                    </motion.div>
                </div>

                {/* Farm Geolocation Map */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-2 rounded-[40px] border border-gray-100 shadow-xl overflow-hidden relative group">
                    <div className="absolute top-6 left-6 z-[1000] bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-100 shadow-xl flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Farm Location</p>
                            <p className="text-xs font-black text-gray-900 mt-1">18.4422, 73.8308</p>
                        </div>
                    </div>
                    
                    <div className="h-[350px] w-full rounded-[34px] overflow-hidden border border-gray-50">
                        <MapContainer center={[18.442292, 73.830830]} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <Circle 
                                center={[18.442292, 73.830830]}
                                radius={200}
                                pathOptions={{ fillColor: '#10b981', fillOpacity: 0.1, color: '#10b981', weight: 1, dashArray: '5, 10' }}
                            />
                            <Marker position={[18.442292, 73.830830]}>
                                <Popup>
                                    <div className="text-center p-1">
                                        <p className="font-black text-sm text-gray-900">AgroShare Farm Node 01</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Status: Online & Monitoring</p>
                                    </div>
                                </Popup>
                            </Marker>
                        </MapContainer>
                    </div>
                </motion.div>

                {/* Main Dashboard Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left: Analytics & AI */}
                    <div className="lg:col-span-8 space-y-8">
                        
                        {/* AI & Climate Insights */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Climate Intelligence */}
                            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <MdTrendingUp className="text-blue-500" /> Climate Intel
                                </h4>
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="text-5xl">{weather.condition === 'Sunny' ? '☀️' : '☁️'}</div>
                                        <div>
                                            <p className="text-3xl font-black text-gray-900">{weather.current}°C</p>
                                            <p className="text-xs font-bold text-gray-500">{weather.condition} · Pune, IN</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase"><Wind size={10} /> Wind</div>
                                        <p className="text-sm font-black text-gray-900">{weather.wind} km/h</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {weather.forecast.map((f, i) => (
                                        <div key={i} className="bg-gray-50 p-3 rounded-2xl text-center border border-gray-100">
                                            <p className="text-[9px] font-black text-gray-400 mb-1">{f.day}</p>
                                            <div className="text-lg mb-1 flex justify-center">{f.icon}</div>
                                            <p className="text-xs font-black text-gray-900">{f.temp}°</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AI Recommendations */}
                            <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                                    <MdSmartToy size={100} />
                                </div>
                                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 relative z-10">
                                    <MdLightbulb /> AI Insight
                                </h4>
                                <div className="relative z-10">
                                    <h3 className="text-xl font-bold mb-2">Optimize Watering</h3>
                                    <p className="text-xs text-gray-400 font-medium leading-relaxed mb-6">
                                        Wait for sunset. High evaporation predicted for next 4 hours. Moisture levels will sustain till then.
                                    </p>
                                    <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
                                        Full Analysis <MdDoubleArrow />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                    <MdAutoGraph className="text-blue-500" /> Moisture & Irrigation History
                                </h3>
                                <div className="flex gap-2">
                                    <button className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100 uppercase">Live</button>
                                    <button className="px-3 py-1 text-gray-400 text-[10px] font-black rounded-lg border border-transparent uppercase">24H</button>
                                </div>
                            </div>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={formattedHistory}>
                                        <defs>
                                            <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
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

                        {/* NPK Breakdown */}
                        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                             <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <MdScience className="text-emerald-500" /> Soil Nutrition (NPK)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {npkData.map((d, i) => (
                                    <div key={i} className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <p className="text-xs font-black text-gray-900">{d.name === 'N' ? 'Nitrogen' : d.name === 'P' ? 'Phosphorus' : 'Potassium'}</p>
                                            <p className="text-2xl font-black" style={{ color: d.color }}>{d.value}</p>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }} 
                                                animate={{ width: `${(d.value / 100) * 100}%` }}
                                                className="h-full" 
                                                style={{ backgroundColor: d.color }}
                                            />
                                        </div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Target: {d.name === 'N' ? '50' : d.name === 'P' ? '40' : '55'} PPM</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Remote Console */}
                    <div className="lg:col-span-4 h-full">
                        <div className="bg-gray-900 rounded-[40px] h-full p-8 flex flex-col shadow-2xl relative overflow-hidden group border border-white/5">
                            {/* Background Glow */}
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full transition-colors duration-1000 ${monitorData.motorStatus ? 'bg-green-500/20' : 'bg-red-500/10'}`} />
                            
                            <div className="relative flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h3 className="text-white font-black text-xl tracking-tight">System Terminal</h3>
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">Status: Operational</p>
                                    </div>
                                    <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40 hover:bg-white/10 transition-colors">
                                        <MdSettings />
                                    </button>
                                </div>

                                <div className="space-y-12">
                                    {/* Mode Selector */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Logic Engine</span>
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${monitorData.mode === 'AUTO' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                                                {monitorData.mode}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
                                            <button 
                                                onClick={() => monitorData.mode === 'MANUAL' && toggleMode()}
                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${monitorData.mode === 'AUTO' ? 'bg-white/10 text-white shadow-lg shadow-black/20' : 'text-white/40 hover:text-white/60'}`}
                                            >
                                                Auto
                                            </button>
                                            <button 
                                                onClick={() => monitorData.mode === 'AUTO' && toggleMode()}
                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${monitorData.mode === 'MANUAL' ? 'bg-white/10 text-white shadow-lg shadow-black/20' : 'text-white/40 hover:text-white/60'}`}
                                            >
                                                Manual
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pump Control */}
                                    <div className="space-y-6">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] italic">Manual Override</p>
                                        <div className="relative group/btn">
                                            <button 
                                                onClick={toggleMotor}
                                                disabled={monitorData.mode === 'AUTO'}
                                                className={`w-full py-12 rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all relative z-10 ${
                                                    monitorData.mode === 'AUTO' 
                                                    ? 'bg-white/5 cursor-not-allowed opacity-50 grayscale' 
                                                    : (monitorData.motorStatus 
                                                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-[0_20px_40px_rgba(16,185,129,0.3)] border border-green-400 active:scale-95' 
                                                        : 'bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95'
                                                    )
                                                }`}
                                            >
                                                <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center transition-all duration-700 ${monitorData.motorStatus ? 'bg-white text-green-600 rotate-180 scale-110' : 'bg-white/5 text-white/20'}`}>
                                                    <MdPower size={32} />
                                                </div>
                                                <div className="text-center">
                                                    <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 ${monitorData.motorStatus ? 'text-white/80' : 'text-white/20'}`}>
                                                        {monitorData.motorStatus ? 'Running' : 'Standby'}
                                                    </p>
                                                    <p className={`text-2xl font-black italic ${monitorData.motorStatus ? 'text-white' : 'text-white/60'}`}>
                                                        {monitorData.motorStatus ? 'DISABLE PUMP' : 'START PUMP'}
                                                    </p>
                                                </div>
                                            </button>
                                            {/* Glow for manual button */}
                                            {monitorData.mode !== 'AUTO' && !monitorData.motorStatus && (
                                                <div className="absolute inset-0 bg-white/5 blur-2xl rounded-[32px] -z-10 group-hover/btn:bg-white/10 transition-colors" />
                                            )}
                                        </div>
                                        {monitorData.mode === 'AUTO' && (
                                            <p className="text-center text-[9px] font-bold text-white/30 uppercase tracking-widest px-4 leading-relaxed">System is managed by Cloud Logic Engine. <br/><span className="text-blue-400">Manual control locked.</span></p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-auto pt-10">
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <div className="flex items-center gap-3 mb-3">
                                            <MdHistory className="text-white/20" />
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Recent Logs</span>
                                        </div>
                                        <div className="space-y-2 opacity-50">
                                            <p className="text-[9px] font-mono text-white/60">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] [INFO] Mode sync completed</p>
                                            <p className="text-[9px] font-mono text-white/60">[{new Date(Date.now()-600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] [AUTH] Verified ESP32-Dev-01</p>
                                        </div>
                                    </div>
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
;
