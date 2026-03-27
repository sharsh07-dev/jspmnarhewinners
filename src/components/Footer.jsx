import React from "react";
import { FaTractor } from "react-icons/fa";
import { MdEmail, MdPhone, MdLocationOn } from "react-icons/md";
import { FaFacebook, FaInstagram, FaTwitter, FaWhatsapp } from "react-icons/fa";
import { Link } from "react-router-dom";

const Footer = () => (
    <footer className="bg-gray-900 text-gray-300 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
                {/* Brand */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
                            <FaTractor className="text-white h-5 w-5" />
                        </div>
                        <span className="text-xl font-black text-white font-display">Agro<span className="text-green-400">Share</span></span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        India's smartest farmer equipment sharing platform. Connecting rural communities through technology.
                    </p>
                    <div className="flex gap-3 mt-6">
                        {[FaFacebook, FaInstagram, FaTwitter, FaWhatsapp].map((Icon, i) => (
                            <a key={i} href="#" className="w-9 h-9 bg-gray-800 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors duration-200">
                                <Icon className="h-4 w-4 text-gray-400 hover:text-white" />
                            </a>
                        ))}
                    </div>
                </div>

                {/* Quick Links */}
                <div>
                    <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-widest">Quick Links</h4>
                    <div className="space-y-2.5">
                        {[["Home", "/"], ["Find Equipment", "/equipment"], ["Dashboard", "/dashboard"], ["Admin Panel", "/admin"]].map(([label, to]) => (
                            <Link key={to} to={to} className="block text-sm text-gray-400 hover:text-green-400 transition-colors">{label}</Link>
                        ))}
                    </div>
                </div>

                {/* Equipment Types */}
                <div>
                    <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-widest">Equipment</h4>
                    <div className="space-y-2.5">
                        {["Tractors", "Harvesters", "Sprayers", "Ploughs", "Rotavators", "Tools"].map((t) => (
                            <Link key={t} to={`/equipment?type=${t}`} className="block text-sm text-gray-400 hover:text-green-400 transition-colors">{t}</Link>
                        ))}
                    </div>
                </div>

                {/* Contact */}
                <div>
                    <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-widest">Contact</h4>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <MdEmail className="h-4 w-4 text-green-500 flex-shrink-0" />
                            support@agroshare.in
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <MdPhone className="h-4 w-4 text-green-500 flex-shrink-0" />
                            +91 98765 43210
                        </div>
                        <div className="flex items-start gap-2 text-sm text-gray-400">
                            <MdLocationOn className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            Pune, Maharashtra, India
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-gray-500">© 2024 AgroShare. Built with 💚 for Indian Farmers.</p>
                <div className="flex gap-6 text-xs text-gray-500">
                    <a href="#" className="hover:text-green-400 transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-green-400 transition-colors">Terms of Service</a>
                    <a href="#" className="hover:text-green-400 transition-colors">Sitemap</a>
                </div>
            </div>
        </div>
    </footer>
);

export default Footer;
