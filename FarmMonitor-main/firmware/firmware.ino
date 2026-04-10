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

const String BASE_URL = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/farm_devices/";
const String FIRESTORE_URL = BASE_URL + DEVICE_ID;
const String HISTORY_URL = FIRESTORE_URL + "/history";

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
  Serial.println("\n--- AgriSense Pro: Final System Initializing ---");

  dht.begin();

  pinMode(IR_PIN, INPUT_PULLDOWN);  // FIXED
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

// ======================== TIMERS ========================
unsigned long lastConfigCheck = 0;
unsigned long lastSensorSync = 0;

// ======================== LOOP ========================
void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("System: Waiting for WiFi...");
    delay(1000);
    return;
  }

  unsigned long currentMillis = millis();

  // ⚡ 1. LIGHTNING-FAST Config Checking (Every 800ms max)
  if (currentMillis - lastConfigCheck >= 800 || lastConfigCheck == 0) {
    fetchFirestoreConfig();
    lastConfigCheck = currentMillis;
  }

  // 🔐 2. Immediate IR SENSOR
  int intruder = digitalRead(IR_PIN);
  if (intruder == LOW) {
    securityAlert = true;
    digitalWrite(LED_PIN, HIGH);
  } else {
    securityAlert = false;
    digitalWrite(LED_PIN, LOW);
  }

  // 🕒 Setup Slow-Sync Threshold (Every 5 seconds)
  bool timeToSync = (currentMillis - lastSensorSync >= 5000);

  static int moisturePercent = 0;
  static float temp = 0;
  static float hum = 0;

  // 🌱 3. Slow Sensor Polling
  if (timeToSync || lastSensorSync == 0) {
    int rawMoisture = analogRead(SOIL_MOISTURE_PIN);
    moisturePercent = map(rawMoisture, 4095, 1500, 0, 100);
    moisturePercent = constrain(moisturePercent, 0, 100);

    temp = dht.readTemperature();
    hum = dht.readHumidity();
  }

  // 🚿 4. Irrigation Logic
  bool motorShouldRun = false;

  if (currentMode == "MANUAL") {
    motorShouldRun = motorOverride;
  } else {
    if (moisturePercent < 22) motorShouldRun = true;
    else if (moisturePercent > 28) motorShouldRun = false;
    else motorShouldRun = motorStatus;
  }

  bool motorStateChanged = false;

  // ⚙️ 5. Actuate Servo
  if (motorShouldRun && !motorStatus) {
    Serial.println(">>> ACTION: OPEN VALVE");
    waterValveServo.write(180);
    motorStatus = true;
    motorStateChanged = true;
    logHistoricalEvent("Irrigation ON");
  } else if (!motorShouldRun && motorStatus) {
    Serial.println(">>> ACTION: CLOSE VALVE");
    waterValveServo.write(0);
    motorStatus = false;
    motorStateChanged = true;
    logHistoricalEvent("Irrigation OFF");
  }

  // ☁️ 6. Smart Cloud Push
  // ONLY pushes data if 5 seconds passed OR the user clicked the manual button!
  if (timeToSync || motorStateChanged) {
    syncDataToFirestore(moisturePercent, temp, hum);
    lastSensorSync = millis(); 
    
    // Serial Status
    Serial.print("Moisture: "); Serial.print(moisturePercent);
    Serial.print("% | Mode: "); Serial.print(currentMode);
    Serial.print(" | Motor: "); Serial.println(motorStatus ? "ACTIVE" : "OFF");
  }

  // 🚀 Tiny 50ms buffer instead of 1000ms rigid block!
  delay(50);
}

// ======================== FETCH ========================
void fetchFirestoreConfig() {
  HTTPClient http;
  http.begin(FIRESTORE_URL);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(1500);
    deserializeJson(doc, payload);

    if (!doc["fields"]["mode"]["stringValue"].isNull())
      currentMode = doc["fields"]["mode"]["stringValue"].as<String>();

    if (!doc["fields"]["motorOverride"]["booleanValue"].isNull())
      motorOverride = doc["fields"]["motorOverride"]["booleanValue"].as<bool>();
  }
  http.end();
}

// ======================== FIREBASE ========================
void syncDataToFirestore(int moisture, float t, float h) {
  HTTPClient http;

  String url = FIRESTORE_URL +
    "?updateMask.fieldPaths=moisture"
    "&updateMask.fieldPaths=temperature"
    "&updateMask.fieldPaths=humidity"
    "&updateMask.fieldPaths=motorStatus"
    "&updateMask.fieldPaths=securityAlert"
    "&updateMask.fieldPaths=latitude"
    "&updateMask.fieldPaths=longitude";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(1024);
  JsonObject fields = doc.createNestedObject("fields");

  fields["moisture"]["integerValue"] = moisture;
  fields["temperature"]["doubleValue"] = isnan(t) ? 0 : t;
  fields["humidity"]["doubleValue"] = isnan(h) ? 0 : h;
  fields["motorStatus"]["booleanValue"] = motorStatus;
  fields["securityAlert"]["booleanValue"] = securityAlert;

  // STATIC GPS
  fields["latitude"]["doubleValue"] = staticLat;
  fields["longitude"]["doubleValue"] = staticLng;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  http.PATCH(jsonPayload);
  http.end();
}

// ======================== HISTORY ========================
void logHistoricalEvent(String eventType) {
  HTTPClient http;
  http.begin(HISTORY_URL);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(512);
  JsonObject fields = doc.createNestedObject("fields");

  fields["event"]["stringValue"] = eventType;
  fields["mode"]["stringValue"] = currentMode;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  http.POST(jsonPayload);
  http.end();
}