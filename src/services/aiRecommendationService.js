export const generateAIRecommendations = async (inputData) => {
  // Using a mock recommendation generation for now
  // Real implementation would call Gemini AI or another LLM
  
  const { crop, soil, stage, location, weatherData } = inputData;
  const isGoodWeather = weatherData && weatherData.current.severity !== 'bad';
  
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

  // Rule-based mappings to augment/simulate AI
  const map = {
    'wheat': {
      'sowing': { name: 'Seed Drill', type: 'Tractor Attachment' },
      'growing': { name: 'Sprayer', type: 'Sprayer' },
      'harvesting': { name: 'Combine Harvester', type: 'Harvester' }
    },
    'sugarcane': {
      'sowing': { name: 'Sugarcane Planter', type: 'Planter' },
      'growing': { name: 'Drip Irrigation Tools', type: 'Tools' },
      'harvesting': { name: 'Sugarcane Harvester', type: 'Harvester' }
    },
    'rice': {
      'sowing': { name: 'Paddy Transplanter', type: 'Planter' },
      'growing': { name: 'Water Pump', type: 'Tools' },
      'harvesting': { name: 'Paddy Harvester', type: 'Harvester' }
    }
  };

  const defaultEq = { name: 'Rotavator', type: 'Tractor Attachment' };
  const cropLower = crop.toLowerCase();
  const stageLower = stage.toLowerCase();
  
  let recEq = defaultEq;
  if(map[cropLower] && map[cropLower][stageLower]) {
    recEq = map[cropLower][stageLower];
  } else if (stageLower === 'preparation') {
    recEq = { name: 'Rotavator & Plough', type: 'Tractor Attachment' };
  }

  const recommendations = [
    {
      id: 1,
      equipmentName: recEq.name,
      confidence: 96,
      reason: `Recommended for ${soil} soil and ${crop} during the ${stage} stage.`,
      action: "Book Now",
      timing: isGoodWeather ? "Optimal time to use today." : "Wait for better weather conditions.",
      isOptimalTiming: isGoodWeather,
      impact: "High ROI"
    },
    {
      id: 2,
      equipmentName: "Tractor (50 HP+)",
      confidence: 85,
      reason: "Needed to operate heavy attachments and transport goods.",
      action: "Check Availability",
      timing: "Flexible",
      isOptimalTiming: true,
      impact: "Essential"
    }
  ];

  return {
    recommendations,
    weatherContext: weatherData ? weatherData.current.label : "Clear",
    analysis: `Based on your location in ${location}, your ${soil} soil profile is well-suited for ${crop}. Given the current ${stage} phase and weather forecasts, prioritized mechanization will increase yield by ~15%.`
  };
};
