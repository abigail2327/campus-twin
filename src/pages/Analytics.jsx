import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import Icon from '../components/panels/Icon';
import { exportEnergyData, exportFullReport } from '../services/exportService';

// ─────────────────────────────────────────────────────────────────────────────
// SYNTHETIC DATA — computed from 235,881 rows across 9 rooms (Sept–Dec 2025)
// Phase 3: replace with Firebase onValue() subscriptions — components unchanged
// ─────────────────────────────────────────────────────────────────────────────

// Temperature readings: Sept 15 2025, every 30 min, all 9 rooms
const RAW_TEMP_DATA = [
    {timestamp:'2025-09-15T00:00:00',room:'Classroom_1',temperature_c:23.43,co2_ppm:416.8,occupancy_pct:2.1,humidity_pct:49.3,power_w:13.6},
    {timestamp:'2025-09-15T00:00:00',room:'Classroom_2',temperature_c:22.97,co2_ppm:411.2,occupancy_pct:1.8,humidity_pct:47.1,power_w:14.1},
    {timestamp:'2025-09-15T00:00:00',room:'Computer_Lab',temperature_c:24.21,co2_ppm:398.4,occupancy_pct:1.2,humidity_pct:45.9,power_w:464.2},
    {timestamp:'2025-09-15T00:00:00',room:'Large_Lecture_Hall',temperature_c:23.78,co2_ppm:422.1,occupancy_pct:0.9,humidity_pct:51.2,power_w:18.4},
    {timestamp:'2025-09-15T00:00:00',room:'Lobby_Reception',temperature_c:22.52,co2_ppm:407.7,occupancy_pct:0.0,humidity_pct:48.3,power_w:43.6},
    {timestamp:'2025-09-15T00:00:00',room:'Lounge_Study',temperature_c:23.11,co2_ppm:414.3,occupancy_pct:1.4,humidity_pct:50.1,power_w:22.8},
    {timestamp:'2025-09-15T00:00:00',room:'Faculty_Office',temperature_c:22.88,co2_ppm:401.5,occupancy_pct:1.2,humidity_pct:49.7,power_w:6.4},
    {timestamp:'2025-09-15T00:00:00',room:'Mechanical_Room',temperature_c:25.31,co2_ppm:388.2,occupancy_pct:1.3,humidity_pct:36.4,power_w:312.1},
    {timestamp:'2025-09-15T00:00:00',room:'Electrical_Room',temperature_c:24.65,co2_ppm:398.1,occupancy_pct:7.2,humidity_pct:49.9,power_w:133.2},
    {timestamp:'2025-09-15T00:30:00',room:'Classroom_1',temperature_c:23.51,co2_ppm:418.2,occupancy_pct:2.0,humidity_pct:49.1,power_w:13.8},
    {timestamp:'2025-09-15T00:30:00',room:'Classroom_2',temperature_c:23.04,co2_ppm:413.0,occupancy_pct:1.9,humidity_pct:47.5,power_w:14.7},
    {timestamp:'2025-09-15T00:30:00',room:'Computer_Lab',temperature_c:24.42,co2_ppm:399.1,occupancy_pct:0.5,humidity_pct:45.8,power_w:465.1},
    {timestamp:'2025-09-15T00:30:00',room:'Large_Lecture_Hall',temperature_c:23.91,co2_ppm:424.3,occupancy_pct:0.9,humidity_pct:51.4,power_w:18.2},
    {timestamp:'2025-09-15T00:30:00',room:'Lobby_Reception',temperature_c:22.61,co2_ppm:408.9,occupancy_pct:0.0,humidity_pct:48.5,power_w:44.1},
    {timestamp:'2025-09-15T06:00:00',room:'Classroom_1',temperature_c:23.21,co2_ppm:420.1,occupancy_pct:1.3,humidity_pct:49.8,power_w:13.2},
    {timestamp:'2025-09-15T06:00:00',room:'Classroom_2',temperature_c:22.84,co2_ppm:415.7,occupancy_pct:1.4,humidity_pct:47.9,power_w:14.4},
    {timestamp:'2025-09-15T06:00:00',room:'Computer_Lab',temperature_c:23.98,co2_ppm:401.2,occupancy_pct:1.3,humidity_pct:46.2,power_w:462.8},
    {timestamp:'2025-09-15T06:00:00',room:'Large_Lecture_Hall',temperature_c:23.54,co2_ppm:426.8,occupancy_pct:1.3,humidity_pct:51.8,power_w:17.9},
    {timestamp:'2025-09-15T07:00:00',room:'Classroom_1',temperature_c:23.11,co2_ppm:419.3,occupancy_pct:1.3,humidity_pct:49.6,power_w:13.1},
    {timestamp:'2025-09-15T07:00:00',room:'Lobby_Reception',temperature_c:22.88,co2_ppm:421.4,occupancy_pct:10.5,humidity_pct:48.9,power_w:52.3},
    {timestamp:'2025-09-15T07:30:00',room:'Lobby_Reception',temperature_c:23.12,co2_ppm:438.7,occupancy_pct:18.4,humidity_pct:49.2,power_w:58.1},
    {timestamp:'2025-09-15T08:00:00',room:'Classroom_1',temperature_c:23.62,co2_ppm:512.4,occupancy_pct:60.3,humidity_pct:52.1,power_w:28.4},
    {timestamp:'2025-09-15T08:00:00',room:'Classroom_2',temperature_c:23.31,co2_ppm:489.2,occupancy_pct:7.4,humidity_pct:49.8,power_w:22.1},
    {timestamp:'2025-09-15T08:00:00',room:'Computer_Lab',temperature_c:24.11,co2_ppm:498.7,occupancy_pct:7.2,humidity_pct:47.3,power_w:892.4},
    {timestamp:'2025-09-15T08:00:00',room:'Large_Lecture_Hall',temperature_c:24.21,co2_ppm:531.2,occupancy_pct:7.2,humidity_pct:53.4,power_w:42.8},
    {timestamp:'2025-09-15T08:00:00',room:'Lobby_Reception',temperature_c:23.44,co2_ppm:462.3,occupancy_pct:51.1,humidity_pct:50.1,power_w:71.2},
    {timestamp:'2025-09-15T08:00:00',room:'Lounge_Study',temperature_c:23.52,co2_ppm:487.4,occupancy_pct:34.5,humidity_pct:51.8,power_w:48.1},
    {timestamp:'2025-09-15T08:30:00',room:'Classroom_1',temperature_c:24.18,co2_ppm:648.2,occupancy_pct:83.7,humidity_pct:56.2,power_w:48.2},
    {timestamp:'2025-09-15T08:30:00',room:'Classroom_2',temperature_c:23.88,co2_ppm:621.4,occupancy_pct:63.1,humidity_pct:53.2,power_w:38.7},
    {timestamp:'2025-09-15T08:30:00',room:'Computer_Lab',temperature_c:24.72,co2_ppm:712.3,occupancy_pct:63.0,humidity_pct:49.4,power_w:2841.2},
    {timestamp:'2025-09-15T08:30:00',room:'Large_Lecture_Hall',temperature_c:24.84,co2_ppm:689.4,occupancy_pct:63.2,humidity_pct:57.1,power_w:88.4},
    {timestamp:'2025-09-15T08:30:00',room:'Lobby_Reception',temperature_c:23.71,co2_ppm:498.1,occupancy_pct:16.7,humidity_pct:51.4,power_w:62.4},
    {timestamp:'2025-09-15T08:30:00',room:'Faculty_Office',temperature_c:23.42,co2_ppm:598.3,occupancy_pct:63.1,humidity_pct:52.8,power_w:18.2},
    {timestamp:'2025-09-15T09:00:00',room:'Classroom_1',temperature_c:24.41,co2_ppm:724.1,occupancy_pct:7.2,humidity_pct:54.8,power_w:22.1},
    {timestamp:'2025-09-15T09:00:00',room:'Classroom_2',temperature_c:24.12,co2_ppm:698.7,occupancy_pct:87.7,humidity_pct:57.4,power_w:52.8},
    {timestamp:'2025-09-15T09:00:00',room:'Computer_Lab',temperature_c:25.14,co2_ppm:841.2,occupancy_pct:68.3,humidity_pct:51.2,power_w:4821.3},
    {timestamp:'2025-09-15T09:00:00',room:'Large_Lecture_Hall',temperature_c:25.31,co2_ppm:812.4,occupancy_pct:36.6,humidity_pct:59.2,power_w:68.2},
    {timestamp:'2025-09-15T09:00:00',room:'Lounge_Study',temperature_c:24.11,co2_ppm:612.8,occupancy_pct:46.1,humidity_pct:54.2,power_w:61.4},
    {timestamp:'2025-09-15T09:00:00',room:'Faculty_Office',temperature_c:23.81,co2_ppm:724.2,occupancy_pct:71.1,humidity_pct:54.1,power_w:24.8},
    {timestamp:'2025-09-15T09:30:00',room:'Classroom_1',temperature_c:24.62,co2_ppm:748.2,occupancy_pct:63.1,humidity_pct:57.2,power_w:38.4},
    {timestamp:'2025-09-15T09:30:00',room:'Classroom_2',temperature_c:24.31,co2_ppm:712.4,occupancy_pct:36.4,humidity_pct:55.8,power_w:32.1},
    {timestamp:'2025-09-15T09:30:00',room:'Computer_Lab',temperature_c:25.48,co2_ppm:921.3,occupancy_pct:7.4,humidity_pct:52.8,power_w:1241.2},
    {timestamp:'2025-09-15T10:00:00',room:'Classroom_1',temperature_c:24.82,co2_ppm:761.4,occupancy_pct:87.6,humidity_pct:59.1,power_w:54.2},
    {timestamp:'2025-09-15T10:00:00',room:'Classroom_2',temperature_c:24.52,co2_ppm:728.9,occupancy_pct:50.3,humidity_pct:57.2,power_w:41.8},
    {timestamp:'2025-09-15T10:00:00',room:'Computer_Lab',temperature_c:25.82,co2_ppm:1024.7,occupancy_pct:60.4,humidity_pct:54.1,power_w:3812.4},
    {timestamp:'2025-09-15T10:00:00',room:'Large_Lecture_Hall',temperature_c:25.71,co2_ppm:948.2,occupancy_pct:63.1,humidity_pct:61.4,power_w:92.4},
    {timestamp:'2025-09-15T10:00:00',room:'Lounge_Study',temperature_c:24.48,co2_ppm:682.4,occupancy_pct:51.7,humidity_pct:56.4,power_w:72.8},
    {timestamp:'2025-09-15T10:00:00',room:'Faculty_Office',temperature_c:24.21,co2_ppm:812.4,occupancy_pct:68.4,humidity_pct:55.8,power_w:28.2},
    {timestamp:'2025-09-15T10:30:00',room:'Classroom_1',temperature_c:25.01,co2_ppm:742.8,occupancy_pct:50.2,humidity_pct:58.4,power_w:42.4},
    {timestamp:'2025-09-15T10:30:00',room:'Classroom_2',temperature_c:24.72,co2_ppm:714.3,occupancy_pct:87.5,humidity_pct:58.9,power_w:54.1},
    {timestamp:'2025-09-15T11:00:00',room:'Classroom_1',temperature_c:24.84,co2_ppm:698.1,occupancy_pct:9.4,humidity_pct:56.8,power_w:22.8},
    {timestamp:'2025-09-15T11:00:00',room:'Classroom_2',temperature_c:24.51,co2_ppm:681.4,occupancy_pct:87.5,humidity_pct:58.2,power_w:52.4},
    {timestamp:'2025-09-15T11:00:00',room:'Computer_Lab',temperature_c:25.64,co2_ppm:912.8,occupancy_pct:83.9,humidity_pct:53.9,power_w:6214.8},
    {timestamp:'2025-09-15T11:00:00',room:'Large_Lecture_Hall',temperature_c:25.54,co2_ppm:898.4,occupancy_pct:63.1,humidity_pct:62.8,power_w:88.1},
    {timestamp:'2025-09-15T11:30:00',room:'Classroom_1',temperature_c:24.71,co2_ppm:674.2,occupancy_pct:87.7,humidity_pct:57.4,power_w:52.8},
    {timestamp:'2025-09-15T11:30:00',room:'Classroom_2',temperature_c:24.38,co2_ppm:642.8,occupancy_pct:50.4,humidity_pct:57.4,power_w:42.1},
    {timestamp:'2025-09-15T12:00:00',room:'Classroom_1',temperature_c:24.44,co2_ppm:618.3,occupancy_pct:7.3,humidity_pct:55.9,power_w:18.4},
    {timestamp:'2025-09-15T12:00:00',room:'Classroom_2',temperature_c:24.12,co2_ppm:598.4,occupancy_pct:7.3,humidity_pct:56.2,power_w:18.2},
    {timestamp:'2025-09-15T12:00:00',room:'Computer_Lab',temperature_c:25.31,co2_ppm:824.7,occupancy_pct:7.4,humidity_pct:52.8,power_w:1842.1},
    {timestamp:'2025-09-15T12:00:00',room:'Large_Lecture_Hall',temperature_c:25.21,co2_ppm:812.4,occupancy_pct:7.1,humidity_pct:61.4,power_w:42.8},
    {timestamp:'2025-09-15T12:00:00',room:'Lounge_Study',temperature_c:24.82,co2_ppm:712.8,occupancy_pct:51.7,humidity_pct:57.8,power_w:78.4},
    {timestamp:'2025-09-15T13:00:00',room:'Classroom_1',temperature_c:24.84,co2_ppm:698.4,occupancy_pct:87.7,humidity_pct:58.4,power_w:54.2},
    {timestamp:'2025-09-15T13:00:00',room:'Classroom_2',temperature_c:24.48,co2_ppm:672.8,occupancy_pct:63.0,humidity_pct:57.8,power_w:42.8},
    {timestamp:'2025-09-15T13:00:00',room:'Computer_Lab',temperature_c:25.71,co2_ppm:1124.8,occupancy_pct:63.0,humidity_pct:54.2,power_w:5824.4},
    {timestamp:'2025-09-15T13:30:00',room:'Classroom_1',temperature_c:25.08,co2_ppm:718.2,occupancy_pct:50.3,humidity_pct:59.1,power_w:42.8},
    {timestamp:'2025-09-15T13:30:00',room:'Classroom_2',temperature_c:24.72,co2_ppm:684.2,occupancy_pct:87.5,humidity_pct:59.4,power_w:54.1},
    {timestamp:'2025-09-15T14:00:00',room:'Classroom_1',temperature_c:25.18,co2_ppm:724.8,occupancy_pct:87.7,humidity_pct:60.2,power_w:54.8},
    {timestamp:'2025-09-15T14:00:00',room:'Classroom_2',temperature_c:24.88,co2_ppm:698.4,occupancy_pct:9.5,humidity_pct:59.8,power_w:22.1},
    {timestamp:'2025-09-15T14:00:00',room:'Computer_Lab',temperature_c:25.91,co2_ppm:1198.2,occupancy_pct:71.1,humidity_pct:54.9,power_w:8241.4},
    {timestamp:'2025-09-15T14:00:00',room:'Large_Lecture_Hall',temperature_c:25.84,co2_ppm:1042.8,occupancy_pct:68.4,humidity_pct:63.8,power_w:112.4},
    {timestamp:'2025-09-15T14:00:00',room:'Faculty_Office',temperature_c:24.54,co2_ppm:898.4,occupancy_pct:98.8,humidity_pct:57.4,power_w:34.2},
    {timestamp:'2025-09-15T14:30:00',room:'Classroom_1',temperature_c:25.04,co2_ppm:712.1,occupancy_pct:42.5,humidity_pct:59.8,power_w:38.4},
    {timestamp:'2025-09-15T14:30:00',room:'Classroom_2',temperature_c:24.71,co2_ppm:682.4,occupancy_pct:87.5,humidity_pct:59.2,power_w:54.2},
    {timestamp:'2025-09-15T15:00:00',room:'Classroom_1',temperature_c:25.28,co2_ppm:742.8,occupancy_pct:95.0,humidity_pct:61.2,power_w:62.4},
    {timestamp:'2025-09-15T15:00:00',room:'Classroom_2',temperature_c:24.94,co2_ppm:718.4,occupancy_pct:87.5,humidity_pct:60.4,power_w:54.8},
    {timestamp:'2025-09-15T15:00:00',room:'Computer_Lab',temperature_c:26.14,co2_ppm:1284.7,occupancy_pct:68.4,humidity_pct:55.8,power_w:9184.2},
    {timestamp:'2025-09-15T15:00:00',room:'Large_Lecture_Hall',temperature_c:26.02,co2_ppm:1124.8,occupancy_pct:95.1,humidity_pct:64.8,power_w:148.2},
    {timestamp:'2025-09-15T15:30:00',room:'Classroom_1',temperature_c:25.12,co2_ppm:728.4,occupancy_pct:50.3,humidity_pct:60.8,power_w:42.8},
    {timestamp:'2025-09-15T15:30:00',room:'Classroom_2',temperature_c:24.81,co2_ppm:702.8,occupancy_pct:50.3,humidity_pct:59.8,power_w:42.4},
    {timestamp:'2025-09-15T16:00:00',room:'Classroom_1',temperature_c:25.44,co2_ppm:762.4,occupancy_pct:68.5,humidity_pct:61.8,power_w:54.2},
    {timestamp:'2025-09-15T16:00:00',room:'Classroom_2',temperature_c:25.11,co2_ppm:738.2,occupancy_pct:63.2,humidity_pct:60.8,power_w:48.4},
    {timestamp:'2025-09-15T16:00:00',room:'Computer_Lab',temperature_c:26.28,co2_ppm:1342.8,occupancy_pct:95.0,humidity_pct:56.4,power_w:13248.4},
    {timestamp:'2025-09-15T16:00:00',room:'Large_Lecture_Hall',temperature_c:26.18,co2_ppm:1198.4,occupancy_pct:43.1,humidity_pct:65.4,power_w:88.4},
    {timestamp:'2025-09-15T16:00:00',room:'Lounge_Study',temperature_c:25.14,co2_ppm:812.4,occupancy_pct:41.3,humidity_pct:58.8,power_w:68.4},
    {timestamp:'2025-09-15T16:30:00',room:'Classroom_1',temperature_c:25.08,co2_ppm:724.8,occupancy_pct:9.4,humidity_pct:60.4,power_w:22.8},
    {timestamp:'2025-09-15T16:30:00',room:'Computer_Lab',temperature_c:26.08,co2_ppm:1284.2,occupancy_pct:68.4,humidity_pct:55.9,power_w:8421.4},
    {timestamp:'2025-09-15T17:00:00',room:'Classroom_1',temperature_c:24.74,co2_ppm:668.2,occupancy_pct:7.2,humidity_pct:59.4,power_w:18.4},
    {timestamp:'2025-09-15T17:00:00',room:'Classroom_2',temperature_c:24.44,co2_ppm:641.8,occupancy_pct:36.5,humidity_pct:58.8,power_w:32.4},
    {timestamp:'2025-09-15T17:00:00',room:'Computer_Lab',temperature_c:25.82,co2_ppm:1214.8,occupancy_pct:7.3,humidity_pct:55.2,power_w:1842.4},
    {timestamp:'2025-09-15T17:00:00',room:'Large_Lecture_Hall',temperature_c:25.72,co2_ppm:1048.2,occupancy_pct:68.4,humidity_pct:64.2,power_w:108.4},
    {timestamp:'2025-09-15T17:30:00',room:'Classroom_2',temperature_c:24.18,co2_ppm:614.2,occupancy_pct:87.8,humidity_pct:58.1,power_w:52.8},
    {timestamp:'2025-09-15T17:30:00',room:'Large_Lecture_Hall',temperature_c:25.48,co2_ppm:1012.4,occupancy_pct:95.1,humidity_pct:63.8,power_w:148.2},
    {timestamp:'2025-09-15T18:00:00',room:'Classroom_1',temperature_c:24.24,co2_ppm:598.4,occupancy_pct:1.6,humidity_pct:57.8,power_w:14.2},
    {timestamp:'2025-09-15T18:00:00',room:'Classroom_2',temperature_c:23.94,co2_ppm:572.8,occupancy_pct:1.8,humidity_pct:57.2,power_w:14.8},
    {timestamp:'2025-09-15T18:00:00',room:'Computer_Lab',temperature_c:25.24,co2_ppm:1024.8,occupancy_pct:1.8,humidity_pct:54.2,power_w:462.4},
    {timestamp:'2025-09-15T18:00:00',room:'Large_Lecture_Hall',temperature_c:25.11,co2_ppm:912.4,occupancy_pct:1.8,humidity_pct:62.8,power_w:18.4},
    {timestamp:'2025-09-15T18:00:00',room:'Lounge_Study',temperature_c:24.48,co2_ppm:712.4,occupancy_pct:35.0,humidity_pct:57.8,power_w:58.4},
    {timestamp:'2025-09-15T19:00:00',room:'Classroom_1',temperature_c:23.84,co2_ppm:542.4,occupancy_pct:1.8,humidity_pct:56.4,power_w:13.8},
    {timestamp:'2025-09-15T19:00:00',room:'Classroom_2',temperature_c:23.54,co2_ppm:518.2,occupancy_pct:1.8,humidity_pct:55.8,power_w:14.2},
    {timestamp:'2025-09-15T20:00:00',room:'Classroom_1',temperature_c:23.51,co2_ppm:498.4,occupancy_pct:1.8,humidity_pct:55.2,power_w:13.4},
    {timestamp:'2025-09-15T20:00:00',room:'Classroom_2',temperature_c:23.21,co2_ppm:474.2,occupancy_pct:1.8,humidity_pct:54.4,power_w:13.8},
    {timestamp:'2025-09-15T22:00:00',room:'Classroom_1',temperature_c:23.28,co2_ppm:448.2,occupancy_pct:1.8,humidity_pct:53.8,power_w:13.2},
    {timestamp:'2025-09-15T22:00:00',room:'Classroom_2',temperature_c:22.98,co2_ppm:428.4,occupancy_pct:1.7,humidity_pct:53.1,power_w:14.1},
    {timestamp:'2025-09-15T22:00:00',room:'Computer_Lab',temperature_c:24.52,co2_ppm:432.8,occupancy_pct:1.9,humidity_pct:47.8,power_w:464.8},
    {timestamp:'2025-09-15T23:00:00',room:'Classroom_1',temperature_c:23.14,co2_ppm:432.4,occupancy_pct:1.9,humidity_pct:53.2,power_w:13.1},
    {timestamp:'2025-09-15T23:30:00',room:'Classroom_1',temperature_c:23.02,co2_ppm:421.8,occupancy_pct:1.8,humidity_pct:52.8,power_w:13.0},
    {timestamp:'2025-09-15T23:30:00',room:'Large_Lecture_Hall',temperature_c:23.84,co2_ppm:448.4,occupancy_pct:1.8,humidity_pct:53.4,power_w:18.1},
];

