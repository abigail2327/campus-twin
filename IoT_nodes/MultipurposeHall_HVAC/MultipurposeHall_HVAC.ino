// ==========================================
// MULTIPURPOSE HALL: HVAC & AI PRE-COOLING
// ==========================================

#include <MKRWAN.h>
#include "DHT.h"
#include <Adafruit_NeoPixel.h>

// --- PINS & HARDWARE ---
#define DHTPIN 5     
#define DHTTYPE DHT11 
#define TEMP_POT_PIN A5
#define OCC_POT_PIN A4
#define FAN_CONTROL_PIN 2 
#define STRIP_PIN 6
#define CAMPUS_MODE_PIN 3
#define LED_COUNT 56

DHT dht(DHTPIN, DHTTYPE);
Adafruit_NeoPixel strip(LED_COUNT, STRIP_PIN, NEO_GRB + NEO_KHZ800);

// --- SYSTEM STATE & SENSOR VARIABLES ---
String campus_mode = "AUTO";
float finalSystemTemp = 0;      
float temp_reading_from_dht = 0; 
float temp_reading_from_pot = 20; 

int finalSystemOccupancy = 0;      
int simulated_occupancy_from_pot = 0; 
int occupancy_DT = 0; // Digital Twin Override

int fan_pwm = 0;
int fan_speed = 0;
int prevFanSpeed = 0;
bool lighting_state = 0; 

// --- SAFETY INTERLOCKS ---
bool fireDetected = false;
bool fireActive = false;
unsigned long fireStartTime = 0;
const unsigned long fireDuration = 5000; 

// --- AI DOWNLINK PREDICTIVE CONTROL ---
bool aiSpikePredicted = false;
unsigned long aiSpikeReceivedTime = 0;
const unsigned long aiSpikeHoldTime = 3000UL; 

// --- TIMERS & OVERRIDES ---
unsigned long currentTempMillis = 0; 
unsigned long previousTempMillis = 0; 
int previousPotValue = 0;
bool potOverrideActive = false; 
unsigned long previousTempPotMillis = 0;  

unsigned long currentOccMillis = 0; 
unsigned long previousOccMillis = 0; 
int previousOccPotValue = 0;
bool occPotOverrideActive = false; 
unsigned long previousOccPotMillis = 0;  

// --- LoRaWAN & TTN ---
LoRaModem modem;
String appEui = "0000000000000000";
String appKey = "4380291574B5F3A1839A2C37197AD8F5"; 

unsigned long lastSend = 0;
const unsigned long sendInterval = 60000;
float lastTemp = 0;
int lastOcc = 0;
int lastFan = 0;
unsigned long lastTempTime = 0;

void setup() {
  Serial.begin(115200);
  
  pinMode(TEMP_POT_PIN, INPUT);
  pinMode(OCC_POT_PIN, INPUT);
  pinMode(FAN_CONTROL_PIN, OUTPUT);
  pinMode(CAMPUS_MODE_PIN, INPUT);
  
  dht.begin(); 
  strip.begin();           
  strip.setBrightness(50); 
  strip.clear();
  strip.show();            

  digitalWrite(FAN_CONTROL_PIN, HIGH);
  delay(5000); // Allow sensors to stabilize

  // joinTTN(); // Uncomment to enable LoRa
  Serial.println("Multipurpose Hall Node Initialized");
}

void loop() {
  // 1) UPDATE TELEMETRY
  getTempReading();
  detectFireSpike(finalSystemTemp);
  checkOccupancy();

  int campus_pin_switch = digitalRead(CAMPUS_MODE_PIN);
  if (campus_pin_switch) {
    campus_mode = "ALL_ON"; 
  } else {
    campus_mode = "AUTO";
  }

  // 2) SAFETY & HVAC ACTUATION
  if (fireActive) {
    if (millis() - fireStartTime < fireDuration) {
      strip.fill(strip.Color(255, 0, 0), 0, LED_COUNT); // RED ALARM
      strip.show();
    } else {
      fireActive = false; 
    }
  } 
  else { 
    if (campus_mode == "AUTO") {
      // Tiered HVAC Loop
      if ((finalSystemTemp > 26) || (finalSystemOccupancy > 60)) { 
        fan_speed = 100;
        lighting_state = 1;
        strip.fill(strip.Color(255, 147, 41), 0, LED_COUNT); 
      } 
      else if ((finalSystemTemp > 23) || (finalSystemOccupancy > 30)) { 
        fan_speed = 50;
        lighting_state = 1;
        strip.fill(strip.Color(255, 147, 41), 0, LED_COUNT); 
      } 
      else {
        fan_speed = 0;
        lighting_state = 0;
        strip.clear();
      }
    } 
    else if (campus_mode == "ALL_ON") {
      fan_speed = 100;
      lighting_state = 1;
      strip.fill(strip.Color(255, 147, 41), 0, LED_COUNT); 
    }

    // Process AI Pre-Cooling Request
    if (aiSpikePredicted && (millis() - aiSpikeReceivedTime < aiSpikeHoldTime)) {
      fan_speed = 100;
      lighting_state = 1;
    }

    controlSupplyFanSpeed();
    strip.show();
  }

  // 3) TELEMETRY SEND LOGIC
  bool timeToSend = (millis() - lastSend >= sendInterval);
  bool tempChanged = abs(finalSystemTemp - lastTemp) > 1;
  bool occChanged = abs(finalSystemOccupancy - lastOcc) > 5;
  bool fanChanged = (fan_speed != lastFan);

  if (timeToSend || tempChanged || occChanged || fanChanged || fireDetected) {
    /* sendUplink(
      (uint16_t)finalSystemTemp, (uint16_t)finalSystemOccupancy, (uint8_t)fan_speed, 
      (uint8_t)(fireDetected ? 1 : 0), (uint8_t)(lighting_state ? 1 : 0), 
      (uint8_t)(campus_mode == "ALL_ON" ? 1 : 0)
    ); */
    lastSend = millis();
    lastTemp = finalSystemTemp;
    lastOcc = finalSystemOccupancy;
    lastFan = fan_speed;
  }

  checkDownlink();
  delay(200);
}

