import React from "react";
import { motion } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { Navigate } from "react-router-dom";
import { MdAdminPanelSettings, MdPeople, MdDashboard, MdSettings } from "react-icons/md";

const AdminDashboard = () => {
    const { user } = useAuthStore();

    if (user?.role !== "admin") return <Navigate to="/" replace />;

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between"
                >
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-display">System Administration</h1>
                        <p className="text-gray-500 mt-2">Manage users, equipment platforms, and system settings.</p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                            <MdAdminPanelSettings className="h-6 w-6" />
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Example Cards */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                            <MdPeople className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Users</p>
                            <p className="text-2xl font-bold">12,450</p>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                            <MdDashboard className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Listings</p>
                            <p className="text-2xl font-bold">3,842</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                            <MdSettings className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">System Status</p>
                            <p className="text-2xl font-bold text-green-500">Live</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