// Energy data: avg daily consumption per room (Wh) computed from 3-month dataset
const ENERGY_DATA = [
    {room:'Classroom_1',       energy_wh:221.2},
    {room:'Classroom_2',       energy_wh:225.5},
    {room:'Computer_Lab',      energy_wh:13408.6},
    {room:'Electrical_Room',   energy_wh:3731.6},
    {room:'Faculty_Office',    energy_wh:77.0},
    {room:'Large_Lecture_Hall',energy_wh:358.8},
    {room:'Lobby_Reception',   energy_wh:594.8},
    {room:'Lounge_Study',      energy_wh:378.0},
    {room:'Mechanical_Room',   energy_wh:4578.6},
];

// Heatmap: avg occupancy % by room × hour (0–23), computed from 235,881 rows
const HEATMAP_DATA = {
    Classroom_1:       [1.3,1.4,1.3,1.4,1.4,1.3,1.3,1.3,60.3,7.2,63.1,36.4,7.3,63.2,36.5,30.9,68.5,7.2,1.6,1.8,1.8,1.8,1.8,1.9],
    Classroom_2:       [1.3,1.4,1.4,1.3,1.4,1.4,1.4,1.4,7.4,63.1,36.4,63.1,36.5,7.3,63.0,36.4,63.2,36.5,1.8,1.8,1.8,1.9,1.7,1.7],
    Computer_Lab:      [1.4,1.3,1.2,1.4,1.3,1.3,1.3,1.4,7.2,63.0,68.3,7.4,60.4,7.1,63.0,71.1,68.4,7.3,1.8,1.8,1.8,1.8,1.9,1.8],
    Electrical_Room:   [3.0,3.0,3.0,2.9,3.0,2.9,2.9,3.0,4.1,4.1,3.9,4.0,4.1,4.1,4.0,3.9,3.9,4.0,3.0,2.9,3.0,2.9,3.0,3.0],
    Faculty_Office:    [1.4,1.3,1.2,1.4,1.3,1.5,1.5,1.4,7.4,63.1,71.1,68.4,7.2,63.1,71.1,71.0,68.5,7.3,1.7,1.7,1.8,1.8,1.8,1.8],
    Large_Lecture_Hall:[1.4,1.3,1.4,1.3,1.3,1.3,1.4,1.3,7.2,63.2,36.6,63.1,36.6,7.1,63.0,68.4,31.3,68.4,1.8,1.9,1.9,1.8,1.8,1.8],
    Lobby_Reception:   [1.4,1.3,1.4,1.4,1.4,1.3,1.4,10.5,51.1,16.7,9.0,8.9,34.3,38.3,9.0,8.9,9.1,9.2,1.7,1.8,1.8,1.8,1.7,1.8],
    Lounge_Study:      [1.4,1.4,1.3,1.4,1.3,1.5,1.4,1.3,34.5,41.0,46.1,49.8,51.7,51.8,49.8,46.4,41.3,35.0,1.7,1.7,1.8,1.7,1.8,1.8],
    Mechanical_Room:   [1.2,1.4,1.4,1.3,1.4,1.3,1.3,1.3,34.4,41.0,45.9,49.7,51.7,51.9,49.9,46.5,41.5,35.2,1.8,1.8,1.9,1.8,1.8,1.8],
};

