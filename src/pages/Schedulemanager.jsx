import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

// ── Firebase config ───────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBzxApxrpX1C9xGLRpHKanGQMMjOrbVFnM",
  authDomain: "twinergy-c8145.firebaseapp.com",
  databaseURL: "https://twinergy-c8145-default-rtdb.firebaseio.com",
  projectId: "twinergy-c8145",
  storageBucket: "twinergy-c8145.firebasestorage.app",
  messagingSenderId: "255963355265",
  appId: "1:255963355265:web:8f6936e0db382a98105580"
};

if (!getApps().length) initializeApp(FIREBASE_CONFIG);
const db = getDatabase();

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROOM_MAP = {
  "classroom-1": "classroom-1", "classroom1": "classroom-1", "c106": "classroom-1",
  "classroom-2": "classroom-2", "classroom2": "classroom-2", "c109": "classroom-2",
  "lecture-hall": "lecture-hall", "lecturehall": "lecture-hall", "b004": "lecture-hall",
};

const DAY_MAP = {
  M: 1, MON: 1, MONDAY: 1,
  T: 2, TUE: 2, TUESDAY: 2,
  W: 3, WED: 3, WEDNESDAY: 3,
  R: 4, THU: 4, THURSDAY: 4,
  F: 5, FRI: 5, FRIDAY: 5,
};

const DAY_PATTERNS = {
  MWF: [1, 3, 5], TR: [2, 4], MW: [1, 3],
  MTR: [1, 2, 4], MTWRF: [1, 2, 3, 4, 5],
};

function parseDays(raw) {
  if (!raw) return [];
  const up = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (DAY_PATTERNS[up]) return DAY_PATTERNS[up];
  return up.split("").map(c => DAY_MAP[c]).filter(Boolean);
}

function parseTime(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{3,4}$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
  return null;
}

function normaliseRoom(raw) {
  if (!raw) return null;
  return ROOM_MAP[String(raw).trim().toLowerCase().replace(/\s+/g, "")] || null;
}

function parseSheet(rows) {
  let headerIdx = -1, headers = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map(c => String(c || "").toLowerCase().trim());
    if (row.some(c => c.includes("room")) && row.some(c => c.includes("day"))) {
      headerIdx = i; headers = row; break;
    }
  }
  if (headerIdx === -1) return { slots: [], errors: ["Could not find header row with 'Room' and 'Days' columns"] };

  const col = name => headers.findIndex(h => h.includes(name));
  const iRoom = col("room"), iDays = col("day"), iStart = col("start"), iEnd = col("end");
  const iCourse = col("course") !== -1 ? col("course") : col("subject");

  if (iRoom === -1 || iDays === -1 || iStart === -1 || iEnd === -1)
    return { slots: [], errors: ["Missing required columns: Room, Days, Start Time, End Time"] };

  const slots = [], errors = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c)) continue;
    const roomId = normaliseRoom(row[iRoom]);
    const days   = parseDays(row[iDays]);
    const start  = parseTime(row[iStart]);
    const end    = parseTime(row[iEnd]);
    const course = iCourse !== -1 ? String(row[iCourse] || "").trim() : "";
    if (!roomId) { errors.push(`Row ${i + 1}: unknown room "${row[iRoom]}"`); continue; }
    if (!days.length) { errors.push(`Row ${i + 1}: could not parse days "${row[iDays]}"`); continue; }
    if (start === null) { errors.push(`Row ${i + 1}: bad start time "${row[iStart]}"`); continue; }
    if (end === null)   { errors.push(`Row ${i + 1}: bad end time "${row[iEnd]}"`); continue; }
    for (const day of days) slots.push({ roomId, day, start, end, course });
  }
  return { slots, errors };
}

function groupByRoom(slots) {
  const rooms = {};
  slots.forEach((s) => {
    if (!rooms[s.roomId]) rooms[s.roomId] = [];
    rooms[s.roomId].push({ day: s.day, start: s.start, end: s.end, course: s.course });
  });
  return rooms;
}

function fmtTime(hhmm) {
  const h = Math.floor(hhmm / 100), m = hhmm % 100;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const DAY_NAMES   = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];
const ROOM_LABELS = { "classroom-1": "Classroom 1", "classroom-2": "Classroom 2", "lecture-hall": "Lecture Hall" };

