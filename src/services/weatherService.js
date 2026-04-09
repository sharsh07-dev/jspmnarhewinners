/**
 * Weather Service using Open-Meteo API (Free, no API key required)
 * Provides current + 7-day forecast weather data
 */

const WMO_CODES = {
  0: { label: "Clear sky", icon: "☀️", severity: "good" },
  1: { label: "Mainly clear", icon: "🌤️", severity: "good" },
  2: { label: "Partly cloudy", icon: "⛅", severity: "good" },
  3: { label: "Overcast", icon: "☁️", severity: "moderate" },
  45: { label: "Foggy", icon: "🌫️", severity: "caution" },
  48: { label: "Depositing rime fog", icon: "🌫️", severity: "caution" },
  51: { label: "Light drizzle", icon: "🌦️", severity: "caution" },
  53: { label: "Moderate drizzle", icon: "🌦️", severity: "caution" },
  55: { label: "Dense drizzle", icon: "🌧️", severity: "bad" },
  61: { label: "Slight rain", icon: "🌧️", severity: "caution" },
  63: { label: "Moderate rain", icon: "🌧️", severity: "bad" },
  65: { label: "Heavy rain", icon: "🌧️", severity: "bad" },
  71: { label: "Slight snowfall", icon: "❄️", severity: "caution" },
  73: { label: "Moderate snowfall", icon: "❄️", severity: "bad" },
  75: { label: "Heavy snowfall", icon: "❄️", severity: "bad" },
  77: { label: "Snow grains", icon: "🌨️", severity: "bad" },
  80: { label: "Slight rain showers", icon: "🌦️", severity: "caution" },
  81: { label: "Moderate rain showers", icon: "🌧️", severity: "bad" },
  82: { label: "Violent rain showers", icon: "⛈️", severity: "bad" },
  85: { label: "Slight snow showers", icon: "🌨️", severity: "caution" },
  86: { label: "Heavy snow showers", icon: "🌨️", severity: "bad" },
  95: { label: "Thunderstorm", icon: "⛈️", severity: "bad" },
  96: { label: "Thunderstorm w/ hail", icon: "⛈️", severity: "bad" },
  99: { label: "Thunderstorm w/ heavy hail", icon: "⛈️", severity: "bad" },
};

export const getWeatherInfo = (code) =>
  WMO_CODES[code] || { label: "Unknown", icon: "🌡️", severity: "moderate" };

export const fetchWeather = async (lat, lon) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset&timezone=Asia%2FKolkata&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather API failed");
  const data = await res.json();

  const current = data.current;
  const daily = data.daily;

  return {
    current: {
      temp: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      rain: current.rain,
      windSpeed: current.wind_speed_10m,
      code: current.weather_code,
      ...getWeatherInfo(current.weather_code),
    },
    forecast: daily.time.map((date, i) => ({
      date,
      code: daily.weather_code[i],
      maxTemp: daily.temperature_2m_max[i],
      minTemp: daily.temperature_2m_min[i],
      precipitation: daily.precipitation_sum[i],
      maxWind: daily.wind_speed_10m_max[i],
      sunrise: daily.sunrise[i],
      sunset: daily.sunset[i],
      ...getWeatherInfo(daily.weather_code[i]),
    })),
  };
};

export const isGoodForFieldWork = (weatherData) => {
  if (!weatherData) return { good: false, reason: "No weather data" };
  const { current } = weatherData;
  if (current.severity === "bad") return { good: false, reason: `Avoid: ${current.label}` };
  if (current.windSpeed > 40) return { good: false, reason: "Wind too strong for field operations" };
  if (current.rain > 2) return { good: false, reason: "Active rainfall – pause operations" };
  if (current.temp > 42) return { good: false, reason: "Extreme heat – risk to operators" };
  return { good: true, reason: "Conditions suitable for field work" };
};