const ALL_ROOMS = Object.keys(HEATMAP_DATA);

const KPI_SUMMARY = [
    {label:'Total Rooms',      value:'9',      unit:''},
    {label:'Avg Temperature',  value:'23.3',   unit:'°C'},
    {label:'Peak CO₂ Logged', value:'2,334',  unit:'ppm'},
    {label:'Avg Daily Energy', value:'2,627',  unit:'Wh'},
];

// ─────────────────────────────────────────────────────────────────────────────
// D3 CHART COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Shared card wrapper
function Card({ children, className = '' }) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200/80 ${className}`}
             style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05),0 4px 16px rgba(0,0,0,0.04)' }}>
            {children}
        </div>
    );
}

function CardHead({ title, sub, iconName, right }) {
    return (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div className="flex items-center gap-2.5">
                {iconName && <Icon name={iconName} className="w-4 h-4 text-slate-400" />}
                <div>
                    <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                    {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
                </div>
            </div>
            {right}
        </div>
    );
}

// ── Temperature Line Chart ────────────────────────────────────────────────────
function TemperatureChart({ data, room }) {
    const svgRef    = useRef();
    const wrapRef   = useRef();
    const ttRef     = useRef();
    const [width, setWidth] = useState(600);

    // Responsive width
    useEffect(() => {
        const obs = new ResizeObserver(entries => {
            setWidth(entries[0].contentRect.width);
        });
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        if (!data?.length) return;
        const filtered = room
            ? data.filter(d => d.room === room).sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp))
            : data.sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));
        if (!filtered.length) return;

        const svg    = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const height = 240;
        const margin = { top:16, right:16, bottom:48, left:44 };
        const iw = width - margin.left - margin.right;
        const ih = height - margin.top - margin.bottom;

        const g = svg.attr('width', width).attr('height', height)
            .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleTime()
            .domain(d3.extent(filtered, d => new Date(d.timestamp))).range([0, iw]);
        const yScale = d3.scaleLinear().domain([20, 28]).range([ih, 0]);

        // Grid
        g.append('g').attr('opacity', 0.06)
            .call(d3.axisLeft(yScale).tickSize(-iw).tickFormat(''));

        // Comfort band
        g.append('rect')
            .attr('x', 0).attr('y', yScale(25))
            .attr('width', iw).attr('height', yScale(22) - yScale(25))
            .attr('fill', '#2563eb').attr('opacity', 0.05);

        // Threshold lines
        [{val:25,color:'#ef4444',label:'25°C max'},{val:22,color:'#2563eb',label:'22°C min'}].forEach(t => {
            g.append('line')
                .attr('x1',0).attr('x2',iw)
                .attr('y1',yScale(t.val)).attr('y2',yScale(t.val))
                .attr('stroke',t.color).attr('stroke-width',1)
                .attr('stroke-dasharray','4,3').attr('opacity',0.5);
            g.append('text')
                .attr('x',iw-4).attr('y',yScale(t.val)-4)
                .attr('text-anchor','end').attr('font-size',9).attr('fill',t.color)
                .attr('opacity',0.7).text(t.label);
        });

        // Axes
        g.append('g').attr('transform',`translate(0,${ih})`)
            .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%H:%M')))
            .call(ax => { ax.select('.domain').remove(); ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',10); ax.selectAll('.tick line').attr('stroke','#e2e8f0'); });
        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}°`))
            .call(ax => { ax.select('.domain').remove(); ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',10); ax.selectAll('.tick line').attr('stroke','#e2e8f0'); });

        // Line segments colored by threshold
        const line = d3.line()
            .x(d => xScale(new Date(d.timestamp))).y(d => yScale(d.temperature_c))
            .curve(d3.curveMonotoneX);

        for (let i = 0; i < filtered.length - 1; i++) {
            const avg = (filtered[i].temperature_c + filtered[i+1].temperature_c) / 2;
            const color = avg < 22 ? '#3b82f6' : avg > 25 ? '#ef4444' : '#10b981';
            const sw    = avg > 25 ? 2.5 : 1.8;
            g.append('path')
                .datum([filtered[i], filtered[i+1]])
                .attr('fill','none').attr('stroke',color).attr('stroke-width',sw)
                .attr('stroke-linecap','round').attr('d',line);
        }

        // Dots
        const tooltip = d3.select(ttRef.current);
        g.selectAll('.dot').data(filtered).enter().append('circle')
            .attr('cx', d => xScale(new Date(d.timestamp)))
            .attr('cy', d => yScale(d.temperature_c))
            .attr('r', 3)
            .attr('fill', d => d.temperature_c < 22 ? '#3b82f6' : d.temperature_c > 25 ? '#ef4444' : '#10b981')
            .attr('stroke','white').attr('stroke-width',1).attr('opacity',0.8)
            .style('cursor','pointer')
            .on('mouseover', (event, d) => {
                const status = d.temperature_c < 22 ? 'Too Cold' : d.temperature_c > 25 ? 'Too Hot' : 'Optimal';
                const color  = d.temperature_c < 22 ? '#3b82f6' : d.temperature_c > 25 ? '#ef4444' : '#10b981';
                tooltip.style('opacity',1).style('left',(event.offsetX+12)+'px').style('top',(event.offsetY-40)+'px')
                    .html(`<div class="font-bold text-slate-800 text-xs mb-1">${d.room.replace(/_/g,' ')}</div>
            <div class="text-[11px] text-slate-500">${new Date(d.timestamp).toLocaleTimeString('en-AE',{hour:'2-digit',minute:'2-digit'})}</div>
            <div class="text-[11px] mt-1"><span class="font-bold" style="color:${color}">${d.temperature_c.toFixed(1)}°C</span> — ${status}</div>
            <div class="text-[11px] text-slate-400">CO₂: ${d.co2_ppm.toFixed(0)} ppm · Occ: ${d.occupancy_pct.toFixed(0)}%</div>`);
            })
            .on('mouseout', () => tooltip.style('opacity',0));

    }, [data, room, width]);

    return (
        <div ref={wrapRef} className="relative w-full">
            <svg ref={svgRef} className="w-full" />
            <div ref={ttRef}
                 className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-slate-700 opacity-0 transition-opacity z-10"
                 style={{ minWidth:'180px' }} />
        </div>
    );
}

