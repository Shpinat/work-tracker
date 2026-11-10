import assert from "node:assert/strict";
import { sanitizeSettings } from "../data/storage.js";
import { exportCSV } from "../data/backup.js";

console.log("Running data/backup and storage tests...");

// 1. Sanitize settings backward compatibility
const v1Settings = {
  rate: 350,
  payMode: "hourly",
  presets: {
    day: { name: "1-я смена", start: "08:00", end: "16:00", breakMins: 30 }
  }
};

const sanitized = sanitizeSettings(v1Settings);
assert.equal(sanitized.rate, 350);
assert.equal(sanitized.payMode, "hourly");
assert.equal(sanitized.currency, "₽");
assert.equal(sanitized.presets.day.name, "1-я смена");
assert.equal(sanitized.presets.day.start, "08:00");
assert.equal(sanitized.presets.day.end, "16:00");

// 2. Fallbacks for missing settings
const defaultSanitized = sanitizeSettings({});
assert.equal(defaultSanitized.payMode, "hourly");
assert.equal(defaultSanitized.currency, "₽");
assert.ok(defaultSanitized.presets.day);
assert.ok(defaultSanitized.presets.night);
assert.ok(defaultSanitized.presets.extra);

// 3. Simulated parseBackupFile testing
function simulateParse(text) {
  const parsed = JSON.parse(text);
  const isKnownApp =
    parsed.app === "WorkTrack" ||
    parsed.app === "work-tracker" ||
    (parsed.shifts && typeof parsed.shifts === "object" && parsed.settings && typeof parsed.settings === "object");

  if (!isKnownApp) throw new Error("Файл не является резервной копией WorkTrack");

  const rawShifts = parsed.shifts && typeof parsed.shifts === "object" ? parsed.shifts : {};
  const cleanShifts = {};
  const dateKeyRegex = /^\d{4}-\d{2}-\d{2}$/;
  for (const [key, shift] of Object.entries(rawShifts)) {
    if (dateKeyRegex.test(key) && shift && typeof shift === "object") {
      cleanShifts[key] = {
        type: shift.type || "day",
        start: shift.start || "09:00",
        end: shift.end || "21:00",
        breakMins: Number(shift.breakMins) || 0,
        hours: Number(shift.hours) || 0,
        totalPay: Number(shift.totalPay) || 0,
      };
    }
  }

  const shiftKeys = Object.keys(cleanShifts).sort();
  return {
    isValid: true,
    schemaVersion: parsed.schemaVersion || 1,
    stats: {
      shiftsCount: shiftKeys.length,
      firstDate: shiftKeys[0] || null,
      lastDate: shiftKeys[shiftKeys.length - 1] || null,
      totalIncome: shiftKeys.reduce((acc, k) => acc + (cleanShifts[k].totalPay || 0), 0)
    },
    shifts: cleanShifts,
    settings: sanitizeSettings(parsed.settings || {})
  };
}

// Test valid v2 payload
const v2Payload = JSON.stringify({
  app: "WorkTrack",
  schemaVersion: 2,
  shifts: {
    "2026-10-01": { hours: 10, totalPay: 3000 },
    "2026-10-02": { hours: 12, totalPay: 3600 }
  },
  settings: { rate: 300 }
});
const parsedV2 = simulateParse(v2Payload);
assert.equal(parsedV2.isValid, true);
assert.equal(parsedV2.schemaVersion, 2);
assert.equal(parsedV2.stats.shiftsCount, 2);
assert.equal(parsedV2.stats.firstDate, "2026-10-01");
assert.equal(parsedV2.stats.lastDate, "2026-10-02");
assert.equal(parsedV2.stats.totalIncome, 6600);

// Test legacy v1 payload
const v1Payload = JSON.stringify({
  app: "work-tracker",
  version: "2.0",
  shifts: { "2026-05-10": { hours: 5, totalPay: 1500 } },
  settings: { rate: 300 }
});
const parsedV1 = simulateParse(v1Payload);
assert.equal(parsedV1.isValid, true);
assert.equal(parsedV1.schemaVersion, 1);
assert.equal(parsedV1.stats.shiftsCount, 1);

// Test corrupt/invalid payload
assert.throws(() => simulateParse(JSON.stringify({ someUnknownApp: true })));

// 4. CSV export must support stored tags and keep its header aligned.
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalURL = Object.getOwnPropertyDescriptor(globalThis, "URL");
let exportedBlob = null;
Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: {
  createElement: () => ({
    click() {},
    set href(_) {},
    set download(_) {},
  }),
} });
Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: { canShare: () => false } });
Object.defineProperty(globalThis, "URL", { configurable: true, writable: true, value: {
  createObjectURL: (blob) => {
    exportedBlob = blob;
    return "blob:test";
  },
  revokeObjectURL() {},
} });

const csvResult = await exportCSV({
  shifts: {
    "2026-10-01": {
      type: "day", start: "09:00", end: "18:00", breakMins: 0,
      hours: 9, bonus: 0, totalPay: 2700, tags: ["urgent", "weekend"], note: "Test",
    },
  },
  settings: sanitized,
  currentDate: new Date(2026, 9, 1),
});
assert.equal(csvResult.count, 1);
const csvText = await exportedBlob.text();
assert.match(csvText, /Итого;Tags;Заметка/);
assert.match(csvText, /urgent; weekend/);

if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
else delete globalThis.document;
if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
else delete globalThis.navigator;
if (originalURL) Object.defineProperty(globalThis, "URL", originalURL);
else delete globalThis.URL;

console.log("All data/backup and storage tests PASSED successfully!");
