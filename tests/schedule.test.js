import assert from "node:assert/strict";
import { SCHEDULE_PATTERNS, calculateScheduleDates, buildShiftFromPreset } from "../domain/schedule.js";

console.log("Running domain/schedule.js tests...");

// 1. Patterns existence
assert.ok(SCHEDULE_PATTERNS["1-3-day"]);
assert.equal(SCHEDULE_PATTERNS["1-3-day"].name, "Сутки через трое (1/3)");
assert.deepEqual(SCHEDULE_PATTERNS["1-3-day"].cycle, ["day", "off", "off", "off"]);

assert.ok(SCHEDULE_PATTERNS["4-4-day"]);
assert.deepEqual(SCHEDULE_PATTERNS["4-4-day"].cycle, ["day", "day", "day", "day", "off", "off", "off", "off"]);

assert.ok(SCHEDULE_PATTERNS["2-2-3-pitman"]);
assert.equal(SCHEDULE_PATTERNS["2-2-3-pitman"].cycle.length, 14);

// 2. Schedule dates calculation for 1/3
const planned = calculateScheduleDates({
  startDateStr: "2026-11-01",
  patternKey: "1-3-day",
  durationMonths: 1,
  skipExisting: false
});
// In November (30 days), 1/3 starting on day 1 gives shifts on day 1, 5, 9, 13, 17, 21, 25, 29 (8 shifts)
assert.equal(planned.length, 8);
assert.equal(planned[0].dateKey, "2026-11-01");
assert.equal(planned[1].dateKey, "2026-11-05");

// 3. buildShiftFromPreset
const testSettings = {
  presets: {
    night: { start: "22:00", end: "06:00", breakMins: 0 }
  },
  rate: 300,
  payMode: "hourly",
};

const nightShift = buildShiftFromPreset("night", testSettings);
assert.equal(nightShift.hours, 8);
// 8h * 300 = 2400 base pay
assert.equal(nightShift.totalPay, 2400);

console.log("All domain/schedule.js tests PASSED successfully!");