// ── Energy Bar Chart ──────────────────────────────────────────────────────────
function EnergyBarChart({ data }) {
    const svgRef  = useRef();
    const wrapRef = useRef();
    const ttRef   = useRef();
    const [width, setWidth] = useState(600);

    useEffect(() => {
        const obs = new ResizeObserver(e => setWidth(e[0].contentRect.width));
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        if (!data?.length) return;
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const height = 240;
        const margin = { top:12, right:12, bottom:60, left:56 };
        const iw = width - margin.left - margin.right;
        const ih = height - margin.top - margin.bottom;

        const g = svg.attr('width',width).attr('height',height)
            .append('g').attr('transform',`translate(${margin.left},${margin.top})`);

        const COLORS = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#64748b'];

        const xScale = d3.scaleBand()
            .domain(data.map(d => d.room.replace(/_/g,' ').replace('Large Lecture Hall','Lect. Hall')))
            .range([0,iw]).padding(0.25);
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.energy_wh) * 1.1]).range([ih,0]);

        // Grid
        g.append('g').attr('opacity',0.06)
            .call(d3.axisLeft(yScale).tickSize(-iw).tickFormat(''));

        // Axes
        g.append('g').attr('transform',`translate(0,${ih})`)
            .call(d3.axisBottom(xScale))
            .call(ax => {
                ax.select('.domain').remove();
                ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',10)
                    .attr('transform','rotate(-35)').style('text-anchor','end');
                ax.selectAll('.tick line').remove();
            });
        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d>=1000?`${(d/1000).toFixed(1)}k`:d))
            .call(ax => {
                ax.select('.domain').remove();
                ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',10);
                ax.selectAll('.tick line').attr('stroke','#e2e8f0');
            });

        // Y axis label
        g.append('text').attr('transform','rotate(-90)').attr('x',-ih/2).attr('y',-44)
            .attr('text-anchor','middle').attr('fill','#94a3b8').attr('font-size',10).text('Avg Daily Energy (Wh)');

        // Bars with enter animation
        const tooltip = d3.select(ttRef.current);
        g.selectAll('.bar').data(data).enter().append('rect')
            .attr('class','bar')
            .attr('x', d => xScale(d.room.replace(/_/g,' ').replace('Large Lecture Hall','Lect. Hall')))
            .attr('width', xScale.bandwidth()).attr('rx', 3)
            .attr('fill', (d,i) => COLORS[i % COLORS.length])
            .attr('y', ih).attr('height', 0)
            .style('cursor','pointer')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity',0.75);
                tooltip.style('opacity',1).style('left',(event.offsetX+10)+'px').style('top',(event.offsetY-50)+'px')
                    .html(`<div class="font-bold text-slate-800 text-xs mb-1">${d.room.replace(/_/g,' ')}</div>
            <div class="text-[11px] text-slate-500">Daily avg: <span class="font-bold text-slate-800">${d.energy_wh.toLocaleString()} Wh</span></div>
            <div class="text-[11px] text-slate-400">Monthly est: ${(d.energy_wh*30/1000).toFixed(1)} kWh</div>`);
            })
            .on('mouseout', function() { d3.select(this).attr('opacity',1); tooltip.style('opacity',0); })
            .transition().duration(600).ease(d3.easeCubicOut)
            .attr('y', d => yScale(d.energy_wh))
            .attr('height', d => ih - yScale(d.energy_wh));

    }, [data, width]);

    return (
        <div ref={wrapRef} className="relative w-full">
            <svg ref={svgRef} className="w-full" />
            <div ref={ttRef}
                 className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-slate-700 opacity-0 transition-opacity z-10"
                 style={{ minWidth:'180px' }} />
        </div>
    );
}

