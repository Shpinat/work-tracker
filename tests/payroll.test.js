import assert from "node:assert/strict";
import {
  formatDateKey,
  calcHoursDiff,
  calcNightHours,
  calcShiftPay,
  calcMonthSummary,
  verifyPayslip
} from "../domain/payroll.js";

console.log("Running domain/payroll.js tests...");

// 1. formatDateKey
assert.equal(formatDateKey(2026, 9, 27), "2026-10-27");
assert.equal(formatDateKey(2026, 0, 5), "2026-01-05");
assert.equal(formatDateKey(new Date(2026, 9, 27)), "2026-10-27");
assert.equal(formatDateKey(new Date(2026, 0, 5)), "2026-01-05");

// 2. calcHoursDiff
assert.equal(calcHoursDiff("09:00", "14:00", 0), 5);
assert.equal(calcHoursDiff("14:00", "20:00", 0), 6);
assert.equal(calcHoursDiff("09:00", "20:00", 60), 10);
assert.equal(calcHoursDiff("21:00", "09:00", 60), 11); // overnight shift
assert.equal(calcHoursDiff("22:00", "06:00", 0), 8); // overnight shift
assert.equal(calcHoursDiff("10:00", "10:30", 45), 0); // break > shift duration

// 3. calcNightHours
// Window 22:00 - 06:00 (default)
// Day shift 09:00 - 18:00 -> 0 night hours
assert.equal(calcNightHours("09:00", "18:00", 0), 0);

// Night shift 21:00 - 07:00 (10 gross hrs, night is 22:00..06:00 = 8h)
assert.equal(calcNightHours("21:00", "07:00", 0), 8);

// Night shift 22:00 - 06:00 without break -> 8h
assert.equal(calcNightHours("22:00", "06:00", 0), 8);

// Night shift 21:00 - 07:00 with 60 min break -> break proportionally deducted
// Gross is 10h, night window is 8h (80%). Break 1h -> 0.8h deducted -> 7.2h
assert.equal(calcNightHours("21:00", "07:00", 60), 7.2);

// Shift 18:00 - 23:30 (crosses 22:00) -> 1.5h night hours
assert.equal(calcNightHours("18:00", "23:30", 0), 1.5);

// Early morning shift 05:00 - 12:00 (crosses 06:00) -> 1h night hours
assert.equal(calcNightHours("05:00", "12:00", 0), 1);

// 4. calcShiftPay
assert.equal(calcShiftPay(10, 300, "hourly", 500, 0), 3500);
assert.equal(calcShiftPay(10, 300, "hourly", 500, 200), 3700);
assert.equal(calcShiftPay(10, 3000, "fixed", 500, 0), 3500);

// 5. calcMonthSummary with Fact vs Projected
const shifts = {
  "2026-10-05": { hours: 8, totalPay: 2400 },
  "2026-10-15": { hours: 8, totalPay: 2400 },
  "2026-10-25": { hours: 8, totalPay: 2400 },
  "2026-10-28": { hours: 8, totalPay: 2400 },
  "2026-10-30": { hours: 8, totalPay: 2400 },
};

// Reference date is 2026-10-27:
// Earned (<= 27): 5th, 15th, 25th -> 3 shifts, 24 hours, 7200 pay
// Projected (> 27): 28th, 30th -> 2 shifts, 16 hours, 4800 pay
// Total: 5 shifts, 40 hours, 12000 pay
const summary = calcMonthSummary(shifts, 2026, 9, 15, new Date(2026, 9, 27));
assert.equal(summary.totalShifts, 5);
assert.equal(summary.totalHours, 40);
assert.equal(summary.totalIncome, 12000);
assert.equal(summary.earnedShiftsCount, 3);
assert.equal(summary.earnedHours, 24);
assert.equal(summary.earnedIncome, 7200);
assert.equal(summary.projectedShiftsCount, 2);
assert.equal(summary.projectedHours, 16);
assert.equal(summary.projectedIncome, 4800);
assert.equal(summary.effectiveHourlyRate, 300);

// 6. verifyPayslip
const v1 = verifyPayslip(70000, 72500);
assert.equal(v1.diff, -2500);
assert.equal(v1.isUnderpaid, true);

const v2 = verifyPayslip(75000, 72500);
assert.equal(v2.diff, 2500);
assert.equal(v2.isOverpaid, true);

const v3 = verifyPayslip(72500, 72500);
assert.equal(v3.diff, 0);
assert.equal(v3.isMatch, true);

console.log("All domain/payroll.js tests PASSED successfully!");
