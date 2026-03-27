import { useState, useEffect, useRef, useCallback } from "react";

export const useVoiceSearch = (onResult) => {
    const [listening, setListening] = useState(false);
    const recognition = useRef(null);

    useEffect(() => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const r = new SpeechRecognition();
        r.lang = "en-IN";
        r.continuous = false;
        r.interimResults = false;
        r.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            onResult(transcript);
            setListening(false);
        };
        r.onend = () => setListening(false);
        recognition.current = r;
    }, [onResult]);

    const toggle = useCallback(() => {
        if (!recognition.current) return;
        if (listening) {
            recognition.current.stop();
        } else {
            recognition.current.start();
            setListening(true);
        }
    }, [listening]);

    return { listening, toggle, supported: !!recognition.current };
};
