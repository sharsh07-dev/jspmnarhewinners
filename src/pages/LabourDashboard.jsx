import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { Navigate } from "react-router-dom";
import { db } from "../firebase";
import { ref, onValue, update, set } from "firebase/database";
import { 
    MdWorkOutline, MdAttachMoney, MdCheckCircle, MdEdit, 
    MdHistory, MdPerson, MdClose, MdCheck, MdChat, MdCameraAlt,
    MdLocationOn, MdTrendingUp, MdSearch
} from "react-icons/md";
import toast from "react-hot-toast";
import { compressAndUpload } from "../services/cloudinary";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png",
});

// Map helper to update center
const ChangeView = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, 13);
    }, [center, map]);
    return null;
};

const SKILLS = ["Harvesting", "Spraying", "Irrigation", "General Labour", "Tractor Driving", "Pruning"];

const INDIA_DATA = {
    Maharashtra: {
        Jalgaon: ["Amalner", "Chopda", "Bhusawal", "Jalgaon", "Pachora", "Parola", "Dharangaon"],
        Dhule: ["Dhule", "Sakri", "Shirpur", "Sindkheda"],
        Nashik: ["Nashik", "Malegaon", "Nandgaon", "Yeola", "Sinnar", "Kalwan"],
        Satara: ["Satara", "Karad", "Wai", "Phaltan"],
        Pune: ["Haveli", "Pune City", "Khed", "Baramati", "Shirur"]
    },
    Gujarat: {
        Surat: ["Olpad", "Choryasi", "Kamrej", "Bardoli"],
        Ahmedabad: ["Daskroi", "Sanand", "Bavla", "Dholka"],
        Rajkot: ["Rajkot City", "Gondal", "Jetpur"]
    },
    Karnataka: {
        Belagavi: ["Belagavi", "Chikkodi", "Athani", "Raybag"],
        Bagalkot: ["Bagalkot", "Badami", "Jamkhandi"]
    }
};

