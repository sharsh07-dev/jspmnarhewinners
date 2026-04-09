import React, { useState, useEffect, useRef } from "react";
import { MdChat, MdClose, MdMic, MdSend, MdMicOff } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";

// Simulating Smart AI Responses
const AI_RESPONSES = [
    "I can help you find the best equipment for your soil type.",
    "For wheat during the sowing stage, I highly recommend a Seed Drill.",
    "Be careful, weather forecasts predict rain tomorrow. Delay pesticide spray.",
    "Urea is available in the Agro Exchange section nearby for ₹400.",
    "If your soil is clay, a heavy-duty Rotavator is essential for deep ploughing.",
    "Your recent request for the Chemical Spray is still pending approval from the owner.",
    "Are you looking to rent a tractor? You can check the unified dashboard for nearby listings!"
];

const FarmerChatbot = () => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: "ai", text: "Hello! I am your AI Farm Assistant. 🌾 How can I help you today?" }
    ]);
    const [input, setInput] = useState("");
    const [listening, setListening] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const getIntelligentResponse = async (userInput) => {
        // You named it VITE_GROK_API_KEY, but it contains a Groq (gsk_) key!
        const groqApiKey = import.meta.env.VITE_GROK_API_KEY || import.meta.env.VITE_GROQ_API_KEY;

        if (!groqApiKey) {
            return "⚠️ System Alert: AI requires an API Key. Please add `VITE_GROK_API_KEY=your_key_here` to `.env.local` and restart the server.";
        }

        try {
            // Rerouting dynamically to Groq Cloud since the key provided ('gsk_') is for the blazing fast Groq Engine natively running Llama3!
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${groqApiKey}`,
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant", // High speed intelligent modern model from Groq
                    messages: [
                        { 
                            role: "system", 
                            content: "You are an extremely helpful, concise, and highly intelligent agricultural farming assistant for the AgroShare platform in India. You give farmers advice on crops, weather, equipment, pesticides, and farming strategies. Answer directly, do NOT use markdown formatting, and keep it under 3 sentences."
                        },
                        { role: "user", content: userInput }
                    ],
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                return `API Error: ${data.error.message}`;
            }

            if (data.choices && data.choices[0]) {
                return data.choices[0].message.content;
            }
        } catch (error) {
            return `Failed to reach the AI Engine: ${error.message}`;
        }
        
        return "AI was unable to process your request at this moment.";
    };

    const handleSend = async (overrideText = null) => {
        const textToSubmit = overrideText || input;
        if (!textToSubmit.trim()) return;
        
        setMessages(prev => [...prev, { sender: "user", text: textToSubmit }]);
        setInput("");
        setIsTyping(true);

        // Fetch Intelligent Response
        const reply = await getIntelligentResponse(textToSubmit);
        
        setMessages(prev => [...prev, { sender: "ai", text: reply }]);
        setIsTyping(false);
    };

    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support voice input.");
            return;
        }

        const recognition = new SpeechRecognition();
        
        // Magically sync microphone input language with the Google Translate cookie!
        const match = document.cookie.match(/googtrans=\/en\/([a-z]{2})/);
        let lang = 'en-US';
        if (match && match[1]) {
            const code = match[1];
            if (code === 'hi') lang = 'hi-IN';
            else if (code === 'mr') lang = 'mr-IN';
            else if (code === 'te') lang = 'te-IN';
            else if (code === 'ta') lang = 'ta-IN';
            else if (code === 'gu') lang = 'gu-IN';
            else if (code === 'bn') lang = 'bn-IN';
            else if (code === 'pa') lang = 'pa-IN';
            else if (code === 'ml') lang = 'ml-IN';
            else if (code === 'kn') lang = 'kn-IN';
        }
        
        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setListening(true);
        recognition.onend = () => setListening(false);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            // Instantly send the spoken text
            handleSend(transcript);
        };

        try {
            recognition.start();
        } catch (e) {
            console.error("Speech recognition error:", e);
            setListening(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setOpen(true)}
                        className="fixed bottom-6 right-6 z-[100] w-14 h-14 bg-green-600 rounded-full shadow-[0_10px_25px_-5px_rgba(22,163,74,0.5)] flex items-center justify-center text-white focus:outline-none"
                    >
                        <MdChat className="w-6 h-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chatbot Window */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="fixed bottom-6 right-6 z-[100] w-[360px] h-[550px] max-h-[85vh] max-w-[calc(100vw-32px)] bg-white rounded-3xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-600 to-green-500 p-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3 text-white">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
                                    🤖
                                </div>
                                <div>
                                    <h3 className="font-bold leading-tight">Farmer AI Bot</h3>
                                    <p className="text-[10px] text-green-100 uppercase tracking-widest font-bold">Online • Llama 3.1</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-white transition-colors focus:outline-none"
                            >
                                <MdClose className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
                            {messages.map((msg, idx) => (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    key={idx} 
                                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                                        msg.sender === "user" 
                                            ? "bg-green-600 text-white rounded-br-none shadow-md shadow-green-600/20" 
                                            : "bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-sm"
                                    }`}>
                                        {msg.text}
                                    </div>
                                </motion.div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-100 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
                            <button
                                onClick={startListening}
                                disabled={listening}
                                className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-300 ${
                                    listening 
                                        ? "bg-red-100 text-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" 
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                                title="Speak to AI"
                            >
                                {listening ? <MdMicOff className="w-5 h-5" /> : <MdMic className="w-5 h-5" />}
                            </button>
                            
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Type or say something..."
                                className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:bg-white transition-all border border-transparent focus:border-green-500"
                            />
                            
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim()}
                                className="w-10 h-10 flex-shrink-0 bg-green-600 text-white rounded-full flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                <MdSend className="w-4 h-4 ml-1" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default FarmerChatbot;
