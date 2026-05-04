// ==========================================
// CLASSROOM TWO: DAYLIGHT HARVESTING
// ==========================================

#include <MKRWAN.h>
#include <Adafruit_NeoPixel.h>

// --- PINS & HARDWARE ---
const int LIGHT_SENSOR_PIN = A1;
const int POT_PIN = A2;
const int LIGHT_PIN = 2;
const int CAMPUS_MODE_PIN = 3;
#define LED_PIN 5
#define LED_COUNT 38 

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// --- DAYLIGHT THRESHOLDS ---
const int THRESH_BRIGHT = 800; // Above this, light is OFF
const int THRESH_DARK = 300;   // Below this, light is 100% ON

// --- SYSTEM STATE ---
bool classActiveOverride = true;
bool CSS = true;
String campus_mode = "AUTO";

// --- OVERRIDE SETTINGS ---
int lastPotValue = 0;
unsigned long potOverrideTime = 0;
const unsigned long overrideDuration = 10000;

// --- LoRaWAN & TTN ---
LoRaModem modem;
String appEui = "0000000000000000"; 
String appKey = "6674A7892D932A3976CD116FE4D6F601"; 

unsigned long lastSend = 0;
const unsigned long sendInterval = 60000; 
bool lastSentOverride = 0;
bool lastSentCSS = 0;
int lastSentBrightness = 0;

void setup() {
  Serial.begin(115200);
  
  pinMode(LIGHT_PIN, OUTPUT);
  pinMode(CAMPUS_MODE_PIN, INPUT);

  strip.begin();           
  strip.setBrightness(20); 
  strip.clear();
  strip.show();            

  // joinTTN(); // Uncomment to enable LoRa
  Serial.println("Classroom 2 Node Initialized");
}

void loop() {
  int ambientLux = analogRead(LIGHT_SENSOR_PIN);
  int potValue = analogRead(POT_PIN);
  int activeLux = ambientLux;
  int LED_Intensity = 0;

  int campus_pin_switch = digitalRead(CAMPUS_MODE_PIN);
  if (campus_pin_switch) {
    campus_mode = "ALL_ON"; 
  } else {
    campus_mode = "AUTO";
  }

  // 1) MANUAL OVERRIDE LOGIC
  if (abs(potValue - lastPotValue) > 100) {
    potOverrideTime = millis();
    lastPotValue = potValue;
  }
  bool overrideActive = (millis() - potOverrideTime < overrideDuration);
  if (overrideActive) {
    activeLux = potValue;
  }

  // 2) LIGHTING CONTROL LOGIC
  if (campus_mode == "ALL_ON") {
    LED_Intensity = 255;
    analogWrite(LIGHT_PIN, LED_Intensity);
    strip.fill(strip.Color(255, 147, 41), 0, LED_COUNT); 
  } 
  else if (campus_mode == "AUTO") { 
    if (!classActiveOverride) { 
      LED_Intensity = 0;
      analogWrite(LIGHT_PIN, LED_Intensity);
      strip.clear();
    } 
    else { 
      // Proportional Ambient Dimming
      if (activeLux >= THRESH_BRIGHT) {
        LED_Intensity = 0;
        analogWrite(LIGHT_PIN, LED_Intensity);
        strip.clear();
      } else if (activeLux <= THRESH_DARK) {
        LED_Intensity = 255;
        analogWrite(LIGHT_PIN, LED_Intensity);
        strip.fill(strip.Color(255, 147, 41), 0, LED_COUNT); 
      } else {
        LED_Intensity = map(activeLux, THRESH_DARK, THRESH_BRIGHT, 255, 0);
        analogWrite(LIGHT_PIN, LED_Intensity);
        strip.fill(strip.Color(255, 147, 41), 0, LED_COUNT); 
      }
    }
  }

  strip.setBrightness(LED_Intensity); 
  strip.show();

  // --- TELEMETRY SEND RULES ---
  bool timeToSend = (millis() - lastSend >= sendInterval);
  bool overrideChanged = ((int)overrideActive != lastSentOverride);
  bool cssChanged = ((int)CSS != lastSentCSS);
  bool brightnessBigChange = (abs(LED_Intensity - lastSentBrightness) >= 15);

  if (timeToSend || overrideChanged || cssChanged || brightnessBigChange) {
    // sendUplink((uint16_t)ambientLux, (uint16_t)potValue, (uint16_t)activeLux, (uint8_t)LED_Intensity, (uint8_t)(overrideActive ? 1 : 0), (uint8_t)(CSS ? 1 : 0));
    
    lastSend = millis();
    lastSentBrightness = LED_Intensity;
    lastSentOverride = overrideActive ? 1 : 0;
    lastSentCSS = CSS ? 1 : 0;
  }

  delay(500);
}

// ================== HELPER FUNCTIONS ==================

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

void sendUplink(uint16_t ambient, uint16_t pot, uint16_t active, uint8_t LED_Intensity, uint8_t overrideOn, uint8_t cssOn) {
  uint8_t payload[9];
  payload[0] = (ambient >> 8) & 0xFF;
  payload[1] = (ambient) & 0xFF;
  payload[2] = (pot >> 8) & 0xFF;
  payload[3] = (pot) & 0xFF;
  payload[4] = (active >> 8) & 0xFF;
  payload[5] = (active) & 0xFF;
  payload[6] = LED_Intensity;
  payload[7] = overrideOn;
  payload[8] = cssOn;

  modem.beginPacket();
  modem.write(payload, sizeof(payload));
  int err = modem.endPacket(false);

  Serial.print("Uplink -> Lux: "); Serial.print(ambient);
  Serial.print(" | LED: "); Serial.print(LED_Intensity);
  Serial.println(err ? " | SUCCESS" : " | FAIL");
}

void checkClassDownlink() {
  if (modem.available()) {
    int classActive = modem.read();
    classActiveOverride = (classActive == 1);
  }
}