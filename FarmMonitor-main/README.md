# AgriSense Farm - Stepper Motor & Firebase System

## 📂 Architecture Overview

This architecture completely removes the need for a localized `Node.js` PC intermediary. 
1. The **ESP32** links directly to **Google Cloud (Firebase Firestore)**.
2. The **React Native Mobile App** links directly to **Firebase Firestore**.
Data updates instantly across the globe using real-time sync.

## 🔌 Hardware Wiring Diagram

**Microcontroller:** ESP32 DevKit V1 (DOIT 30-pin version)

### 1. DHT11/DHT22 (Temperature & Humidity)
- **VCC:** -> ESP32 3.3V
- **GND:** -> ESP32 GND
- **DATA:** -> ESP32 GPIO 4 (D4)

### 2. Analog Soil Moisture Sensor
- **VCC:** -> ESP32 3.3V
- **GND:** -> ESP32 GND
- **A0 (Data):** -> ESP32 GPIO 34 (D34 - ADC Pin)

### ⚙️ 3. Servo Motor (Standard Orange/Red/Brown Mechanism)
*(This servo physically turns an arm 90 degrees to clamp-open or restrict the water tubing!)*
- **Red (+ / VCC):** Attach to **ESP32 VIN** (5V power)
- **Brown (- / GND):** Attach to **ESP32 GND**
- **Orange (Signal):** Attach to **ESP32 GPIO 25 (D25)**

## 🚀 Deployment Instructions

### Firebase Setup
1. Create a Firebase Project using [Google Firebase Console](https://console.firebase.google.com/).
2. Create a **Firestore Database** in Test Mode (allowing open read/writes).
3. Create a Custom Collection named `farm_devices` and a document inside it titled `esp32_01`.

### ESP32 Firmware Upload
1. Open `SmartFarm/firmware/firmware.ino` in the Arduino IDE.
2. Under Tools -> Manage Libraries, Ensure you have:
   - `ArduinoJson` (by Benoit Blanchon)
   - `DHT sensor library` (by Adafruit)
   - `Stepper` (Built-in Arduino library)
3. Change the definitions at the top to your local `WiFi Credentials`, and importantly, to your Firebase `PROJECT_ID`.
4. Upload to the ESP32.

### React Native Dashboard
Inside `SmartFarm/mobile/firebaseConfig.js`, dump your specific web credentials from Firebase Project Settings, and run:
```bash
npx expo start
```
