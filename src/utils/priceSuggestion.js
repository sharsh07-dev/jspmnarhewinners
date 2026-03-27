// AI Price Suggestion – rule-based heuristic (no external API needed)
const BASE_PRICES = {
    Tractor: 250,  // ₹/hr
    Harvester: 400,
    Sprayer: 100,
    Rotavator: 150,
    Plough: 80,
    Tools: 50,
};

const DEMAND_MULTIPLIER = {
    // Months with high demand in India (Kharif/Rabi seasons)
    "March": 1.3, "April": 1.2, "June": 1.4, "July": 1.5,
    "October": 1.4, "November": 1.3, "December": 1.2,
};

const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

export const suggestPrice = (equipmentType) => {
    const base = BASE_PRICES[equipmentType] ?? 150;
    const currentMonth = months[new Date().getMonth()];
    const demand = DEMAND_MULTIPLIER[currentMonth] ?? 1.0;
    const suggested = Math.round(base * demand / 10) * 10; // round to nearest 10
    return { suggested, base, demand, month: currentMonth };
};
