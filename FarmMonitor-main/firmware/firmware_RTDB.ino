#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>

// ======================== CONFIGURATION ========================
const char* ssid = "noname";
const char* password = "passwordnahiaahe";

const String PROJECT_ID = "agroshare-17977";
const String DEVICE_ID  = "esp32_01";

// ⚠️ CHANGED: Now completely targets Firebase REALTIME DATABASE instead of Firestore
const String RTDB_URL = "https://" + PROJECT_ID + "-default-rtdb.firebaseio.com/farm_devices/" + DEVICE_ID;

// ======================== STATIC GPS ========================
double staticLat = 18.5204;
double staticLng = 73.8567;

// ======================== PINS ========================
#define DHT_PIN 4
#define SOIL_MOISTURE_PIN 34
#define IR_PIN 19
#define LED_PIN 18

const int SERVO_PIN = 25;

// ======================== DEVICES ========================
DHT dht(DHT_PIN, DHT11);
Servo waterValveServo;

// ======================== VARIABLES ========================
String currentMode = "AUTO";
bool motorOverride = false;
bool motorStatus = false;
bool securityAlert = false;

// ======================== SETUP ========================
void setup() {
  Serial.begin(115200);
  Serial.println("\n--- AgriSense Pro: Realtime DB Connecting ---");

  dht.begin();

  pinMode(IR_PIN, INPUT_PULLDOWN);
  pinMode(LED_PIN, OUTPUT);

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  waterValveServo.setPeriodHertz(50);
  waterValveServo.attach(SERVO_PIN, 500, 2400);

  waterValveServo.write(0);
  motorStatus = false;

  WiFi.begin(ssid, password);
  Serial.print("WiFi: Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println("\nWiFi: Connected!");
}

// ======================== LOOP ========================
void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("System: Waiting for WiFi...");
    delay(1000);
    return;
  }

  // 🔐 IR SENSOR
  int intruder = digitalRead(IR_PIN);

  if (intruder == LOW) {
    securityAlert = true;
    digitalWrite(LED_PIN, HIGH);
    Serial.println("!!! ALERT: INTRUDER DETECTED !!!");
  } else {
    securityAlert = false;
    digitalWrite(LED_PIN, LOW);
  }

  // ☁️ Fetch Cloud Commands (FROM REALTIME DB)
  fetchRealtimeConfig();

  // 🌱 Sensors
  int rawMoisture = analogRead(SOIL_MOISTURE_PIN);
  int moisturePercent = map(rawMoisture, 4095, 1500, 0, 100);
  moisturePercent = constrain(moisturePercent, 0, 100);

  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  // 🚿 Irrigation Logic
  bool motorShouldRun = false;

  if (currentMode == "MANUAL") {
    motorShouldRun = motorOverride;
  } else {
    if (moisturePercent < 22) motorShouldRun = true;
    else if (moisturePercent > 28) motorShouldRun = false;
    else motorShouldRun = motorStatus;
  }

  // ⚙️ Servo
  if (motorShouldRun && !motorStatus) {
    Serial.println(">>> ACTION: OPEN VALVE");
    waterValveServo.write(180);
    motorStatus = true;
    logHistoricalEvent("Irrigation ON");
  } else if (!motorShouldRun && motorStatus) {
    Serial.println(">>> ACTION: CLOSE VALVE");
    waterValveServo.write(0);
    motorStatus = false;
    logHistoricalEvent("Irrigation OFF");
  }

  // ☁️ Sync Data (TO REALTIME DB)
  syncDataToRealtimeDB(moisturePercent, temp, hum);

  // 🧾 OUTPUT (STATIC GPS)
  Serial.print("Moisture: "); Serial.print(moisturePercent);
  Serial.print("% | Mode: "); Serial.print(currentMode);
  Serial.print(" | Motor: "); Serial.print(motorStatus ? "ACTIVE" : "OFF");
  Serial.print(" | Security: "); Serial.print(securityAlert ? "ALERT 🚨" : "SAFE");

  Serial.print(" | GPS: ");
  Serial.print(staticLat, 6);
  Serial.print(",");
  Serial.println(staticLng, 6);

  delay(1000);
}

// ======================== FETCH ========================
void fetchRealtimeConfig() {
  HTTPClient http;
  
  // ⚠️ Fetch directly from the config node
  http.begin(RTDB_URL + "/config.json");

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(512);
    deserializeJson(doc, payload);

    // ⚠️ RTDB JSON structure is beautifully simple!
    if (!doc["mode"].isNull()) {
      currentMode = doc["mode"].as<String>();
    }

    if (!doc["motorOverride"].isNull()) {
      motorOverride = doc["motorOverride"].as<bool>();
    }
  }
  http.end();
}

// ======================== FIREBASE ========================
void syncDataToRealtimeDB(int moisture, float t, float h) {
  HTTPClient http;

  // ⚠️ Notice the .json extension to tell Firebase we are pushing JSON data!
  http.begin(RTDB_URL + ".json");
  http.addHeader("Content-Type", "application/json");

  // Allocate JSON Document
  DynamicJsonDocument doc(1024);
  
  // ⚠️ Realtime Database allows deep path "PATCHING" safely 
  // It isolates fields by slashes so it matches what React is listening to
  doc["latestData/moisture"] = moisture;
  doc["latestData/temperature"] = isnan(t) ? 0 : t;
  doc["latestData/humidity"] = isnan(h) ? 0 : h;
  doc["latestData/motorStatus"] = motorStatus;
  doc["latestData/securityAlert"] = securityAlert;
  
  // STATIC GPS
  doc["latestData/latitude"] = staticLat;
  doc["latestData/longitude"] = staticLng;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // Standard ESP32 PATCH request
  int httpResponseCode = http.sendRequest("PATCH", jsonPayload);
  http.end();
}

// ======================== HISTORY ========================
void logHistoricalEvent(String eventType) {
  HTTPClient http;
  
  // ⚠️ POST adds an auto-generated unique ID to the history list
  http.begin(RTDB_URL + "/history.json");
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(512);
  doc["event"] = eventType;
  doc["mode"] = currentMode;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  http.POST(jsonPayload);
  http.end();
}
