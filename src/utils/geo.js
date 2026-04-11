// ── Haversine distance (km) between two lat/lng points ──────────────
export const getDistanceKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getUserLocation = () =>
    new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            (err) => {
                console.error("Geolocation Error:", err);
                reject(err);
            },
            { 
                enableHighAccuracy: true, 
                timeout: 15000, // 15 seconds for mobile GPS
                maximumAge: 1000 * 60 * 5 // Accept cached location up to 5 minutes old
            }
        );
    });

// ── Reverse geocode coordinates → human-readable address ─────────────
// Uses OpenStreetMap Nominatim (free, no API key required)
export const reverseGeocode = async (lat, lng) => {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
            {
                headers: { "Accept-Language": "en-IN" },
            }
        );
        if (!res.ok) throw new Error("Nominatim error");
        const data = await res.json();
        const a = data.address || {};

        // Build a concise, human-readable label
        const village = a.village || a.suburb || a.neighbourhood || a.hamlet || a.town || "";
        const district = a.county || a.district || a.city || "";
        const state = a.state || "";

        const parts = [village, district, state].filter(Boolean);
        if (parts.length >= 2) return parts.slice(0, 2).join(", ");
        // Fallback: take first 3 comma-parts of display_name
        return (
            data.display_name
                ?.split(",")
                .slice(0, 3)
                .map((s) => s.trim())
                .filter(Boolean)
                .join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        );
    } catch {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
};

// ── Detect overlapping time slots ────────────────────────────────────
// slot: { startTime: ISO string, endTime: ISO string }
export const slotsOverlap = (a, b) => {
    const aStart = new Date(a.startTime).getTime();
    const aEnd = new Date(a.endTime).getTime();
    const bStart = new Date(b.startTime).getTime();
    const bEnd = new Date(b.endTime).getTime();
    return aStart < bEnd && bStart < aEnd;
};

// ── Booking status helper ─────────────────────────────────────────────
export const getBookingCategory = (booking) => {
    const now = Date.now();
    const start = booking.startTime ? new Date(booking.startTime).getTime() : null;
    const end = booking.endTime ? new Date(booking.endTime).getTime() : null;

    if (booking.status === "cancelled") return "cancelled";
    if (booking.status === "completed") return "completed";
    if (start && end && now >= start && now <= end) return "ongoing";
    if (start && now < start) return "upcoming";
    if (end && now > end) return "completed";
    return "upcoming";
};
