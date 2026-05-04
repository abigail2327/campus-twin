// ==========================================
// CLASSROOM ONE: OCCUPANCY & POWER TELEMETRY
// ==========================================

#include <MKRWAN.h>
#include <Adafruit_NeoPixel.h>
#include "INA219.h"

// --- PINS & HARDWARE ---
const int PIR_PIN = 4;
const int LIGHT_PIN = 2;
const int CAMPUS_MODE_PIN = 3;
#define LED_PIN 6
#define LED_COUNT 38 

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);
INA219 INA(0x40);

// --- OCCUPANCY SETTINGS ---
unsigned long lastMotionTime = 0;
const unsigned long occupancyTimeout = 2000;
bool isLightOn = true;
bool classActiveOverride = false;

// --- ENERGY TRACKING ---
float power_per_interval = 0;
unsigned long previousPowerMillis = 0;
const int powerInterval = 10000; // 10 seconds
float accumulated_power = 0;
int power_sample_count = 0;

// --- STATE VARIABLES ---
String campus_mode = "AUTO";
unsigned long lastLEDblink = 0;
bool ledState = false;

// --- LoRaWAN & TTN ---
LoRaModem modem;
String appEui = "0000000000000000";
String appKey = "BCBEE9CB226DB041FDADA6DFCCE04776"; 

unsigned long lastSend = 0;
const unsigned long sendInterval = 60000; // 60s heartbeat
bool prevPirState = 0;
bool prevLightState = 0;
int lastSentPower = 0;

void setup() {
  Serial.begin(115200);
  
  pinMode(PIR_PIN, INPUT);
  pinMode(LIGHT_PIN, OUTPUT);
  pinMode(CAMPUS_MODE_PIN, INPUT);

  // Initialize LED Strip
  strip.begin();           
  strip.setBrightness(50); 
  strip.clear();
  strip.show();            

  // Initialize INA219 Sensor
  Wire.begin();
  if (!INA.begin()) {
    Serial.println("INA219 Connection Failed. Fix and Reboot");
  }
  INA.setMaxCurrentShunt(3.2, 0.106);

  // joinTTN(); // Uncomment to enable LoRa
  Serial.println("Classroom 1 Node Initialized");
}

void loop() {
  int pirState = digitalRead(PIR_PIN);
  int campus_pin_switch = digitalRead(CAMPUS_MODE_PIN);
  
  // Set Operating Mode
  if (campus_pin_switch) {
    campus_mode = "ALL_ON"; 
  } else {
    campus_mode = "AUTO";
  }

  // --- ACTUATION LOGIC ---
  if (campus_mode == "ALL_ON") {
    strip.fill(strip.Color(255, 147, 41), 0, LED_COUNT);
    isLightOn = true;
  } 
  else if (campus_mode == "AUTO") { 
    if (pirState == HIGH) {
      lastMotionTime = millis();
      if (!isLightOn) {
        strip.fill(strip.Color(255, 147, 41), 0, LED_COUNT); 
        isLightOn = true;
        Serial.println("LSS: ON (Motion Detected)");
      }
    } else {
      if (classActiveOverride) { 
        strip.fill(strip.Color(255, 147, 41), 0, LED_COUNT); 
        isLightOn = true;
        Serial.println("LSS: ON (Class Scheduled)");
      } 
      else if (isLightOn && (millis() - lastMotionTime > occupancyTimeout)) { 
        strip.clear();
        isLightOn = false;
        Serial.println("LSS: OFF (Room Empty)");
      }
    }
  }
  strip.show();

  // --- BACKGROUND TASKS ---
  calculatePowerConsumption();

  // --- TELEMETRY SEND RULES ---
  bool timeToSend = (millis() - lastSend >= sendInterval);
  bool pirChanged = (pirState != prevPirState);
  bool lightChanged = (isLightOn != prevLightState);
  bool powerChanged = (abs(power_per_interval - lastSentPower) > 1);

  if (timeToSend || pirChanged || lightChanged || powerChanged) { 
    // sendUplink((uint8_t)pirState, (uint8_t)isLightOn, (uint16_t)power_per_interval);
    lastSend = millis();
    prevPirState = pirState;
    prevLightState = isLightOn;
    lastSentPower = power_per_interval;
  }

  // Debug LED Blink
  if (millis() - lastLEDblink > 1000) {
    lastLEDblink = millis();      
    ledState = !ledState;         
    digitalWrite(LIGHT_PIN, ledState);
  }

  delay(200);
}

// ================== HELPER FUNCTIONS ==================

void calculatePowerConsumption() {
  int currentPowerMillis = millis();
  float node_power = INA.getPower_mW();
  
  accumulated_power += node_power;
  power_sample_count++; 

  if (currentPowerMillis - previousPowerMillis >= powerInterval) {
    power_per_interval = accumulated_power / power_sample_count;
    Serial.print("Avg Power (10s): ");
    Serial.println(power_per_interval);

    accumulated_power = 0;
    power_sample_count = 0;
    previousPowerMillis = currentPowerMillis;
  }
}

void joinTTN() {
  if (!modem.begin(EU868)) {
    Serial.println("Failed to start LoRa modem");
    while (1);
  }
  modem.setADR(true);
  Serial.print("Device EUI: ");
  Serial.println(modem.deviceEUI());
  Serial.println("Joining TTN...");
  
  if (!modem.joinOTAA(appEui, appKey)) {
    Serial.println("Join failed.");
    while (1);
  }
  Serial.println("Joined TTN!");
}

void sendUplink(uint8_t pir, uint8_t light, uint16_t power) {
  uint8_t payload[4];
  payload[0] = pir;
  payload[1] = light;
  payload[2] = (power >> 8) & 0xFF;
  payload[3] = power & 0xFF;

  modem.beginPacket();
  modem.write(payload, sizeof(payload));
  int err = modem.endPacket(false);

  Serial.print("Uplink sent -> PIR: "); Serial.print(pir);
  Serial.print(" | Light: "); Serial.print(light);
  Serial.print(" | Power: "); Serial.print(power);
  Serial.print(" | Result: "); Serial.println(err);
}

void checkClassDownlink() {
  if (modem.available()) {
    int classActive = modem.read();
    Serial.print("DOWNLINK - Class Active: ");
    Serial.println(classActive);
    classActiveOverride = (classActive == 1);
  }
}