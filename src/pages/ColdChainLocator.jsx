import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import { 
    MdAcUnit, MdLocationOn, MdFilterList, MdSearch, MdInfoOutline, 
    MdCall, MdVerified, MdOutlineInventory2, MdAttachMoney,
    MdNavigateNext, MdExpandMore, MdExpandLess, MdSmartToy
} from "react-icons/md";
import toast from "react-hot-toast";

// Fix for default marker icons in Leaflet
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Cold Storage Icon
const coldStorageIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/2928/2928883.png",
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
});

// --- MOCK DATA ---
const MOCK_STORAGE = [
    {
        id: "cs1",
        name: "Shri Krishna Cold Storage",
        lat: 18.5204,
        lng: 73.8567,
        totalCapacity: "5000 MT",
        availableCapacity: "1200 MT",
        pricePerKg: 15,
        types: ["Fruits", "Vegetables"],
        contact: "+91 98765 43210",
        verified: true,
        address: "Market Yard, Jalgaon, Maharashtra"
    },
    {
        id: "cs2",
        name: "Pioneer Agro Cooling",
        lat: 18.5400,
        lng: 73.8800,
        totalCapacity: "3000 MT",
        availableCapacity: "450 MT",
        pricePerKg: 12,
        types: ["Vegetables", "Dairy"],
        contact: "+91 88888 77777",
        verified: true,
        address: "Pimpri, Pune, Maharashtra"
    },
    {
        id: "cs3",
        name: "Janta Cold House",
        lat: 18.5100,
        lng: 73.8300,
        totalCapacity: "10000 MT",
        availableCapacity: "0 MT",
        pricePerKg: 18,
        types: ["Fruits"],
        contact: "+91 77777 66666",
        verified: false,
        address: "Hadapsar, Pune, Maharashtra"
    },
    {
        id: "cs4",
        name: "Eco-Fresh Solutions",
        lat: 18.5600,
        lng: 73.9000,
        totalCapacity: "4500 MT",
        availableCapacity: "2800 MT",
        pricePerKg: 14,
        types: ["Dairy", "Seeds"],
        contact: "+91 99999 00000",
        verified: true,
        address: "Wagholi Industrial Area, Pune"
    }
];

// Helper to center map
const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng], 13);
    }, [lat, lng, map]);
    return null;
};

