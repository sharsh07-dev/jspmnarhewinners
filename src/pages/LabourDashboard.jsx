import React from "react";
import { motion } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { Navigate } from "react-router-dom";
import { MdWorkOutline, MdAttachMoney, MdCheckCircle } from "react-icons/md";

const LabourDashboard = () => {
    const { user } = useAuthStore();

    if (user?.role !== "labour") return <Navigate to="/" replace />;

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between"
                >
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-display">Labour Portal</h1>
                        <p className="text-gray-500 mt-2">View your assignments, track your wages, and update availability.</p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-3">
                        <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center">
                            <MdWorkOutline className="h-6 w-6" />
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center">
                            <MdCheckCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">My Attendance</h3>
                            <p className="text-sm text-gray-500 mt-1">Check your daily attendance marked by Mukadam.</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                            <MdAttachMoney className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Wage History</h3>
                            <p className="text-sm text-gray-500 mt-1">View your earnings and pending payments.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabourDashboard;
