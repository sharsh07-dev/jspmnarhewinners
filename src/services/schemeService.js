import { db } from "../firebase";
import { ref, get, set, update, onValue } from "firebase/database";

const SCHEMES_REF = "schemes";
const METADATA_REF = "metadata/schemes";

export const getSchemes = (callback) => {
    const sRef = ref(db, SCHEMES_REF);
    return onValue(sRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            callback(list);
        } else {
            callback([]);
        }
    });
};

export const getMetadata = async () => {
    const mRef = ref(db, METADATA_REF);
    const snapshot = await get(mRef);
    return snapshot.val() || { lastUpdated: null };
};

export const refreshSchemes = async (initialSchemes = []) => {
    try {
        const mRef = ref(db, METADATA_REF);
        const sRef = ref(db, SCHEMES_REF);

        // In a real scenario, this would call a scraper or an API.
        // For now, we seed/update with the latest official list provided.
        const updates = {};
        initialSchemes.forEach(scheme => {
            updates[scheme.id] = scheme;
        });

        await update(sRef, updates);
        await set(mRef, { 
            lastUpdated: new Date().toISOString(),
            status: "success",
            count: initialSchemes.length
        });

        return { success: true, count: initialSchemes.length };
    } catch (error) {
        console.error("Error refreshing schemes:", error);
        return { success: false, error: error.message };
    }
};

export const toggleBookmark = async (userId, schemeId, currentBookmarks) => {
    const isBookmarked = currentBookmarks.includes(schemeId);
    const newBookmarks = isBookmarked 
        ? currentBookmarks.filter(b => b !== schemeId) 
        : [...currentBookmarks, schemeId];
    
    await set(ref(db, `users/${userId}/bookmarkedSchemes`), newBookmarks);
    return { success: true, isBookmarked: !isBookmarked };
};
