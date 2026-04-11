import React from "react";
import { motion } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { Navigate } from "react-router-dom";
import { MdAccountBalance, MdAnalytics, MdDescription, MdSatellite, MdReceipt } from "react-icons/md";
import { useNavigate } from "react-router-dom";

const AuditDashboard = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    if (user?.role !== "audit") return <Navigate to="/" replace />;

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between"
                >
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-display">Bank Audit System</h1>
                        <p className="text-gray-500 mt-2">Monitor financial anomalies, loan tracking, and farm revenue reports for auditing purposes.</p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                            <MdAccountBalance className="h-6 w-6" />
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4 border-b-4 border-b-indigo-600">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <MdSatellite className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Satellite Claim Audit</h3>
                            <p className="text-sm text-gray-500 mt-1">Review forensic indices (NDVI/NDWI) and authorize crop insurance payouts.</p>
                            <button className="w-full mt-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-sm transition text-left px-4 flex items-center gap-3">
                                <MdReceipt /> Tax Audit Logs
                            </button>
                        </div>
                        <button 
                            onClick={() => navigate('/audit-claims')}
                            className="mt-auto bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                        >
                            Start Investigation
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <MdAnalytics className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Transaction Logs</h3>
                            <p className="text-sm text-gray-500 mt-1">Review aggregated platform transactions.</p>
                        </div>
                        <button className="mt-auto bg-indigo-50 text-indigo-600 py-2 rounded-xl font-semibold hover:bg-indigo-100 transition">View Logs</button>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center">
                            <MdDescription className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Generate Reports</h3>
                            <p className="text-sm text-gray-500 mt-1">Download official audit compliance reports.</p>
                        </div>
                        <button className="mt-auto bg-teal-50 text-teal-600 py-2 rounded-xl font-semibold hover:bg-teal-100 transition">Export PDF</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditDashboard;