// ── Component ─────────────────────────────────────────────────────────────────
export default function ScheduleManager() {
  const [dragging,  setDragging]  = useState(false);
  const [fileName,  setFileName]  = useState(null);
  const [slots,     setSlots]     = useState([]);
  const [errors,    setErrors]    = useState([]);
  const [status,    setStatus]    = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const processFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name); setStatus(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const { slots: parsed, errors: errs } = parseSheet(rows);
        setSlots(parsed); setErrors(errs);
        if (!parsed.length && !errs.length) setErrors(["No valid rows found."]);
      } catch (err) { setErrors([`Could not read file: ${err.message}`]); setSlots([]); }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleUpload = async () => {
    if (!slots.length) return;
    setUploading(true);
    setStatus({ type: "loading", msg: "Writing to Firebase..." });
    try {
      const grouped = groupByRoom(slots);
      for (const [roomId, roomSlots] of Object.entries(grouped)) {
        const slotsObj = {};
        roomSlots.forEach((s, i) => {
          slotsObj[`slot_${i}`] = { day: s.day, start: s.start, end: s.end, course: s.course };
        });
        await set(ref(db, `schedule/${roomId}/slots`), slotsObj);
      }
      setStatus({ type: "success", msg: `Done — ${slots.length} slots pushed across ${Object.keys(grouped).length} rooms. predict.py will pick this up on the next cycle.` });
    } catch (err) {
      setStatus({ type: "error", msg: `Firebase error: ${err.message}` });
    } finally { setUploading(false); }
  };

  const handleReset = () => {
    setSlots([]); setErrors([]); setFileName(null); setStatus(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const grouped = groupByRoom(slots);

  return (
    <div style={{ padding: "24px", maxWidth: 820 }}>

      {/* Sub-header */}
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 28, lineHeight: 1.6 }}>
        Upload a timetable Excel file. Slots are written to Firebase under{" "}
        <code style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "1px 6px", borderRadius: 4, fontSize: 12, color: "#475569" }}>
          schedule/&#123;roomId&#125;/slots
        </code>
        . predict.py reads this automatically on every cycle.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#3b82f6" : "#e2e8f0"}`,
          borderRadius: 12,
          padding: "40px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "#eff6ff" : "#fafafa",
          transition: "all 0.2s",
          marginBottom: 20,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files[0]; if (f) processFile(f); }}
        />

        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "#eff6ff", border: "1px solid #bfdbfe",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px",
        }}>
          <svg width="18" height="18" fill="none" stroke="#3b82f6" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12M8 8l4-4 4 4"/>
          </svg>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
          {fileName ? fileName : "Drop your Excel schedule here"}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {fileName ? `${slots.length} slots parsed` : "or click to browse  ·  .xlsx  .xls  .csv"}
        </div>
      </div>

      {/* Parse warnings */}
      {errors.length > 0 && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 8, padding: "12px 16px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#dc2626", marginBottom: 8, fontWeight: 600 }}>
            Parse warnings ({errors.length})
          </div>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#b91c1c", fontFamily: "monospace", marginBottom: 2 }}>— {e}</div>
          ))}
        </div>
      )}

      {/* Preview */}
      {slots.length > 0 && (
        <>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 14, fontWeight: 600 }}>
            Preview — {slots.length} slots parsed
          </div>

          {Object.entries(grouped).map(([roomId, roomSlots]) => (
            <div key={roomId} style={{ marginBottom: 14, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              {/* Room header */}
              <div style={{ background: "#f8fafc", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                  {ROOM_LABELS[roomId] || roomId}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                  {roomSlots.length} slots
                </span>
              </div>

              {/* Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Day", "Start", "End", "Course"].map(h => (
                      <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid #f1f5f9" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roomSlots.map((s, i) => (
                    <tr key={i} style={{ borderBottom: i < roomSlots.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "9px 16px", fontSize: 12, fontFamily: "monospace", color: "#2563eb", fontWeight: 500 }}>{DAY_NAMES[s.day]}</td>
                      <td style={{ padding: "9px 16px", fontSize: 12, fontFamily: "monospace", color: "#64748b" }}>{fmtTime(s.start)}</td>
                      <td style={{ padding: "9px 16px", fontSize: 12, fontFamily: "monospace", color: "#64748b" }}>{fmtTime(s.end)}</td>
                      <td style={{ padding: "9px 16px", fontSize: 13, color: "#1e293b" }}>{s.course || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: uploading ? "#93c5fd" : "#2563eb",
                color: "#fff", border: "none", borderRadius: 8,
                padding: "10px 22px", fontSize: 14, fontWeight: 600,
                cursor: uploading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {uploading ? "Uploading..." : "Push to Firebase"}
            </button>
            <button
              onClick={handleReset}
              style={{
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
                padding: "10px 18px", fontSize: 14, color: "#64748b", cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </>
      )}

      {/* Status message */}
      {status && (
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 8, fontSize: 13, fontFamily: "monospace",
          background: status.type === "success" ? "#f0fdf4" : status.type === "error" ? "#fef2f2" : "#eff6ff",
          border: `1px solid ${status.type === "success" ? "#bbf7d0" : status.type === "error" ? "#fecaca" : "#bfdbfe"}`,
          color: status.type === "success" ? "#15803d" : status.type === "error" ? "#dc2626" : "#1d4ed8",
        }}>
          {status.msg}
        </div>
      )}
    </div>
  );
}