// ── Occupancy Heatmap ─────────────────────────────────────────────────────────
function OccupancyHeatmap({ data }) {
    const svgRef  = useRef();
    const wrapRef = useRef();
    const ttRef   = useRef();
    const [width, setWidth] = useState(700);

    useEffect(() => {
        const obs = new ResizeObserver(e => setWidth(e[0].contentRect.width));
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        if (!data || !Object.keys(data).length) return;
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const rooms = Object.keys(data);
        const hours = Array.from({length:24},(_,i)=>i);

        const margin = { top:28, right:12, bottom:16, left:128 };
        const iw = width - margin.left - margin.right;
        const cellH = 26;
        const ih = cellH * rooms.length;
        const height = ih + margin.top + margin.bottom;

        const g = svg.attr('width',width).attr('height',height)
            .append('g').attr('transform',`translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleBand().domain(hours).range([0,iw]).padding(0.06);
        const yScale = d3.scaleBand().domain(rooms).range([0,ih]).padding(0.08);

        const colorScale = d3.scaleSequential()
            .domain([0,100])
            .interpolator(d3.interpolateRgb('#f0f9ff','#1d4ed8'));

        // X axis hours
        g.append('g')
            .call(d3.axisTop(xScale).tickValues(hours.filter(h => h%3===0)).tickFormat(d => `${String(d).padStart(2,'0')}:00`))
            .call(ax => { ax.select('.domain').remove(); ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',9); ax.selectAll('.tick line').remove(); });

        // Y axis rooms
        g.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => d.replace(/_/g,' ').replace('Large Lecture Hall','Lect. Hall')))
            .call(ax => { ax.select('.domain').remove(); ax.selectAll('text').attr('fill','#64748b').attr('font-size',10); ax.selectAll('.tick line').remove(); });

        const tooltip = d3.select(ttRef.current);

        rooms.forEach(room => {
            hours.forEach(hour => {
                const val = data[room][hour] ?? 0;
                g.append('rect')
                    .attr('x', xScale(hour)).attr('y', yScale(room))
                    .attr('width', xScale.bandwidth()).attr('height', yScale.bandwidth())
                    .attr('fill', colorScale(val)).attr('rx', 2)
                    .style('cursor','pointer')
                    .on('mouseover', function(event) {
                        d3.select(this).attr('stroke','#2563eb').attr('stroke-width',1.5);
                        tooltip.style('opacity',1).style('left',(event.offsetX+10)+'px').style('top',(event.offsetY-50)+'px')
                            .html(`<div class="font-bold text-slate-800 text-xs mb-1">${room.replace(/_/g,' ')}</div>
                <div class="text-[11px] text-slate-500">${String(hour).padStart(2,'0')}:00 – ${String(hour+1).padStart(2,'0')}:00</div>
                <div class="text-[11px] mt-1">Avg occupancy: <span class="font-bold text-blue-600">${val.toFixed(1)}%</span></div>`);
                    })
                    .on('mouseout', function() { d3.select(this).attr('stroke','none'); tooltip.style('opacity',0); });
            });
        });

        // Gradient legend
        const defs = svg.append('defs');
        const grad = defs.append('linearGradient').attr('id','occ-grad');
        grad.selectAll('stop').data([
            {offset:'0%',color:'#f0f9ff'},{offset:'50%',color:'#93c5fd'},{offset:'100%',color:'#1d4ed8'}
        ]).enter().append('stop').attr('offset',d=>d.offset).attr('stop-color',d=>d.color);

        const legX = iw - 160, legY = -24, legW = 160, legH = 10;
        g.append('rect').attr('x',legX).attr('y',legY).attr('width',legW).attr('height',legH)
            .attr('rx',3).style('fill','url(#occ-grad)');
        ['0%','50%','100%'].forEach((lbl,i) => {
            g.append('text').attr('x',legX+i*(legW/2)).attr('y',legY+legH+10)
                .attr('text-anchor','middle').attr('fill','#94a3b8').attr('font-size',9).text(lbl);
        });
        g.append('text').attr('x',legX+legW/2).attr('y',legY-3)
            .attr('text-anchor','middle').attr('fill','#94a3b8').attr('font-size',9).text('Avg Occupancy');

    }, [data, width]);

    return (
        <div ref={wrapRef} className="relative w-full overflow-x-auto">
            <svg ref={svgRef} className="w-full" />
            <div ref={ttRef}
                 className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-slate-700 opacity-0 transition-opacity z-10"
                 style={{ minWidth:'180px' }} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const REPORT_TYPES = [
    {iconName:'temperature', iconBg:'bg-blue-50',    iconColor:'text-blue-600',    title:'Energy Summary',     desc:'Avg Wh/day per room — all 9 zones',   exportType:'energy'     },
    {iconName:'occupancy',   iconBg:'bg-emerald-50', iconColor:'text-emerald-600', title:'Occupancy Report',   desc:'Hourly patterns — Sept to Dec 2025',   exportType:'occupancy'  },
    {iconName:'alerts',      iconBg:'bg-red-50',     iconColor:'text-red-600',     title:'Incident Log',       desc:'Anomaly flags from synthetic dataset',  exportType:'incidents'  },
    {iconName:'co2',         iconBg:'bg-amber-50',   iconColor:'text-amber-600',   title:'Environmental Data', desc:'Temp, CO₂, humidity — all rooms',      exportType:'environment'},
];

export default function Analytics() {
    const [selectedRoom, setSelectedRoom] = useState('Large_Lecture_Hall');

    const tempForRoom = RAW_TEMP_DATA.filter(d => d.room === selectedRoom)
        .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg font-bold text-slate-900">Analytics & Reports</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Synthetic dataset · 235,881 rows · 9 rooms · Sept–Dec 2025 · 5-min intervals
                    </p>
                </div>
                <button
                    onClick={() => exportFullReport({ rooms:[], alerts:[], kpis:KPI_SUMMARY, label:'full' })}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors shadow-md">
                    <Icon name="download" className="w-3.5 h-3.5" /> Export Report
                </button>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {KPI_SUMMARY.map(k => (
                    <Card key={k.label} className="p-5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{k.label}</p>
                        <p className="text-3xl font-bold text-slate-900" style={{fontFamily:"'DM Mono',monospace"}}>
                            {k.value}<span className="text-base font-normal text-slate-400 ml-1">{k.unit}</span>
                        </p>
                    </Card>
                ))}
            </div>

            {/* Temperature Chart */}
            <Card>
                <CardHead
                    title="Temperature Trend — Sept 15 2025"
                    sub="Threshold coloring: blue < 22°C optimal 22–25°C red > 25°C · hover dots for details"
                    iconName="temperature"
                    right={
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedRoom}
                                onChange={e => setSelectedRoom(e.target.value)}
                                className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all">
                                {ALL_ROOMS.map(r => (
                                    <option key={r} value={r}>{r.replace(/_/g,' ')}</option>
                                ))}
                            </select>
                        </div>
                    }
                />
                <div className="p-5">
                    {/* Legend */}
                    <div className="flex items-center gap-5 mb-4">
                        {[['#3b82f6','Too Cold (< 22°C)'],['#10b981','Optimal (22–25°C)'],['#ef4444','Too Hot (> 25°C)']].map(([color,label]) => (
                            <span key={label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <span className="w-5 h-1.5 rounded-full inline-block" style={{background:color}} /> {label}
              </span>
                        ))}
                    </div>
                    <TemperatureChart data={RAW_TEMP_DATA} room={selectedRoom} />
                    {tempForRoom.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-8">No readings for {selectedRoom.replace(/_/g,' ')} on this date.</p>
                    )}
                </div>
            </Card>

            {/* Energy Bar Chart */}
            <Card>
                <CardHead
                    title="Average Daily Energy Consumption per Room"
                    sub="Computed from 3-month synthetic dataset · cube-law fan modulation applied · hover bars for detail"
                    iconName="zap"
                    right={
                        <button
                            onClick={() => exportEnergyData(
                                { labels: ENERGY_DATA.map(d=>d.room), actual: ENERGY_DATA.map(d=>d.energy_wh), forecast: ENERGY_DATA.map(d=>d.energy_wh) },
                                'all-rooms'
                            )}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 border border-blue-100 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg uppercase tracking-widest transition-all">
                            <Icon name="download" className="w-3 h-3" /> Export CSV
                        </button>
                    }
                />
                <div className="p-5">
                    <EnergyBarChart data={ENERGY_DATA} />
                </div>
            </Card>

            {/* Occupancy Heatmap */}
            <Card>
                <CardHead
                    title="Occupancy Patterns — Room × Hour (Avg across Sept–Dec)"
                    sub="Darker blue = higher occupancy · schedule patterns clearly visible · class sessions at 8am, 10am, 12pm, 2pm, 4pm"
                    iconName="occupancy"
                />
                <div className="p-5">
                    <OccupancyHeatmap data={HEATMAP_DATA} />
                </div>
            </Card>

            {/* Downloadable reports */}
            <Card>
                <CardHead
                    title="Downloadable Reports"
                    iconName="download"
                    right={
                        <button
                            onClick={() => exportFullReport({rooms:[],alerts:[],kpis:KPI_SUMMARY,label:'full'})}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors flex items-center gap-1">
                            <Icon name="plus" className="w-3.5 h-3.5" /> Generate New
                        </button>
                    }
                />
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {REPORT_TYPES.map(r => (
                        <div key={r.title}
                             onClick={() => exportFullReport({rooms:[],alerts:[],kpis:KPI_SUMMARY,label:r.exportType})}
                             className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group">
                            <div className={`w-9 h-9 ${r.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                                <Icon name={r.iconName} className={`w-4 h-4 ${r.iconColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">{r.title}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{r.desc}</p>
                            </div>
                            <Icon name="download" className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                        </div>
                    ))}
                </div>
            </Card>

        </div>
    );
}