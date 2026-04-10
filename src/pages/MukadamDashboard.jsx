import React from "react";
import { motion } from "framer-motion";
import useAuthStore from "../store/useAuthStore";
import { Navigate } from "react-router-dom";
import { MdGroup, MdWork, MdListAlt } from "react-icons/md";

const MukadamDashboard = () => {
    const { user } = useAuthStore();

    if (user?.role !== "mukadam") return <Navigate to="/" replace />;

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between"
                >
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 font-display">Mukadam Dashboard</h1>
                        <p className="text-gray-500 mt-2">Manage your labourers, track contracts, and find farm work.</p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                            <MdGroup className="h-6 w-6" />
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
                            <MdPeople className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">My Labour Force</h3>
                            <p className="text-sm text-gray-500 mt-1">Manage profiles of labourers under your leadership.</p>
                        </div>
                        <button className="mt-auto bg-orange-50 text-orange-600 py-2 rounded-xl font-semibold hover:bg-orange-100 transition">View Team</button>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                            <MdWork className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Available Contracts</h3>
                            <p className="text-sm text-gray-500 mt-1">Find new farm work opportunities nearby.</p>
                        </div>
                        <button className="mt-auto bg-blue-50 text-blue-600 py-2 rounded-xl font-semibold hover:bg-blue-100 transition">Browse Contracts</button>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                            <MdListAlt className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Active Jobs</h3>
                            <p className="text-sm text-gray-500 mt-1">Track attendance, payments, and ongoing work.</p>
                        </div>
                        <button className="mt-auto bg-green-50 text-green-600 py-2 rounded-xl font-semibold hover:bg-green-100 transition">Manage Jobs</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Also importing people icon inside the component missing it
import { MdPeople } from "react-icons/md";

export default MukadamDashboard;
