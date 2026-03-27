import React from "react";
import { motion } from "framer-motion";
import { MdLocationOn, MdStar, MdShoppingCart, MdHandshake, MdAccessTime } from "react-icons/md";
import { Link } from "react-router-dom";

const PLACEHOLDER = "https://images.unsplash.com/photo-1592982537447-6f23dbdc7e90?auto=format&fit=crop&w=800&q=70";

const LISTING_BADGE = {
    rent: { label: "For Rent", cls: "bg-blue-500 text-white", icon: <MdAccessTime className="h-3 w-3" /> },
    sell: { label: "For Sale", cls: "bg-orange-500 text-white", icon: <MdShoppingCart className="h-3 w-3" /> },
    both: { label: "Rent & Sell", cls: "bg-purple-500 text-white", icon: <MdHandshake className="h-3 w-3" /> },
};

const EquipmentCard = ({ equipment, index = 0 }) => {
    const { id, name, type, price, salePrice, location, imageUrl, rating, status, listingType = "rent", ownerName, _distKm } = equipment;
    const badge = LISTING_BADGE[listingType] || LISTING_BADGE.rent;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
            whileHover={{ y: -6, boxShadow: "0 24px 64px rgba(22,163,74,0.13)" }}
            className="bg-white rounded-2xl overflow-hidden border border-gray-100 group cursor-pointer flex flex-col"
        >
            {/* ── Image ── */}
            <div className="relative h-52 overflow-hidden bg-gray-100 flex-shrink-0">
                <img
                    src={imageUrl || PLACEHOLDER}
                    alt={name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                {/* Gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Type chip */}
                <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">{type}</span>
                    <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full shadow ${badge.cls}`}>
                        {badge.icon}{badge.label}
                    </span>
                </div>

                {/* Price chip */}
                <div className="absolute top-3 right-3">
                    {(listingType === "rent" || listingType === "both") && (
                        <div className="bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg text-right">
                            <span className="text-sm font-black text-green-700">₹{price}</span>
                            <span className="text-xs text-gray-500">/hr</span>
                        </div>
                    )}
                    {listingType === "sell" && (
                        <div className="bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg">
                            <span className="text-sm font-black text-orange-600">₹{salePrice || price}</span>
                            <span className="text-xs text-gray-500"> sell</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="p-5 flex flex-col flex-grow">
                <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 truncate group-hover:text-green-700 transition-colors">{name}</h3>

                <div className="flex items-center gap-1 text-gray-500 text-sm mb-1.5">
                    <MdLocationOn className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="truncate">{location?.address || location || "India"}</span>
                    {_distKm != null && (
                        <span className="ml-auto flex-shrink-0 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            {_distKm < 1 ? `${(_distKm * 1000).toFixed(0)}m` : `${_distKm.toFixed(1)} km`}
                        </span>
                    )}
                </div>

                {ownerName && (
                    <p className="text-xs text-gray-400 mb-3">Listed by <span className="font-semibold text-gray-600">{ownerName}</span></p>
                )}

                {/* Dual price row for "both" type */}
                {listingType === "both" && (
                    <div className="flex gap-2 mb-3">
                        <div className="flex-1 bg-blue-50 rounded-xl px-3 py-2 text-center">
                            <p className="text-xs text-blue-600 font-medium">Rent</p>
                            <p className="font-black text-blue-700 text-sm">₹{price}/hr</p>
                        </div>
                        <div className="flex-1 bg-orange-50 rounded-xl px-3 py-2 text-center">
                            <p className="text-xs text-orange-600 font-medium">Buy</p>
                            <p className="font-black text-orange-600 text-sm">₹{salePrice || "—"}</p>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mt-auto pt-2">
                    {rating ? (
                        <div className="flex items-center gap-1 text-amber-500 font-semibold text-sm">
                            <MdStar className="h-4 w-4" />
                            <span>{Number(rating).toFixed(1)}</span>
                        </div>
                    ) : <span className="text-xs text-gray-300">No reviews yet</span>}

                    <Link
                        to={`/equipment/${id}`}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all shadow-md hover:shadow-green-200 hover:-translate-y-0.5"
                    >
                        View Details →
                    </Link>
                </div>
            </div>
        </motion.div>
    );
};

export const EquipmentCardSkeleton = () => (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
        <div className="animate-pulse bg-gray-200 h-52 w-full" />
        <div className="p-5 space-y-3">
            <div className="animate-pulse bg-gray-200 h-5 w-3/4 rounded" />
            <div className="animate-pulse bg-gray-200 h-4 w-1/2 rounded" />
            <div className="animate-pulse bg-gray-200 h-10 w-full mt-4 rounded-xl" />
        </div>
    </div>
);

export default EquipmentCard;