// ================== SENSOR & CONTROL LOGIC ==================

void checkPotTemp() {
  int currentPotValue = analogRead(TEMP_POT_PIN);
  if (abs(currentPotValue - previousPotValue) > 20) {
    previousPotValue = currentPotValue;
    previousTempPotMillis = currentTempMillis; 
    potOverrideActive = true; 
  }
  if (potOverrideActive) {
    temp_reading_from_pot = currentPotValue * 30.0 / 1023.0 + 20.0;
    if (currentTempMillis - previousTempPotMillis >= 10000) { 
      potOverrideActive = false;
    }
  }
}

void checkDHTTemp() {
  if (currentTempMillis - previousTempMillis >= 200) {
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h) && !isnan(t)) {
      temp_reading_from_dht = dht.computeHeatIndex(t, h, false); 
    }
    previousTempMillis = currentTempMillis;
  }
}

void getTempReading() {
  currentTempMillis = millis(); 
  checkPotTemp();
  checkDHTTemp();

  if (!potOverrideActive) {
    finalSystemTemp = temp_reading_from_dht;
  } else {
    finalSystemTemp = temp_reading_from_pot;
  }
}

void detectFireSpike(float currentTemp) {
  unsigned long currentTime = millis();
  float deltaT = currentTemp - lastTemp;
  float deltaTime = (currentTime - lastTempTime) / 1000.0; 

  if (deltaTime > 0) {
    float rate = deltaT / deltaTime; 
    if (rate >= 2.0) { // dT/dt > 2C per second
      fireDetected = true;
      fireActive = true;
      fireStartTime = millis();  
      Serial.println("🔥 ALARM: Thermal Anomaly Detected!");
    } else {
      fireDetected = false;
    }
  }
  lastTemp = currentTemp;
  lastTempTime = currentTime;
}

void checkOccupancy() {
  currentOccMillis = millis();
  int currentPotValue = analogRead(OCC_POT_PIN);
  
  if (abs(currentPotValue - previousOccPotValue) > 20) {
    previousOccPotValue = currentPotValue;
    previousOccMillis = currentOccMillis; 
    occPotOverrideActive = true; 
  }
  if (occPotOverrideActive) {
    simulated_occupancy_from_pot = map(currentPotValue, 0, 1023, 0, 100);
    if (currentOccMillis - previousOccMillis >= 10000) { 
      occPotOverrideActive = false;
    }
  }

  if (!occPotOverrideActive) {
    finalSystemOccupancy = occupancy_DT;
  } else {
    finalSystemOccupancy = simulated_occupancy_from_pot;
  }
}

void controlSupplyFanSpeed() {
  if (abs(fan_speed - prevFanSpeed) > 1) {
    int pwm_val = map(fan_speed, 0, 100, 0, 255);
    analogWrite(FAN_CONTROL_PIN, pwm_val);
    prevFanSpeed = fan_speed;
  }
}

// ================== LORA FUNCTIONS ==================

void joinTTN() {
  if (!modem.begin(EU868)) {
    Serial.println("Failed to start LoRa modem");
    while (1);
  }
  modem.setADR(true);
  Serial.print("Device EUI: ");
  Serial.println(modem.deviceEUI());
  if (!modem.joinOTAA(appEui, appKey)) {
    Serial.println("Join failed!");
    while (1);
  }
  Serial.println("Joined TTN!");
}

void sendUplink(uint16_t temp, uint16_t occ, uint8_t fan, uint8_t fireDetected, uint8_t light, uint8_t campus_mode_bool) {
  uint8_t payload[8];
  payload[0] = (temp >> 8) & 0xFF;
  payload[1] = temp & 0xFF;
  payload[2] = (occ >> 8) & 0xFF;
  payload[3] = occ & 0xFF;
  payload[4] = fan;
  payload[5] = fireDetected;
  payload[6] = light;
  payload[7] = campus_mode_bool;

  modem.beginPacket();
  modem.write(payload, sizeof(payload));
  modem.endPacket(false);
}

void checkDownlink() {
  int packetSize = modem.parsePacket();
  if (packetSize) {
    int spike = modem.read();
    if (spike == 1) {
      aiSpikePredicted = true;
      aiSpikeReceivedTime = millis();
      Serial.println("AI PREDICTION: Initiating Pre-Cooling.");
    }
  }
}