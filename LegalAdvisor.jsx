import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    MdSecurity, MdHistory, MdGavel, MdWarning, MdCheckCircle,
    MdUploadFile, MdDocumentScanner, MdTranslate, MdRecordVoiceOver,
    MdInfo, MdRefresh, MdKey, MdErrorOutline, MdExpandMore, MdCompare
} from "react-icons/md";
import toast from "react-hot-toast";

import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const IMGBB_API_KEY = "7ad87a0a10eabb5b4ba5fe2e5a10de1e";

const uploadToImgBB = async (base64Data) => {
    const base64Only = base64Data.split(",")[1];
    const form = new FormData();
    form.append("image", base64Only);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: form,
    });
    if (!res.ok) throw new Error("ImgBB upload failed");
    const json = await res.json();
    return json.data.url;
};

const ANALYSIS_STAGES = [
    "Reading legal terminology...",
    "Scanning for hidden liabilities...",
    "Analyzing payment & penalty clauses...",
    "Calculating document risk profile...",
    "Simplifying for local language understanding..."
];

const LegalAdvisor = () => {
    const [image, setImage] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [stageIdx, setStageIdx] = useState(0);
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
                toast.loading("Converting PDF for scanning...", { id: "pdf-conv" });
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1); // Analyze first page
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;
                const base64Image = canvas.toDataURL("image/png");
                
                setImage(base64Image);
                startAnalysis(base64Image);
                toast.dismiss("pdf-conv");
            } catch (err) {
                console.error("PDF Conversion Error:", err);
                toast.error("Failed to read PDF. Try an image scanner instead.");
                toast.dismiss("pdf-conv");
            }
        } else {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result);
                startAnalysis(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const startAnalysis = async (base64Image) => {
        setIsAnalyzing(true);
        setResult(null);
        setError(null);

        for (let i = 0; i < ANALYSIS_STAGES.length; i++) {
            setStageIdx(i);
            await new Promise(r => setTimeout(r, 1200));
        }

        try {
            const apiKey = import.meta.env.VITE_GROQ_API_KEY;
            if (!apiKey) throw new Error("NO_KEY");

            const publicUrl = await uploadToImgBB(base64Image);

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
                                    text: `ACT AS AN INDIAN AGRI-LEGAL EXPERT. 
                                    Analyze the image/document. 
                                    IMPORTANT: GOVERNMENT GAZETTES, LAWS, AND ACTS ARE VALID INPUTS.
                                    If it is a Gazette or Law, summarize the CORE RIGHTS and BENEFITS it gives to farmers.
                                    EXTRACT: Document Type, Risk Level (0-100), Recommendation, and Key Clauses/Points.
                                    SIMPLIFY all jargon for a village farmer.
                                    
                                    RETURN ONLY THIS JSON:
                                    {
                                      "doc_type": "Title",
                                      "risk_score": Number,
                                      "recommendation": "Advice",
                                      "summary": "2-sentence English summary",
                                      "local_summary_marathi": "Marathi summary",
                                      "local_summary_hindi": "Hindi summary",
                                      "clauses": [{ "title": "Key Point", "explanation": "Simple terms", "risk": "Low/Medium/High" }],
                                      "risks": ["Risk point 1 or Note 1", "Risk point 2 or Note 2"],
                                      "is_valid_document": true
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
            
            // Refined JSON extraction: find the first { and the last }
            let finalData;
            try {
                const startIndex = raw.indexOf('{');
                const endIndex = raw.lastIndexOf('}');
                if (startIndex === -1 || endIndex === -1) throw new Error("No JSON found");
                const jsonStr = raw.substring(startIndex, endIndex + 1);
                finalData = JSON.parse(jsonStr);
            } catch (pErr) {
                console.error("AI Parse Error. Raw output:", raw);
                // Fallback for extreme cases: try to manually fix common LLM formatting issues
                const cleanedRaw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
                const si = cleanedRaw.indexOf('{');
                const ei = cleanedRaw.lastIndexOf('}');
                if (si !== -1 && ei !== -1) {
                    finalData = JSON.parse(cleanedRaw.substring(si, ei + 1));
                } else {
                    throw new Error("Invalid AI format");
                }
            }

            setResult(finalData);
        } catch (err) {
            console.error(err);
            setError({
                type: "error",
                message: "AI Analysis failed.",
                hint: "Ensure the document is well-lit and the text is readable."
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleVoiceSummary = () => {
        if (!result) return;
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const text = `Document detected as ${result.doc_type}. Recommendation is ${result.recommendation}. Summary: ${result.summary}`;
        const msg = new SpeechSynthesisUtterance(text);
        msg.onend = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(msg);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] pt-20 pb-12 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 font-black text-[10px] uppercase tracking-[0.2em] rounded-full border border-blue-200">
                            <MdGavel className="text-sm" /> Legal Protection System
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 font-display tracking-tight">
                            AI Document <span className="text-blue-600">Safety Advisor</span>
                        </h1>
                        <p className="text-slate-500 font-medium max-w-lg">
                            Never sign blindly. Our AI identifies hidden risks, simplifies legal jargon, and protects your rights.
                        </p>
                    </div>
                    <div className="flex gap-2">
                         <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition">
                             <MdHistory /> View History
                         </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Input Panel */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[460px]">
                            {!image ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                                    <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                        <MdUploadFile className="text-5xl" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 mb-2">Scan Document</h3>
                                    <p className="text-sm font-medium text-slate-400 mb-8 max-w-[240px]">
                                        Upload a contract, agreement, or government scheme paper for instant analysis.
                                    </p>
                                    <button 
                                        onClick={() => fileInputRef.current.click()}
                                        className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-3 hover:bg-black transition shadow-xl shadow-slate-200"
                                    >
                                        <MdDocumentScanner className="text-xl text-blue-400" />
                                        <span>UPLOAD DOCUMENT</span>
                                    </button>
                                    <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" />
                                </div>
                            ) : (
                                <div className="relative flex-1 bg-slate-100">
                                    <img src={image} className={`w-full h-full object-contain ${isAnalyzing ? 'blur-[2px] opacity-70' : ''}`} alt="Contract" />
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
                                            <div className="w-64 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping" />
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">AI is reading...</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        className="h-full bg-blue-400"
                                                        animate={{ width: `${((stageIdx + 1) / ANALYSIS_STAGES.length) * 100}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs font-bold text-white/90">{ANALYSIS_STAGES[stageIdx]}</p>
                                            </div>
                                        </div>
                                    )}
                                    {!isAnalyzing && (
                                        <button onClick={() => { setImage(null); setResult(null); }} className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-black">
                                            <MdRefresh className="text-xl" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tip Card */}
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
                            <div className="text-2xl">💡</div>
                            <p className="text-xs font-bold text-amber-800 leading-relaxed">
                                Ensure the document photo is clear. We analyze hidden liabilities and unfair payment terms common in private contract farming.
                            </p>
                        </div>
                    </div>

                    {/* Result Panel */}
                    <div className="lg:col-span-7">
                        <AnimatePresence mode="wait">
                            {!result && !isAnalyzing && !error && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full bg-slate-100 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center p-12 text-center text-slate-400">
                                    <MdGavel className="text-7xl opacity-20 mb-4" />
                                    <p className="font-bold uppercase tracking-widest text-xs">Waiting for Document Scan</p>
                                </motion.div>
                            )}

                            {error && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full bg-red-50 border border-red-100 rounded-[32px] p-10 flex flex-col items-center justify-center text-center">
                                    <MdErrorOutline className="text-6xl text-red-500 mb-4" />
                                    <h3 className="text-2xl font-black text-red-900 mb-2">{error.message}</h3>
                                    <p className="text-sm text-red-700/70 mb-8 max-w-[300px]">{error.hint}</p>
                                    <button onClick={() => { setImage(null); setError(null); }} className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition">Try Another Scan</button>
                                </motion.div>
                            )}

                            {result && (
                                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
                                    {/* Score & Recommendation Banner */}
                                    <div className={`p-8 rounded-[32px] border flex flex-col md:flex-row items-center gap-8 shadow-sm ${
                                        result.risk_score < 30 ? 'bg-green-50 border-green-100 text-green-900' :
                                        result.risk_score < 60 ? 'bg-amber-50 border-amber-100 text-amber-900' :
                                        'bg-red-50 border-red-100 text-red-900'
                                    }`}>
                                        <div className="relative w-32 h-32 flex items-center justify-center">
                                            <svg className="w-full h-full -rotate-90">
                                                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="opacity-10" />
                                                <motion.circle 
                                                    cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent"
                                                    strokeDasharray={364.4}
                                                    initial={{ strokeDashoffset: 364.4 }}
                                                    animate={{ strokeDashoffset: 364.4 - (364.4 * result.risk_score / 100) }}
                                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-3xl font-black tracking-tighter">{result.risk_score}</span>
                                                <span className="text-[10px] font-black uppercase opacity-60">RISK</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 text-center md:text-left space-y-1">
                                            <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-60">AI DETERMINATION</p>
                                            <h2 className="text-3xl font-black font-display leading-none">{result.recommendation}</h2>
                                            <p className="text-sm font-bold opacity-80 leading-relaxed">{result.summary}</p>
                                            <div className="pt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                                                <button onClick={handleVoiceSummary} className="flex items-center gap-2 px-4 py-2 bg-white/40 backdrop-blur hover:bg-white/60 rounded-xl text-xs font-black uppercase transition border border-black/5">
                                                    <MdRecordVoiceOver className="text-base" /> {isSpeaking ? "Stop Voice" : "Hear Summary"}
                                                </button>
                                                <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase transition shadow-lg">
                                                    <MdCompare /> Side-by-Side Compare
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Local Language Summaries */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center text-sm font-black">हिं</div>
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Hindi Summary</span>
                                            </div>
                                            <p className="text-sm font-medium leading-relaxed font-hindi">{result.local_summary_hindi}</p>
                                        </div>
                                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-8 h-8 bg-maroon-100 text-maroon-600 rounded-lg flex items-center justify-center text-sm font-black">म</div>
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Marathi Summary</span>
                                            </div>
                                            <p className="text-sm font-medium leading-relaxed font-marathi">{result.local_summary_marathi}</p>
                                        </div>
                                    </div>

                                    {/* Key Clauses */}
                                    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                            <h3 className="font-black text-slate-900 flex items-center gap-2">
                                                <MdInfo className="text-blue-500" /> Key Clause Breakdown
                                            </h3>
                                            <span className="text-[10px] font-black text-slate-400 p-2 uppercase tracking-widest border border-slate-200 rounded-lg">{result.clauses.length} DETECTED</span>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {result.clauses.map((clause, idx) => (
                                                <div key={idx} className="p-6 hover:bg-slate-50/50 transition flex items-start justify-between gap-6 group">
                                                    <div>
                                                        <h4 className="font-black text-slate-800 mb-1 group-hover:text-blue-600 transition">{clause.title}</h4>
                                                        <p className="text-sm text-slate-500 leading-relaxed font-medium">{clause.explanation}</p>
                                                    </div>
                                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                        clause.risk === 'High' ? 'bg-red-50 text-red-600 border-red-200' :
                                                        clause.risk === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                        'bg-green-50 text-green-600 border-green-200'
                                                    }`}>
                                                        {clause.risk}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Hidden Risks */}
                                    <div className="bg-red-900 text-white rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none rotate-12">
                                            <MdWarning className="text-[180px]" />
                                        </div>
                                        <div className="relative z-10 flex items-center gap-2 mb-4">
                                            <span className="p-1 px-3 bg-red-500 text-[10px] font-black uppercase tracking-widest rounded-full">Caution</span>
                                            <h3 className="font-black">Critical Risk Factors</h3>
                                        </div>
                                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {result.risks.map((r, i) => (
                                                <div key={i} className="flex items-start gap-3 bg-white/10 p-4 rounded-2xl border border-white/10">
                                                    <MdWarning className="text-red-400 shrink-0 mt-0.5" />
                                                    <p className="text-sm font-bold opacity-90">{r}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <button className="relative z-10 w-full mt-6 bg-white text-red-900 py-4 rounded-2xl font-black text-sm uppercase hover:bg-red-50 transition shadow-xl">
                                            Sign-In to Consult with Legal Expert
                                        </button>
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
