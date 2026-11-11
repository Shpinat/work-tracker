import assert from "node:assert/strict";
import { calculateAllTimeAnalytics, calcMomTrends } from "../domain/analytics.js";

console.log("Running domain/analytics.js tests...");

// 1. Empty shifts
const empty = calculateAllTimeAnalytics({}, new Date(2026, 10, 11));
assert.equal(empty.isEmpty, true);
assert.equal(empty.maxStreak, 0);

// 2. Excludes future planned shifts from streaks & supports legacy s.pay
const shifts = {
  "2026-11-08": { type: "day", hours: 8, totalPay: 2400 },
  "2026-11-09": { type: "night", hours: 10, pay: 3000 }, // legacy pay field
  "2026-11-10": { type: "day", hours: 8, totalPay: 2400 },
  "2026-11-20": { type: "extra", hours: 6, totalPay: 1800 }, // future planned shift
  "2026-11-21": { type: "day", hours: 8, totalPay: 2400 },
  "2026-11-22": { type: "day", hours: 8, totalPay: 2400 },
  "2026-11-23": { type: "day", hours: 8, totalPay: 2400 },
};

const stats = calculateAllTimeAnalytics(shifts, new Date(2026, 10, 11));
assert.equal(stats.isEmpty, false);
assert.equal(stats.totalShifts, 7);
assert.equal(stats.totalIncome, 16800);
assert.equal(stats.maxStreak, 3); // Nov 8-10, NOT future Nov 20-23 (4)
assert.equal(stats.currentStreak.status, "yesterday");
assert.equal(stats.currentStreak.days, 3);

// Only future shifts -> streak is none / 0
const onlyFuture = calculateAllTimeAnalytics(
  { "2026-12-01": { type: "day", hours: 8, totalPay: 2400 } },
  new Date(2026, 10, 11)
);
assert.equal(onlyFuture.maxStreak, 0);
assert.equal(onlyFuture.currentStreak.status, "none");

// 3. calcMomTrends across Dec -> Jan boundary & legacy s.pay
const momShifts = {
  "2025-12-10": { hours: 10, pay: 5000 },
  "2026-01-10": { hours: 12, totalPay: 6000 },
};
const mom = calcMomTrends(2026, 0, momShifts, 1, 12, 6000);
assert.equal(mom.prevYear, 2025);
assert.equal(mom.prevMonth, 11);
assert.equal(mom.prevIncome, 5000);
assert.equal(mom.diffIncome, 1000);
assert.equal(mom.pctIncome, 20);

console.log("All domain/analytics.js tests PASSED successfully!");
