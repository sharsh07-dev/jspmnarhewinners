import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdLocationOn, MdAgriculture, MdMic, MdTrendingUp, MdCheckCircle, MdWarning } from 'react-icons/md';
import { fetchWeather, isGoodForFieldWork } from '../services/weatherService';
import { getUserLocation, reverseGeocode } from '../utils/geo';
import { generateAIRecommendations } from '../services/aiRecommendationService';
import toast from 'react-hot-toast';

const AIRecommendations = () => {
    const [step, setStep] = useState(1);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [loadingAI, setLoadingAI] = useState(false);
    const [weather, setWeather] = useState(null);
    const [weatherStatus, setWeatherStatus] = useState({ good: true, reason: "" });
    const [aiResult, setAiResult] = useState(null);
    const [isListening, setIsListening] = useState(false);

    const [form, setForm] = useState({
        location: '',
        lat: null,
        lng: null,
        crop: 'Wheat',
        soil: 'Loamy',
        stage: 'Preparation',
        farmSize: '5'
    });

    const CROPS = ['Wheat', 'Sugarcane', 'Rice', 'Cotton', 'Maize', 'Soybean', 'Other'];
    const SOIL_TYPES = ['Loamy', 'Clay', 'Sandy', 'Black Cotton', 'Red', 'Laterite'];
    const STAGES = ['Preparation', 'Sowing', 'Growing', 'Irrigation', 'Harvesting', 'Post-Harvest'];

    const handleGetLocation = async () => {
        setLoadingLocation(true);
        try {
            const loc = await getUserLocation();
            const address = await reverseGeocode(loc.lat, loc.lng);
            setForm(f => ({ ...f, location: address, lat: loc.lat, lng: loc.lng }));
            
            // Fetch weather immediately after getting location
            const weatherData = await fetchWeather(loc.lat, loc.lng);
            setWeather(weatherData);
            setWeatherStatus(isGoodForFieldWork(weatherData));
            toast.success("Location & Weather fetched! 🌤️");
        } catch (error) {
            toast.error("Could not get location. Entering manual mode.");
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleVoiceInput = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            toast.error("Speech recognition not supported in this browser.");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN'; // Standard Indian English

        recognition.onstart = () => {
            setIsListening(true);
            toast("Listening... Speak your crop and stage", { icon: '🎙️' });
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            toast.success(`Heard: "${transcript}"`);
            
            // Simple keyword matching for demo purposes
            let updated = { ...form };
            
            CROPS.forEach(c => {
                if(transcript.includes(c.toLowerCase())) updated.crop = c;
            });
            STAGES.forEach(s => {
                if(transcript.includes(s.toLowerCase())) updated.stage = s;
            });
            SOIL_TYPES.forEach(s => {
                if(transcript.includes(s.toLowerCase())) updated.soil = s;
            });
            
            setForm(updated);
        };

        recognition.onerror = (event) => {
            console.error(event.error);
            toast.error("Voice input failed. Please try again.");
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const handleGenerate = async () => {
        if (!form.location) {
            toast.error("Please provide a location.");
            return;
        }
        
        setLoadingAI(true);
        try {
             // ensure we have weather if not already loaded
            let currentWeatherData = weather;
            if(!currentWeatherData && form.lat && form.lng) {
                currentWeatherData = await fetchWeather(form.lat, form.lng);
                setWeather(currentWeatherData);
                setWeatherStatus(isGoodForFieldWork(currentWeatherData));
            }
            
            const results = await generateAIRecommendations({
                ...form,
                weatherData: currentWeatherData
            });
            
            setAiResult(results);
            setStep(2);
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate recommendations");
        } finally {
            setLoadingAI(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl mb-4 text-white shadow-lg shadow-green-200">
                        <span className="text-3xl">🧠</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 font-display mb-3">AI Recommendation Engine</h1>
                    <p className="text-gray-500 max-w-2xl mx-auto text-lg">
                        Get data-driven suggestions for equipment usage based on your crop, soil, and real-time weather.
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div 
                            key="form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
                        >
                            <div className="p-8">
                                <form className="space-y-6">
                                    {/* Location Input */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Farm Location</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={form.location}
                                                onChange={(e) => setForm({...form, location: e.target.value})}
                                                placeholder="Enter village, district..." 
                                                className="input-field flex-1 bg-gray-50 border-gray-200"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={handleGetLocation}
                                                disabled={loadingLocation}
                                                className="px-4 py-3 bg-green-100 text-green-700 rounded-xl font-bold hover:bg-green-200 transition whitespace-nowrap flex items-center gap-2"
                                            >
                                                {loadingLocation ? <span className="animate-spin text-xl">⏳</span> : <MdLocationOn className="text-xl"/>}
                                                {window.innerWidth > 640 ? "Use GPS" : ""}
                                            </button>
                                        </div>
                                        {weather && (
                                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold border border-blue-100">
                                                <span>{weather.current.icon}</span> 
                                                {weather.current.temp}°C, {weather.current.label}
                                            </div>
                                        )}
                                    </div>

                                    {/* Voice Input Prompt */}
                                     <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-bold text-green-900 flex items-center gap-2"><MdMic className="text-green-600"/> Prefer Voice Input?</h3>
                                            <p className="text-sm text-green-700 mt-1">Try saying: "I am growing Wheat on Loamy soil at Preparation stage"</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={handleVoiceInput}
                                            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform ${isListening ? 'bg-red-500 scale-110 animate-pulse text-white' : 'bg-white text-green-600 hover:scale-105 border-2 border-green-100'}`}
                                        >
                                            <MdMic className="text-2xl" />
                                        </button>
                                    </div>

                                    {/* Select Grids */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Crop */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                                                Crop Type
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {CROPS.slice(0,6).map(c => (
                                                    <button 
                                                        key={c}
                                                        type="button"
                                                        onClick={() => setForm({...form, crop: c})}
                                                        className={`p-2 rounded-xl text-sm font-semibold border-2 transition ${form.crop === c ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'}`}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                         {/* Stage */}
                                         <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Farming Stage</label>
                                             <select 
                                                value={form.stage}
                                                onChange={(e) => setForm({...form, stage: e.target.value})}
                                                className="input-field bg-gray-50 border-gray-200 cursor-pointer"
                                            >
                                                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>

                                        {/* Soil */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Soil Type</label>
                                             <select 
                                                value={form.soil}
                                                onChange={(e) => setForm({...form, soil: e.target.value})}
                                                className="input-field bg-gray-50 border-gray-200 cursor-pointer"
                                            >
                                                {SOIL_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>

                                        {/* Size */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Farm Size (Acres)</label>
                                            <input 
                                                type="number" 
                                                value={form.farmSize}
                                                onChange={(e) => setForm({...form, farmSize: e.target.value})}
                                                className="input-field bg-gray-50 border-gray-200"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Submit */}
                                    <button 
                                        type="button"
                                        onClick={handleGenerate}
                                        disabled={loadingAI}
                                        className="w-full mt-6 bg-gray-900 text-white rounded-xl py-4 font-black text-lg hover:bg-black transition-all flex justify-center items-center gap-2 group shadow-xl hover:shadow-2xl"
                                    >
                                        {loadingAI ? (
                                            <>
                                               <span className="animate-spin">⚙️</span> Analyzing Data...
                                            </>
                                        ) : (
                                            <>
                                                ✨ Generate Smart Recommendations <MdTrendingUp className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && aiResult && (
                        <motion.div
                            key="results"
                             initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            {/* Weather Alert Banner */}
                            {!weatherStatus.good && (
                                <div className="mb-6 bg-amber-50 border-2 border-amber-200 text-amber-900 px-6 py-4 rounded-2xl flex items-start gap-4">
                                     <span className="text-2xl mt-0.5">⚠️</span>
                                     <div>
                                         <h4 className="font-bold">Weather Warning: {weatherStatus.reason}</h4>
                                         <p className="text-sm mt-1 text-amber-800">It is advised to delay field operations that require heavy machinery until conditions improve.</p>
                                     </div>
                                </div>
                            )}

                            {/* Analysis Summary */}
                             <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-3xl p-8 shadow-sm mb-6 relative overflow-hidden">
                                 <div className="absolute -top-10 -right-10 text-9xl opacity-5">🌱</div>
                                 <h2 className="text-xl font-bold text-gray-900 mb-2">AI Analysis Summary</h2>
                                 <p className="text-gray-700 leading-relaxed relative z-10">{aiResult.analysis}</p>
                             </div>

                             {/* Equipment Recommendations */}
                             <h3 className="text-2xl font-black text-gray-900 mb-4 px-2 tracking-tight">Top Equipment Matches</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                 {aiResult.recommendations.map((rec, i) => (
                                     <motion.div 
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        key={rec.id} 
                                        className="bg-white rounded-3xl p-6 border-2 border-gray-100 hover:border-green-400 transition-colors shadow-sm hover:shadow-lg relative overflow-hidden group"
                                    >
                                        <div className="absolute top-0 right-0 bg-green-500 text-white font-bold text-xs px-4 py-1.5 rounded-bl-xl z-10 shadow-sm">
                                            {rec.confidence}% Match
                                        </div>
                                         <h4 className="text-xl font-bold text-gray-900 mb-1 pe-16">{rec.equipmentName}</h4>
                                         <p className="text-sm font-semibold text-green-600 mb-4">{rec.impact} Impact</p>
                                         
                                         <div className="space-y-3 mb-6">
                                            <div className="flex gap-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
                                                <MdCheckCircle className="text-green-500 text-lg flex-shrink-0 mt-0.5" />
                                                <p>{rec.reason}</p>
                                            </div>
                                            <div className={`flex gap-3 text-sm p-3 rounded-xl ${rec.isOptimalTiming ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                                                {rec.isOptimalTiming ? <MdCheckCircle className="text-lg flex-shrink-0 mt-0.5"/> : <MdWarning className="text-lg flex-shrink-0 mt-0.5"/>}
                                                <p><span className="font-bold block mb-0.5">Timing Suggestion:</span> {rec.timing}</p>
                                            </div>
                                         </div>

                                         <button className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold group-hover:bg-green-600 transition-colors">
                                             Search for {rec.equipmentName}
                                         </button>
                                     </motion.div>
                                 ))}
                             </div>

                             <div className="text-center">
                                 <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-900 font-semibold px-4 py-2 transition-colors">
                                     ← Modify Context
                                 </button>
                             </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
};

export default AIRecommendations;