const LabourDashboard = () => {
    const { user, authUser } = useAuthStore();
    const [requests, setRequests] = useState([]);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [locSearch, setLocSearch] = useState("");
    const [locSuggestions, setLocSuggestions] = useState([]);
    const [isLocSearching, setIsLocSearching] = useState(false);
    const [formStep, setFormStep] = useState(1);
    const [isMapExpanded, setIsMapExpanded] = useState(false);

    const [profileForm, setProfileForm] = useState({
        skills: user?.skills || [],
        dailyWage: user?.dailyWage || 400,
        experience: user?.experience || 2,
        photoUrl: user?.photoUrl || "",
        name: user?.name || "",
        address: user?.address || "",
        lat: user?.lat || null,
        lng: user?.lng || null,
        state: user?.state || "",
        district: user?.district || "",
        taluka: user?.taluka || "",
        village: user?.village || ""
    });

    if (user?.role?.toLowerCase() !== "labour") return <Navigate to="/" replace />;

    useEffect(() => {
        if (user) {
            setProfileForm({
                skills: user.skills || [],
                dailyWage: user.dailyWage || 400,
                experience: user.experience || 2,
                photoUrl: user.photoUrl || "",
                name: user.name || "",
                address: user.address || "",
                lat: user.lat || null,
                lng: user.lng || null,
                state: user.state || "",
                district: user.district || "",
                taluka: user.taluka || "",
                village: user.village || ""
            });
        }
    }, [user]);

    useEffect(() => {
        if (!authUser?.uid) return;
        const reqRef = ref(db, "labour_requests");
        const unsub = onValue(reqRef, (snap) => {
            if (snap.exists()) {
                const list = Object.keys(snap.val())
                    .map(k => ({ id: k, ...snap.val()[k] }))
                    .filter(r => r.labourerId === authUser.uid);
                setRequests(list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
            }
        });
        return () => unsub();
    }, [authUser?.uid]);

    // Location Autocomplete
    useEffect(() => {
        if (locSearch.length < 3) {
            setLocSuggestions([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsLocSearching(true);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${locSearch}&countrycodes=in&addressdetails=1&limit=5`);
                const data = await res.json();
                setLocSuggestions(data.map(item => ({
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    display_name: item.display_name
                })));
            } catch (e) { console.error(e); }
            finally { setIsLocSearching(false); }
        }, 600);
        return () => clearTimeout(timer);
    }, [locSearch]);

    const stats = React.useMemo(() => {
        const completed = requests.filter(r => r.status === 'completed');
        const todayStr = new Date().toISOString().split('T')[0];
        const monthStr = todayStr.substring(0, 7);

        const daily = completed.filter(r => r.date === todayStr).reduce((sum, r) => sum + (r.offeredPrice || 0), 0);
        const monthly = completed.filter(r => r.date?.startsWith(monthStr)).reduce((sum, r) => sum + (r.offeredPrice || 0), 0);
        
        return {
            totalJobs: completed.length,
            dailyEarnings: daily,
            monthlyEarnings: monthly
        };
    }, [requests]);

    const MapPicker = () => {
        const map = useMapEvents({
            moveend: () => {
                const center = map.getCenter();
                setProfileForm(p => ({...p, lat: center.lat, lng: center.lng}));
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}`)
                    .then(res => res.json())
                    .then(data => setProfileForm(p => ({...p, address: data.display_name})));
            },
        });
        return null;
    };

    const handleUpdateProfile = async () => {
        if (!authUser?.uid) return;
        try {
            await update(ref(db, `users/${authUser.uid}`), profileForm);
            setIsEditingProfile(false);
            toast.success("Profile updated! Farmers can now see your skills.");
        } catch (err) { toast.error("Update failed"); }
    };


    return (
        <div className="min-h-screen bg-gray-50 pt-16 pb-8 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto space-y-4">
                {/* Header & Profile Summary */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-yellow-200 flex-shrink-0">
                             {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover rounded-2xl" /> : <MdPerson />}
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 font-display leading-tight">Namaste, {user.name}</h1>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {(user.skills || []).slice(0, 3).map(s => <span key={s} className="px-2 py-0.5 bg-gray-50 text-gray-500 border border-gray-100 rounded-lg text-[9px] font-bold uppercase">{s}</span>)}
                                <span className="px-2 py-0.5 bg-green-50 text-green-600 border border-green-100 rounded-lg text-[9px] font-bold uppercase">₹{user.dailyWage || 400}/Day</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setIsEditingProfile(true)} className="px-5 py-2.5 bg-gray-900 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-black transition shadow-lg text-sm">
                        <MdEdit /> Edit Profile
                    </button>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* Stats & Accepted Jobs Section */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-base font-black text-gray-900 flex items-center gap-2 uppercase tracking-wide">
                                <MdCheckCircle className="text-green-500" /> Active Commitments
                            </h2>
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold uppercase">{requests.filter(r => r.status === 'accepted').length} Confirmed</span>
                        </div>

                        {requests.filter(r => r.status === 'accepted').length === 0 ? (
                            <div className="bg-white rounded-[32px] p-12 text-center border border-gray-100 shadow-sm">
                                <p className="text-gray-400 font-bold py-10">No active jobs. Go to 'Find Work' to accept offers!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {requests.filter(r => r.status === 'accepted').map(req => (
                                    <div key={req.id} className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-xl shadow-inner border border-green-100">
                                                <MdWorkOutline />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-gray-900 leading-none mb-1">{req.skill} for {req.farmerName}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{req.date} • ₹{req.offeredPrice}/Day</p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1.5 bg-green-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">Confirmed</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Uber-style Analytics Sidebar */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-[32px] p-5 border border-gray-100 shadow-sm space-y-4">
                            <h3 className="text-xs font-black text-gray-900 flex items-center gap-2 uppercase tracking-widest"><MdTrendingUp className="text-green-500" /> Stats</h3>
                            
                            <div className="grid grid-cols-1 gap-2">
                                <div className="p-4 bg-green-50 rounded-[20px] border border-green-100 relative overflow-hidden group">
                                    <p className="text-[9px] font-black text-green-600 uppercase tracking-widest relative z-10">Today</p>
                                    <p className="text-2xl font-black text-green-700 relative z-10">₹{stats.dailyEarnings}</p>
                                    <MdAttachMoney className="absolute -right-2 -bottom-2 text-green-100 text-5xl rotate-12" />
                                </div>

                                <div className="p-4 bg-blue-50 rounded-[20px] border border-blue-100 relative overflow-hidden group">
                                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest relative z-10">Month</p>
                                    <p className="text-2xl font-black text-blue-700 relative z-10">₹{stats.monthlyEarnings}</p>
                                    <MdTrendingUp className="absolute -right-2 -bottom-2 text-blue-100 text-5xl rotate-12" />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-gray-50 flex justify-between text-[10px] font-black text-gray-400 uppercase">
                                <span>Jobs Done</span>
                                <span className="text-gray-900">{stats.totalJobs}</span>
                            </div>
                        </div>

                        <div className="bg-white rounded-[32px] p-5 border border-gray-100 shadow-sm">
                            <h3 className="text-xs font-black text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-widest"><MdHistory className="text-orange-500" /> Trust</h3>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-400 font-bold uppercase tracking-tighter">Rating</span>
                                <span className="font-black text-gray-900">⭐ {user.rating || "5.0"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Edit Modal */}
            <AnimatePresence>
                {isEditingProfile && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.95 }} 
                            className={`bg-white rounded-[40px] w-full ${isMapExpanded ? 'max-w-4xl' : 'max-w-2xl'} overflow-hidden shadow-2xl relative transition-all duration-500`}
                        >
                            <button onClick={() => { setIsEditingProfile(false); setFormStep(1); setIsMapExpanded(false); }} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 z-10 transition-colors"><MdClose className="text-2xl" /></button>
                            
                            <div className="p-6 md:p-8">
                                {/* Step Indicator */}
                                <div className="flex gap-2 mb-8 items-center">
                                    <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${formStep >= 1 ? 'bg-yellow-500' : 'bg-gray-100'}`} />
                                    <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${formStep >= 2 ? 'bg-yellow-500' : 'bg-gray-100'}`} />
                                </div>

                                <div className="mb-6">
                                    <h3 className="text-2xl font-black text-gray-900 font-display">
                                        {formStep === 1 ? "Professional Identity" : "Work Location"}
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {formStep === 1 ? "Start by sharing who you are and what you do best." : "Pinpoint where you are available for work."}
                                    </p>
                                </div>

                                {formStep === 1 ? (
                                    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                                        <div className="flex items-center gap-6">
                                            <div className="w-24 h-24 bg-gray-100 rounded-[30px] overflow-hidden relative border-4 border-yellow-50 shadow-inner group flex-shrink-0">
                                                {profileForm.photoUrl ? <img src={profileForm.photoUrl} className="w-full h-full object-cover" /> : <MdPerson className="w-full h-full p-4 text-gray-100" />}
                                                {uploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /></div>}
                                                <label className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                    <MdCameraAlt className="text-2xl" />
                                                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            setUploading(true);
                                                            try {
                                                                const url = await compressAndUpload(file);
                                                                setProfileForm(p => ({...p, photoUrl: url}));
                                                                toast.success("Photo uploaded!");
                                                            } catch (err) { toast.error("Upload failed"); }
                                                            finally { setUploading(false); }
                                                        }
                                                    }} />
                                                </label>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-black text-yellow-600 uppercase tracking-wider">Profile Picture</p>
                                                <p className="text-[10px] text-gray-400 leading-relaxed">A professional photo build trust with farmers.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block">Full Name</label>
                                                <input type="text" value={profileForm.name} onChange={e => setProfileForm(p => ({...p, name: e.target.value}))} className="w-full p-3.5 bg-gray-50 rounded-2xl border border-transparent focus:border-yellow-500 outline-none font-bold text-sm" placeholder="Your Full Name" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block">Expected Wage (₹/Day)</label>
                                                <input type="number" value={profileForm.dailyWage} onChange={e => setProfileForm(p => ({...p, dailyWage: Number(e.target.value)}))} className="w-full p-3.5 bg-gray-50 rounded-2xl border border-transparent focus:border-yellow-500 outline-none font-bold text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block">Experience (Years)</label>
                                                <input type="number" value={profileForm.experience} onChange={e => setProfileForm(p => ({...p, experience: Number(e.target.value)}))} className="w-full p-3.5 bg-gray-50 rounded-2xl border border-transparent focus:border-yellow-500 outline-none font-bold text-sm" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block">My Skills</label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                                {SKILLS.map(skill => (
                                                    <button key={skill} onClick={() => {
                                                        const current = profileForm.skills || [];
                                                        const updated = current.includes(skill) ? current.filter(s => s !== skill) : [...current, skill];
                                                        setProfileForm(p => ({...p, skills: updated}));
                                                    }} className={`py-3 px-2 rounded-xl text-[10px] font-black transition-all border-2 ${profileForm.skills?.includes(skill) ? 'bg-yellow-500 border-yellow-500 text-white shadow-lg shadow-yellow-100' : 'bg-gray-50 border-transparent text-gray-500 hover:border-gray-100'}`}>
                                                        {skill}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <button onClick={() => setFormStep(2)} className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all text-sm tracking-widest uppercase">
                                            Save & Next: Set Location
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4">
                                        <div className="p-4 bg-gray-50 rounded-[30px] border border-gray-100 space-y-3">
                                            <div className={`grid grid-cols-2 ${isMapExpanded ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-3 transition-all`}>
                                                <select value={profileForm.state} onChange={e => setProfileForm(p => ({...p, state: e.target.value, district: "", taluka: ""}))} className="w-full p-3 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none ring-offset-2 focus:ring-2 ring-yellow-500">
                                                    <option value="">State</option>
                                                    {Object.keys(INDIA_DATA).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <select disabled={!profileForm.state} value={profileForm.district} onChange={e => setProfileForm(p => ({...p, district: e.target.value, taluka: ""}))} className="w-full p-3 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-yellow-500 disabled:opacity-50">
                                                    <option value="">District</option>
                                                    {profileForm.state && Object.keys(INDIA_DATA[profileForm.state]).map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                                <select disabled={!profileForm.district} value={profileForm.taluka} onChange={e => setProfileForm(p => ({...p, taluka: e.target.value}))} className="w-full p-3 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-yellow-500 disabled:opacity-50">
                                                    <option value="">Taluka</option>
                                                    {profileForm.district && INDIA_DATA[profileForm.state][profileForm.district].map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                <input type="text" value={profileForm.village} onChange={e => setProfileForm(p => ({...p, village: e.target.value}))} className="w-full p-3 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-yellow-500" placeholder="Village..." />
                                            </div>

                                            <button onClick={async () => {
                                                const q = `${profileForm.village}, ${profileForm.taluka}, ${profileForm.district}, ${profileForm.state}, India`;
                                                setIsLocSearching(true);
                                                try {
                                                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
                                                    const data = await res.json();
                                                    if (data.length > 0) {
                                                        setProfileForm(p => ({...p, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), address: data[0].display_name}));
                                                        setIsMapExpanded(true);
                                                    }
                                                } catch (e) { }
                                                finally { setIsLocSearching(false); }
                                            }} disabled={!profileForm.village || isLocSearching} className="w-full py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black tracking-widest hover:bg-black transition-all disabled:opacity-50">
                                                {isLocSearching ? "Finding Village Territory..." : "Center Map & Pinpoint Home"}
                                            </button>
                                        </div>

                                        <div className={`${isMapExpanded ? 'h-[450px]' : 'h-32'} w-full rounded-[30px] overflow-hidden border-4 border-white shadow-xl relative z-0 transition-all duration-500`}>
                                            <MapContainer center={[profileForm.lat || 19.0760, profileForm.lng || 72.8777]} zoom={17} style={{ height: "100%", width: "100%" }}>
                                                <TileLayer 
                                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
                                                    attribution='Tiles &copy; Esri'
                                                />
                                                <ChangeView center={profileForm.lat ? [profileForm.lat, profileForm.lng] : null} />
                                                <MapPicker />
                                            </MapContainer>
                                            
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[400]">
                                                <div className="relative">
                                                    <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center border-2 border-white shadow-xl animate-bounce">
                                                        <div className="w-2 h-2 bg-white rounded-full" />
                                                    </div>
                                                    <div className="w-0.5 h-3 bg-red-600 mx-auto -mt-0.5 shadow-lg" />
                                                </div>
                                            </div>

                                            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur text-white px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase">Satellite View</div>
                                        </div>
                                        <p className="text-[9px] text-green-600 font-bold text-center line-clamp-1 italic px-4">📍 {profileForm.address || "Move map to pinpoint exactly"}</p>

                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => setFormStep(1)} className="flex-1 py-4 bg-gray-50 text-gray-500 font-bold rounded-2xl hover:bg-gray-100 transition-colors text-sm">Back</button>
                                            <button onClick={handleUpdateProfile} className="flex-[2] py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all text-sm tracking-widest uppercase">Finish & Save</button>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LabourDashboard;
