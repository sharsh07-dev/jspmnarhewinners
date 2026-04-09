import { useEffect, useState } from "react";
import { MdLanguage } from "react-icons/md";

const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "hi", label: "हिंदी" },
    { code: "mr", label: "मराठी" },
    { code: "te", label: "తెలుగు" },
    { code: "ta", label: "தமிழ்" },
    { code: "kn", label: "ಕನ್ನಡ" },
    { code: "gu", label: "ગુજરાતી" },
    { code: "pa", label: "ਪੰਜਾਬੀ" },
    { code: "bn", label: "বাংলা" },
    { code: "ml", label: "മലയാളം" },
];

export default function LanguageToggle({ scrolled, isHome }) {
    const [lang, setLang] = useState("en");

    useEffect(() => {
        // Read current language from googtrans cookie
        const match = document.cookie.match(/googtrans=\/en\/([a-z]{2})/);
        if (match && match[1]) {
            setLang(match[1]);
        }

        // Inject Google Translate script silently
        if (!document.getElementById("google-translate-script")) {
            window.googleTranslateElementInit = () => {
                if (window.google && window.google.translate) {
                    new window.google.translate.TranslateElement(
                        { 
                            pageLanguage: 'en', 
                            includedLanguages: 'en,hi,mr,te,ta,kn,gu,pa,bn,ml', 
                            autoDisplay: false 
                        },
                        'google_translate_element'
                    );
                }
            };
            const script = document.createElement('script');
            script.id = 'google-translate-script';
            script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    const changeLanguage = (e) => {
        const code = e.target.value;
        setLang(code);
        
        if (code === "en") {
            // Clear Google translate cookies to revert to English
            document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${window.location.hostname}; path=/;`;
        } else {
            // Set translation cookies
            document.cookie = `googtrans=/en/${code}; path=/;`;
            document.cookie = `googtrans=/en/${code}; domain=${window.location.hostname}; path=/;`;
        }
        
        // Reload to apply the translation immediately
        window.location.reload();
    };

    const textColor = scrolled || !isHome ? "text-gray-900" : "text-white";
    const iconColor = scrolled || !isHome ? "text-green-600" : "text-white";
    const bgColor = scrolled || !isHome ? "bg-gray-100 hover:bg-gray-200 border-transparent" : "bg-white/10 hover:bg-white/20 border-white/20";

    return (
        <div className={`relative flex items-center backdrop-blur-sm rounded-xl px-2 py-1.5 transition-all w-28 md:w-32 border ${bgColor}`}>
            <MdLanguage className={`text-xl absolute left-2 pointer-events-none ${iconColor}`} />
            <select
                value={lang}
                onChange={changeLanguage}
                className={`w-full bg-transparent text-sm font-bold cursor-pointer appearance-none pl-7 pr-1 outline-none ${textColor}`}
            >
                {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="text-gray-900 bg-white">
                        {l.label}
                    </option>
                ))}
            </select>
            {/* Hidden native Google element */}
            <div id="google_translate_element" className="hidden"></div>
        </div>
    );
}
