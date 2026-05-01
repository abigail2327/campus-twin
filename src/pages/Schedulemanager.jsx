import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

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

const ROOM_LABELS = {
  "classroom-1": "Classroom 1",
  "classroom-2": "Classroom 2",
  "multipurpose-hall": "Multipurpose Hall",
};

function parseSheet(rows) {
  let headerIdx = -1, headers = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map(c => String(c || "").toLowerCase().trim());
    if (row.some(c => c.includes("seconds")) && row.some(c => c.includes("room"))) {
      headerIdx = i; headers = row; break;
    }
  }
  if (headerIdx === -1)
    return { entries: [], errors: ["Could not find header row with 'seconds_from_start' and 'room' columns"] };

  const iSec   = headers.findIndex(h => h.includes("seconds"));
  const iRoom  = headers.findIndex(h => h.includes("room"));
  const iSched = headers.findIndex(h => h.includes("scheduled"));

  if (iSec === -1 || iRoom === -1 || iSched === -1)
    return { entries: [], errors: ["Missing columns: need seconds_from_start, room, scheduled"] };

  const entries = [], errors = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c)) continue;

    const seconds   = parseInt(row[iSec], 10);
    const room      = String(row[iRoom] || "").trim().toLowerCase();
    const scheduled = parseInt(row[iSched], 10);

    if (isNaN(seconds))                       { errors.push(`Row ${i+1}: bad seconds_from_start "${row[iSec]}"`); continue; }
    if (!room)                                { errors.push(`Row ${i+1}: missing room`); continue; }
    if (scheduled !== 0 && scheduled !== 1)   { errors.push(`Row ${i+1}: scheduled must be 0 or 1, got "${row[iSched]}"`); continue; }

    entries.push({ seconds, room, scheduled });
  }
  return { entries, errors };
}

function groupByRoom(entries) {
  const rooms = {};
  entries.forEach(e => {
    if (!rooms[e.room]) rooms[e.room] = [];
    rooms[e.room].push({ seconds: e.seconds, scheduled: e.scheduled });
  });
  return rooms;
}

function fmtSeconds(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function ScheduleManager() {
  const [dragging,  setDragging]  = useState(false);
  const [fileName,  setFileName]  = useState(null);
  const [entries,   setEntries]   = useState([]);
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
        const { entries: parsed, errors: errs } = parseSheet(rows);
        setEntries(parsed); setErrors(errs);
        if (!parsed.length && !errs.length) setErrors(["No valid rows found."]);
      } catch (err) { setErrors([`Could not read file: ${err.message}`]); setEntries([]); }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleUpload = async () => {
    if (!entries.length) return;
    setUploading(true);
    setStatus({ type: "loading", msg: "Writing schedule to Firebase..." });
    try {
      const grouped = groupByRoom(entries);
      for (const [roomId, roomEntries] of Object.entries(grouped)) {
        const slotsObj = {};
        roomEntries.forEach((e, i) => {
          slotsObj[`slot_${i}`] = { seconds_from_start: e.seconds, scheduled: e.scheduled };
        });
        await set(ref(db, `schedule/${roomId}/slots`), slotsObj);
      }
      setStatus({
        type: "success",
        msg: `✅ ${entries.length} entries written across ${Object.keys(grouped).length} rooms.\n` +
             `firebase_sync will push this to the Ditto digital twin within ~3s.\n` +
             `predict.py picks it up on its next 5s cycle.`
      });
    } catch (err) {
      setStatus({ type: "error", msg: `Firebase error: ${err.message}` });
    } finally { setUploading(false); }
  };

  const handleReset = () => {
    setEntries([]); setErrors([]); setFileName(null); setStatus(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const grouped = groupByRoom(entries);

  return (
    <div style={{ padding: "24px", maxWidth: 820 }}>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 28, lineHeight: 1.6 }}>
        Upload a schedule Excel file with{" "}
        <code style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>
          seconds_from_start · room · scheduled
        </code>{" "}
        columns. Entries are written to Firebase → Ditto digital twin → sensors.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#3b82f6" : "#e2e8f0"}`,
          borderRadius: 12, padding: "40px 24px", textAlign: "center",
          cursor: "pointer", background: dragging ? "#eff6ff" : "#fafafa",
          transition: "all 0.2s", marginBottom: 20,
        }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files[0]; if (f) processFile(f); }} />
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <svg width="18" height="18" fill="none" stroke="#3b82f6" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12M8 8l4-4 4 4"/>
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
          {fileName || "Drop your Excel schedule here"}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {fileName ? `${entries.length} entries parsed` : "or click to browse  ·  .xlsx  .xls  .csv"}
        </div>
      </div>

      {errors.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#dc2626", marginBottom: 8, fontWeight: 600 }}>
            Parse warnings ({errors.length})
          </div>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#b91c1c", fontFamily: "monospace", marginBottom: 2 }}>— {e}</div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 14, fontWeight: 600 }}>
            Preview — {entries.length} entries
          </div>

          {Object.entries(grouped).map(([roomId, roomEntries]) => (
            <div key={roomId} style={{ marginBottom: 14, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{ROOM_LABELS[roomId] || roomId}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{roomEntries.length} entries</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "8px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid #f1f5f9" }}>
                      Seconds from Start
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roomEntries.map((e, i) => (
                    <tr key={i} style={{ borderBottom: i < roomEntries.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "9px 16px", fontSize: 12, fontFamily: "monospace", color: "#64748b" }}>
                        {fmtSeconds(e.seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={handleUpload} disabled={uploading} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: uploading ? "#93c5fd" : "#2563eb", color: "#fff",
              border: "none", borderRadius: 8, padding: "10px 22px",
              fontSize: 14, fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer",
            }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {uploading ? "Uploading..." : "Push Schedule"}
            </button>
            <button onClick={handleReset} style={{
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
              padding: "10px 18px", fontSize: 14, color: "#64748b", cursor: "pointer",
            }}>Clear</button>
          </div>
        </>
      )}

      {status && (
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 8, fontSize: 13,
          fontFamily: "monospace", whiteSpace: "pre-line",
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