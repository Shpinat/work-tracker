import assert from "node:assert/strict";
import {
  calcHoursDiff,
  calcNightHours,
  calcShiftPay,
  calcMonthSummary,
  verifyPayslip,
} from "../domain/payroll.js";
import {
  calculateScheduleDates,
  buildShiftFromPreset,
  SCHEDULE_PATTERNS,
} from "../domain/schedule.js";
import {
  sanitizeSettings,
  DEFAULT_SETTINGS,
} from "../data/storage.js";
import {
  parseBackupFile,
} from "../data/backup.js";

console.log("Running comprehensive integration verification...");

// 1. Settings sanitization
const rawSettings = { defaultRate: 250, currency: "$" };
const cleanSettings = sanitizeSettings(rawSettings);
assert.equal(cleanSettings.currency, "$");

// Default currency
const cleanDefault = sanitizeSettings({});
assert.equal(cleanDefault.currency, "₽");

// 2. Pay calculation with bonus
const payResult = calcShiftPay(11, 300, "hourly", 500);
assert.equal(payResult, 3800);

// 3. Fact vs Forecast split in calcMonthSummary
const mockShifts = {
  "2026-10-05": { start: "09:00", end: "18:00", hours: 8, pay: 2000, type: "day" },
  "2026-10-10": { start: "09:00", end: "18:00", hours: 8, pay: 2000, type: "day" },
  "2026-10-25": { start: "09:00", end: "18:00", hours: 8, pay: 2000, type: "day" },
  "2026-10-30": { start: "09:00", end: "18:00", hours: 8, pay: 2000, type: "day" },
};
// Reference date: 2026-10-20
const summary = calcMonthSummary(mockShifts, 2026, 9, 15, new Date(2026, 9, 20));
assert.equal(summary.totalShifts, 4);
assert.equal(summary.totalHours, 32);
assert.equal(summary.totalIncome, 8000);
// Earned (Oct 5 and Oct 10 <= Oct 20):
assert.equal(summary.earnedShiftsCount, 2);
assert.equal(summary.earnedHours, 16);
assert.equal(summary.earnedIncome, 4000);
// Projected (Oct 25 and Oct 30 > Oct 20):
assert.equal(summary.projectedShiftsCount, 2);
assert.equal(summary.projectedHours, 16);
assert.equal(summary.projectedIncome, 4000);
// Effective hourly rate: 8000 / 32 = 250
assert.equal(summary.effectiveHourlyRate, 250);

// 4. Payslip audit
const auditMatch = verifyPayslip(8000, 8000);
assert.equal(auditMatch.status, "match");
assert.equal(auditMatch.diff, 0);

const auditUnder = verifyPayslip(7500, 8000);
assert.equal(auditUnder.status, "underpaid");
assert.equal(auditUnder.absDiff, 500);
assert.equal(auditUnder.diff, -500);

const auditOver = verifyPayslip(8500, 8000);
assert.equal(auditOver.status, "overpaid");
assert.equal(auditOver.absDiff, 500);
assert.equal(auditOver.diff, 500);

// 5. Schedule patterns
assert.ok(SCHEDULE_PATTERNS["1-3-day"]);
assert.ok(SCHEDULE_PATTERNS["4-4-day"]);
assert.ok(SCHEDULE_PATTERNS["2-2-3-pitman"]);

const dates13 = calculateScheduleDates({
  startDateStr: "2026-10-01",
  patternKey: "1-3-day",
  durationMonths: 1,
});
assert.ok(dates13.length > 0);
// Pattern 1/3 has cycle length 4 (day, off, off, off)
assert.equal(dates13[0].type, "day");
assert.equal(dates13[0].dateKey, "2026-10-01");
assert.equal(dates13[1].dateKey, "2026-10-05");

// 6. Shift generation from preset
const nightShift = buildShiftFromPreset("night", {
  ...cleanSettings,
  defaultRate: 200,
  payMode: "hourly",
  presets: {
    night: { name: "Ночь", start: "22:00", end: "06:00", breakMins: 0, rate: 200, payMode: "hourly" },
  },
});
// 22:00-06:00 is 8 hours. Base = 1600.
assert.equal(nightShift.hours, 8);
assert.equal(nightShift.totalPay, 1600);

console.log("All integration verification tests PASSED!");
