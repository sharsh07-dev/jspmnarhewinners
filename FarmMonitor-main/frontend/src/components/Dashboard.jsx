import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Droplet, Thermometer, CloudRain, Power, Settings2, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const Dashboard = () => {
  const [data, setData] = useState({ config: {}, latestData: null });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE}/status`),
        axios.get(`${API_BASE}/history`)
      ]);
      setData(statusRes.data);
      // format history for charts
      const formatted = historyRes.data.map(d => ({
        ...d,
        time: new Date(d.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }));
      setHistory(formatted);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const toggleMode = async () => {
    const newMode = data.config.mode === 'AUTO' ? 'MANUAL' : 'AUTO';
    await axios.post(`${API_BASE}/control`, { mode: newMode });
    fetchData();
  };

  const toggleMotor = async () => {
    if (data.config.mode !== 'MANUAL') return;
    const newOverride = !data.config.motorOverride;
    await axios.post(`${API_BASE}/control`, { motorOverride: newOverride });
    fetchData();
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-nature-500 font-bold text-2xl">Loading Farm Data...</div>;
  }

  const { config, latestData } = data;
  if (!latestData) {
    return <div className="text-white">Waiting for sensor data... Please start ESP32.</div>;
  }

  const isMotorOn = config.mode === 'MANUAL' ? config.motorOverride : latestData.motorStatus;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-nature-400 to-green-500">
            AgriSense Farm
          </h1>
          <p className="text-gray-400 mt-1">Live Monitoring & Automated Irrigation</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`px-4 py-2 rounded-full font-bold shadow-lg ${isMotorOn ? 'bg-nature-500 text-white animate-pulse' : 'bg-red-500/20 text-red-500 border border-red-500'}`}>
            Motor {isMotorOn ? 'RUNNING' : 'OFF'}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {latestData.moisture < 20 && (
        <div className="bg-orange-500/10 border-l-4 border-orange-500 p-4 rounded-r flex items-center">
          <AlertTriangle className="text-orange-500 mr-3" />
          <p className="text-orange-200">Alert: Soil moisture is critically low. Irrigation required.</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric Cards */}
        <div className="glass-card p-6 flex flex-col items-center justify-center text-center transform transition duration-300 hover:scale-105 hover:border-nature-500/50">
          <div className="bg-blue-500/20 p-4 rounded-full mb-4">
            <Droplet className="text-blue-400 w-8 h-8" />
          </div>
          <p className="text-gray-400 text-sm uppercase tracking-wide">Soil Moisture</p>
          <p className="text-4xl font-bold text-white mt-2">{latestData.moisture}%</p>
        </div>

        <div className="glass-card p-6 flex flex-col items-center justify-center text-center transform transition duration-300 hover:scale-105 hover:border-orange-500/50">
          <div className="bg-orange-500/20 p-4 rounded-full mb-4">
            <Thermometer className="text-orange-400 w-8 h-8" />
          </div>
          <p className="text-gray-400 text-sm uppercase tracking-wide">Temperature</p>
          <p className="text-4xl font-bold text-white mt-2">{latestData.temperature}°C</p>
        </div>

        <div className="glass-card p-6 flex flex-col items-center justify-center text-center transform transition duration-300 hover:scale-105 hover:border-cyan-500/50">
          <div className="bg-cyan-500/20 p-4 rounded-full mb-4">
            <CloudRain className="text-cyan-400 w-8 h-8" />
          </div>
          <p className="text-gray-400 text-sm uppercase tracking-wide">Humidity</p>
          <p className="text-4xl font-bold text-white mt-2">{latestData.humidity}%</p>
        </div>

        {/* Control Panel */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 uppercase text-sm tracking-wide flex items-center">
                <Settings2 className="w-4 h-4 mr-2" />
                Mode
              </span>
              <span className={`text-xs font-bold px-2 py-1 rounded ${config.mode==='AUTO' ? 'bg-nature-500/20 text-nature-400' : 'bg-purple-500/20 text-purple-400'}`}>
                {config.mode}
              </span>
            </div>
            
            <button 
              onClick={toggleMode}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors"
            >
              Switch to {config.mode === 'AUTO' ? 'MANUAL' : 'AUTO'}
            </button>
          </div>

          <div>
             <span className="text-gray-400 uppercase text-sm tracking-wide block mb-2">Motor Control</span>
             <button 
                onClick={toggleMotor}
                disabled={config.mode === 'AUTO'}
                className={`w-full py-4 rounded-xl flex items-center justify-center space-x-2 font-bold text-xl transition-all ${
                  config.mode === 'AUTO' ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' :
                  (config.motorOverride ? 'bg-nature-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] hover:bg-nature-500' : 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-500')
                }`}
              >
                <Power className="w-6 h-6" />
                <span>{config.mode === 'AUTO' ? 'Disabled in Auto' : (config.motorOverride ? 'TURN OFF MOTOR' : 'TURN ON MOTOR')}</span>
             </button>
          </div>
        </div>

      </div>

      {/* Charts */}
      <div className="glass-card p-6 mt-8">
        <h2 className="text-xl font-bold mb-6 text-gray-200">Moisture vs Temperature Trend</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#3b82f6" domain={[0, 100]} />
              <YAxis yAxisId="right" orientation="right" stroke="#f97316" domain={[0, 50]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Line yAxisId="left" type="monotone" dataKey="moisture" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 8 }} />
              <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={3} dot={false} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
