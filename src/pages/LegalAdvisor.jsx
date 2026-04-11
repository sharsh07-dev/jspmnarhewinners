import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    MdAnalytics, MdTrendingUp, MdWarning, MdSecurity, MdHistory,
    MdUploadFile, MdDocumentScanner, MdRecordVoiceOver,
    MdRefresh, MdErrorOutline, MdAttachMoney, MdCheckCircle, MdGavel
} from "react-icons/md";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";
import { uploadToCloudinary } from "../services/cloudinary";

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const LegalAdvisor = () => {
    const [image, setImage] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setResult(null);
        setError(null);

        if (file.type === "application/pdf") {
            try {
                toast.loading("Reading PDF content...", { id: "pdf-read" });
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2.0 }); // Balanced scale for size
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                const base64Image = canvas.toDataURL("image/jpeg", 0.7); // Use JPEG compression to fix 400 error
                
                setImage(base64Image);
                toast.dismiss("pdf-read");
                startGrokAnalysis(base64Image);
            } catch (err) {
                toast.error("PDF reading failed.");
                toast.dismiss("pdf-read");
            }
        } else {
            const reader = new FileReader();
            reader.onloadend = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 2000;
                    const scale = Math.min(1, MAX_WIDTH / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    setImage(compressedBase64);
                    startGrokAnalysis(compressedBase64);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const startGrokAnalysis = async (base64Image) => {
        setIsAnalyzing(true);
        setError(null);

        try {
            const apiKey = import.meta.env.VITE_GROQ_API_KEY;
            if (!apiKey) throw new Error("NO_KEY");

            // Convert base64 to Blob for Cloudinary
            const response = await fetch(base64Image);
            const blob = await response.blob();
            const file = new File([blob], "document.jpg", { type: "image/jpeg" });
            
            const publicUrl = await uploadToCloudinary(file, "image");

            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "meta-llama/llama-4-scout-17b-16e-instruct",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `You are an expert agricultural advisor and legal assistant for farmers. 
                                    Analyze the provided document from a farmer's perspective. 

                                    Explain clearly in simple language:
                                    1. What benefits (profit) does the farmer get from this document?
                                    2. What risks, losses, or disadvantages are present?
                                    3. Are there any hidden conditions, penalties, or obligations?
                                    4. Is this document safe for a farmer to sign?
                                    5. Give a final recommendation: Safe / Risky / Not Recommended

                                    Return a strict JSON object:
                                    {
                                      "benefits": ["Benefit 1", "Benefit 2"],
                                      "risks": ["Risk 1", "Risk 2"],
                                      "warnings": ["Warning 1", "Warning 2"],
                                      "verdict": "Safe | Risky | Not Recommended",
                                      "profit_potential": "Score 0-100",
                                      "risk_score": "Score 0-100",
                                      "summary_en": "Easy English summary",
                                      "summary_hi": "Easy Hindi summary",
                                      "summary_mr": "Easy Marathi summary"
                                    }`
                                },
                                {
                                    type: "image_url",
                                    image_url: { url: publicUrl },
                                },
                            ],
                        },
                    ],
                    max_tokens: 1500,
                }),
            });

            if (!res.ok) throw new Error("API_ERROR");
            const data = await res.json();
            const raw = data.choices?.[0]?.message?.content || "";
            const startIndex = raw.indexOf('{');
            const endIndex = raw.lastIndexOf('}');
            const finalData = JSON.parse(raw.substring(startIndex, endIndex + 1));

            setResult(finalData);
        } catch (err) {
            console.error(err);
            setError("Analysis failed. Please check your document and try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4 shadow-inner">
            <div className="max-w-6xl mx-auto">
                
                {/* Brand Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest mb-4 shadow-lg">
                        <MdGavel /> AGRO INTELLIGENCE · LEGAL OVERSIGHT
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 tracking-tighter mb-4 font-display">
                        AI <span className="text-indigo-600">Legal Advisor</span>
                    </h1>
                    <p className="text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed">
                        Transform complex legal documents and gazettes into clear, actionable advice. 
                        Make safe and informed decisions before signing farm contracts.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left: Input */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <div className="bg-white rounded-[40px] border border-gray-100 shadow-2xl p-4 min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden">
                            {!image ? (
                                <div className="text-center p-10 space-y-6">
                                    <div className="w-32 h-32 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                        <MdDocumentScanner className="text-6xl" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-800">Ready to Scan</h3>
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">PDF · Image · Gazette</p>
                                    </div>
                                    <button 
                                        onClick={() => fileInputRef.current.click()}
                                        className="w-full bg-indigo-600 text-white rounded-[24px] py-5 font-black text-sm uppercase tracking-[0.2em] hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 flex items-center justify-center gap-3"
                                    >
                                        <MdUploadFile className="text-xl" /> Upload Document
                                    </button>
                                    <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" />
                                </div>
                            ) : (
                                <div className="w-full h-full relative group">
                                    <img src={image} className={`w-full h-full object-contain rounded-3xl ${isAnalyzing ? 'blur-sm opacity-50' : ''}`} alt="Target" />
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                                            <p className="font-black text-indigo-900 animate-pulse uppercase tracking-widest text-xs">Grok is Analyzing...</p>
                                        </div>
                                    )}
                                    {!isAnalyzing && (
                                        <button onClick={() => setImage(null)} className="absolute top-4 right-4 bg-black/60 text-white p-3 rounded-full hover:bg-black">
                                            <MdRefresh className="text-2xl" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Grok Insights */}
                    <div className="lg:col-span-7 h-full">
                        <AnimatePresence mode="wait">
                            {!result && !isAnalyzing && !error && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full min-h-[500px] bg-white rounded-[40px] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center p-12 text-center">
                                    <MdTrendingUp className="text-[120px] text-gray-100 mb-6" />
                                    <p className="text-gray-400 font-black uppercase tracking-[0.3em]">Insights will appear here</p>
                                </motion.div>
                            )}

                            {error && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full bg-red-50 rounded-[40px] p-12 flex flex-col items-center justify-center text-center text-red-900">
                                    <MdErrorOutline className="text-6xl mb-4" />
                                    <h3 className="text-2xl font-black mb-2">Analysis Failed</h3>
                                    <p className="font-bold opacity-70 mb-8">{error}</p>
                                    <button onClick={() => { setImage(null); setError(null); }} className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl">TRY AGAIN</button>
                                </motion.div>
                            )}

                            {result && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                                    
                                    {/* Final Verdict Card */}
                                    <div className={`p-10 rounded-[40px] shadow-2xl overflow-hidden relative ${
                                        result.verdict.includes('Safe') ? 'bg-emerald-600 text-white' :
                                        result.verdict.includes('Risky') ? 'bg-orange-500 text-white' :
                                        'bg-rose-600 text-white'
                                    }`}>
                                        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 pointer-events-none">
                                            <MdSecurity className="text-[180px]" />
                                        </div>
                                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                                            <div className="relative w-32 h-32 flex items-center justify-center bg-white/20 rounded-full border-4 border-white/30 backdrop-blur-xl">
                                                <div className="text-center">
                                                    <p className="text-4xl font-black leading-none">{result.profit_potential}%</p>
                                                    <p className="text-[9px] font-black uppercase tracking-widest mt-1">PROFIT</p>
                                                </div>
                                            </div>
                                            <div className="flex-1 text-center md:text-left">
                                                <p className="text-[10px] font-black tracking-[0.3em] uppercase opacity-70 mb-2">Grok Verdict</p>
                                                <h2 className="text-5xl font-black tracking-tighter mb-3">{result.verdict.toUpperCase()}</h2>
                                                <p className="text-lg font-bold opacity-90 leading-relaxed font-display">{result.summary_en}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Local Language Toggle */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-indigo-50 p-6 rounded-[32px] border border-indigo-100">
                                            <div className="flex items-center gap-2 mb-3 text-indigo-700">
                                                <span className="bg-indigo-700 text-white px-2 py-0.5 rounded-lg text-xs font-black">हिं</span>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Hindi Interpretation</span>
                                            </div>
                                            <p className="text-sm font-bold text-indigo-900/80 leading-relaxed font-hindi">{result.summary_hi}</p>
                                        </div>
                                        <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100">
                                            <div className="flex items-center gap-2 mb-3 text-amber-700">
                                                <span className="bg-amber-700 text-white px-2 py-0.5 rounded-lg text-xs font-black">म</span>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Marathi Interpretation</span>
                                            </div>
                                            <p className="text-sm font-bold text-amber-900/80 leading-relaxed font-marathi">{result.summary_mr}</p>
                                        </div>
                                    </div>

                                    {/* Detailed Breakdown */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Benefits */}
                                        <div className="bg-white p-8 rounded-[40px] border border-green-100 shadow-sm space-y-4">
                                            <h4 className="flex items-center gap-2 text-emerald-600 font-black tracking-widest text-xs uppercase">
                                                <MdTrendingUp /> Benefits (Profit)
                                            </h4>
                                            <ul className="space-y-3">
                                                {result.benefits.map((b, i) => (
                                                    <li key={i} className="flex gap-3 text-sm font-bold text-gray-700 leading-tight">
                                                        <span className="text-emerald-500 mt-1"><MdCheckCircle /></span> {b}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Risks */}
                                        <div className="bg-white p-8 rounded-[40px] border border-red-100 shadow-sm space-y-4">
                                            <h4 className="flex items-center gap-2 text-rose-600 font-black tracking-widest text-xs uppercase">
                                                <MdTrendingUp className="rotate-180" /> Risks (Loss)
                                            </h4>
                                            <ul className="space-y-3">
                                                {result.risks.map((r, i) => (
                                                    <li key={i} className="flex gap-3 text-sm font-bold text-gray-700 leading-tight">
                                                        <span className="text-rose-500 mt-1"><MdWarning /></span> {r}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Warnings / Hidden Clauses */}
                                    <div className="bg-gray-900 text-white p-10 rounded-[40px] border-4 border-amber-500/30 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
                                        <div className="text-5xl text-amber-500 animate-pulse"><MdWarning /></div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-amber-500 uppercase tracking-widest text-xs mb-3">Critical Warnings & Hidden Clauses</h4>
                                            <div className="space-y-4">
                                                {result.warnings.map((w, i) => (
                                                    <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-start gap-4">
                                                        <span className="bg-amber-500 text-gray-900 w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0">{i+1}</span>
                                                        <p className="text-sm font-bold opacity-80 leading-relaxed">{w}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegalAdvisor;