const ColdChainLocator = () => {
    const [userLoc, setUserLoc] = useState([18.5204, 73.8567]); // Default Jalgaon/Pune region
    const [selectedStorage, setSelectedStorage] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("All");
    const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

    const filteredStorage = useMemo(() => {
        return MOCK_STORAGE.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = filterType === "All" || s.types.includes(filterType);
            return matchesSearch && matchesType;
        });
    }, [searchQuery, filterType]);

    const handleMarkerClick = (storage) => {
        setSelectedStorage(storage);
        setIsBottomSheetOpen(true);
    };

    const handleBookingRequest = () => {
        toast.promise(
            new Promise((resolve) => setTimeout(resolve, 2000)),
            {
                loading: 'Sending request to Cold Storage...',
                success: 'Request Sent! The facility owner will contact you shortly. ✅',
                error: 'Failed to send request.',
            }
        );
    };

    // AI recommendation based on current selections
    const aiRecommendation = useMemo(() => {
        if (!selectedStorage) return "Select a storage facility to see AI optimization.";
        const utilization = ((parseInt(selectedStorage.totalCapacity) - parseInt(selectedStorage.availableCapacity)) / parseInt(selectedStorage.totalCapacity)) * 100;
        
        if (selectedStorage.availableCapacity === "0 MT") {
            return "⚠️ High Demand: This facility is full. We suggest Pioneer Agro Cooling for better availability today.";
        }
        if (utilization > 80) {
            return "⚡ Freshness Tip: This facility is near capacity. Store your perishables within 6 hours for maximum freshness.";
        }
        return "✅ Optimal Choice: Low distance and competitive pricing detected for your current location.";
    }, [selectedStorage]);

    return (
        <div className="flex flex-col h-[calc(100vh-68px)] relative overflow-hidden bg-gray-50">
            {/* Header / Search Controls */}
            <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col md:flex-row gap-3">
                <div className="relative flex-grow max-w-md">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                    <input 
                        type="text" 
                        placeholder="Search nearby cold storage..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"
                    />
                </div>
                
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
                    {["All", "Fruits", "Vegetables", "Dairy"].map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap shadow-lg ${
                                filterType === type 
                                ? "bg-blue-600 text-white" 
                                : "bg-white text-gray-500 hover:bg-blue-50"
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-grow z-0">
                <MapContainer center={userLoc} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {filteredStorage.map((storage) => (
                        <Marker 
                            key={storage.id} 
                            position={[storage.lat, storage.lng]} 
                            icon={coldStorageIcon}
                            eventHandlers={{
                                click: () => handleMarkerClick(storage),
                            }}
                        >
                            <Popup>
                                <div className="p-1">
                                    <h3 className="font-bold text-gray-900">{storage.name}</h3>
                                    <p className="text-[10px] text-gray-500">{storage.address}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                    <RecenterMap lat={userLoc[0]} lng={userLoc[1]} />
                </MapContainer>
            </div>

            {/* Side List (Hidden on Mobile, shown as panel on Desktop) */}
            <div className="hidden lg:block absolute left-4 top-24 bottom-4 w-80 z-[1000] pointer-events-none">
                <div className="h-full space-y-3 overflow-y-auto no-scrollbar pointer-events-auto">
                    {filteredStorage.length === 0 ? (
                        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[28px] border border-white/20 shadow-xl text-center">
                            <p className="text-gray-400 font-bold uppercase text-[10px]">No facilities found</p>
                        </div>
                    ) : (
                        filteredStorage.map(storage => (
                            <motion.div
                                key={storage.id}
                                layout
                                onClick={() => handleMarkerClick(storage)}
                                className={`p-5 rounded-[28px] cursor-pointer transition-all border border-white/20 shadow-xl backdrop-blur-md ${
                                    selectedStorage?.id === storage.id 
                                    ? "bg-blue-600 text-white ring-2 ring-blue-300" 
                                    : "bg-white/90 text-gray-800 hover:bg-white"
                                }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-black text-sm leading-tight">{storage.name}</h3>
                                    {storage.verified && <MdVerified className={selectedStorage?.id === storage.id ? "text-blue-100" : "text-blue-500"} />}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] opacity-70 mb-3">
                                    <MdLocationOn /> 2.4 km away
                                </div>
                                <div className="flex justify-between items-center pt-3 border-t border-current/10">
                                    <div>
                                        <p className="text-[8px] uppercase font-black opacity-60">Status</p>
                                        <p className="text-[11px] font-black">{storage.availableCapacity === "0 MT" ? "🔴 FULL" : "🟢 AVAILABLE"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] uppercase font-black opacity-60">Price</p>
                                        <p className="text-[11px] font-black">₹{storage.pricePerKg}/kg</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* Bottom Sheet / Detail View */}
            <AnimatePresence>
                {isBottomSheetOpen && selectedStorage && (
                    <>
                        {/* Overlay for mobile */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsBottomSheetOpen(false)}
                            className="lg:hidden absolute inset-0 bg-black/20 backdrop-blur-[2px] z-[1001]"
                        />
                        
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="absolute bottom-0 left-0 right-0 lg:left-auto lg:right-4 lg:bottom-4 lg:w-96 bg-white rounded-t-[40px] lg:rounded-[40px] shadow-2xl z-[1002] overflow-hidden border border-gray-100"
                        >
                            {/* Visual Handle */}
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-4 lg:hidden" onClick={() => setIsBottomSheetOpen(false)} />
                            
                            <div className="p-8 space-y-6">
                                {/* Header */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 italic">
                                            <MdAcUnit /> Cold Chain
                                        </div>
                                        <button 
                                            onClick={() => setIsBottomSheetOpen(false)}
                                            className="p-2 hover:bg-gray-100 rounded-full lg:hidden"
                                        >
                                            <MdExpandMore className="text-2xl text-gray-400" />
                                        </button>
                                    </div>
                                    
                                    <h2 className="text-3xl font-black text-gray-900 leading-tight font-display">
                                        {selectedStorage.name}
                                    </h2>
                                    <p className="text-sm text-gray-400 font-medium">
                                        {selectedStorage.address}
                                    </p>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100">
                                        <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                            <MdOutlineInventory2 className="text-sm" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Available</span>
                                        </div>
                                        <p className="text-xl font-black text-gray-900">{selectedStorage.availableCapacity}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100">
                                        <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                            <MdAttachMoney className="text-sm" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Daily Rate</span>
                                        </div>
                                        <p className="text-xl font-black text-blue-600">₹{selectedStorage.pricePerKg}<span className="text-[10px] text-gray-400">/kg</span></p>
                                    </div>
                                </div>

                                {/* Storage Types */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supported Crops</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedStorage.types.map(t => (
                                            <span key={t} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-lg">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* AI Recommendation Box */}
                                <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-3xl p-5 relative overflow-hidden group shadow-xl">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 rotate-12 transition-transform group-hover:scale-[2] group-hover:rotate-0">
                                        <MdSmartToy className="text-4xl text-white" />
                                    </div>
                                    <div className="relative">
                                        <div className="flex items-center gap-2 text-blue-300 text-[9px] font-bold uppercase tracking-widest mb-2 px-2 py-1 bg-white/5 w-fit rounded-full backdrop-blur-sm">
                                            <MdSmartToy /> Storage Optimizer AI
                                        </div>
                                        <p className="text-xs text-blue-50 font-medium leading-relaxed italic">
                                            "{aiRecommendation}"
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-3 pt-2">
                                    <button 
                                        onClick={handleBookingRequest}
                                        className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        Book Storage Space <MdNavigateNext className="text-lg" />
                                    </button>
                                    <div className="flex gap-2">
                                        <a href={`tel:${selectedStorage.contact}`} className="flex-1 py-4 bg-white border border-gray-200 rounded-[20px] text-gray-900 font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-50 transition-all">
                                            <MdCall className="text-blue-500" /> Contact Owner
                                        </a>
                                        <button className="flex-1 py-4 bg-white border border-gray-200 rounded-[20px] text-gray-900 font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-50 transition-all">
                                            <MdLocationOn className="text-red-500" /> Directions
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ColdChainLocator;
