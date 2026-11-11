import assert from "node:assert/strict";
import {
  formatDateKey,
  calcHoursDiff,
  calcNightHours,
  calcShiftPay,
  calcMonthSummary,
  calcPayoutSchedule,
  recalcMonthShifts,
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
assert.equal(calcHoursDiff("09:00", "09:00", 0), 0);
assert.equal(calcHoursDiff("invalid", "18:00", 0), 0);
assert.equal(calcHoursDiff("09:00", "25:00", 0), 0);
assert.equal(calcHoursDiff("09:00", "17:00", -60), 8); // negative break clamped to 0

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
assert.equal(calcShiftPay(10, -300, "hourly", 0, 0), 0);
assert.equal(calcShiftPay(-5, 300, "hourly", 100, 0), 100);

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

// 7. calcPayoutSchedule (advance 1..15 current month, salary 12th of next month for previous month)
const payoutShifts = {
  "2026-09-10": { hours: 10, totalPay: 3000 }, // Sep 1..15 -> Sep advance
  "2026-09-20": { hours: 10, totalPay: 3500 }, // Sep 16..30 -> paid Oct 12
  "2026-09-28": { hours: 10, totalPay: 4000 }, // Sep 16..30 -> paid Oct 12
  "2026-10-05": { hours: 12, totalPay: 4200 }, // Oct 1..15 -> Oct advance
  "2026-10-22": { hours: 8, totalPay: 2800 },  // Oct 16..31 -> paid Nov 12
};
const octPayout = calcPayoutSchedule(payoutShifts, 2026, 9, {
  cutoffDay: 15,
  advancePayDay: 27,
  salaryPayDay: 12,
});
assert.equal(octPayout.incomingPrevSalary.amount, 7500);
assert.equal(octPayout.incomingPrevSalary.shiftsCount, 2);
assert.equal(octPayout.incomingPrevSalary.payDay, 12);
assert.equal(octPayout.incomingPrevSalary.sourceMonth, 8); // September
assert.equal(octPayout.advance.amount, 4200);
assert.equal(octPayout.advance.shiftsCount, 1);
assert.equal(octPayout.advance.payDay, 27);
assert.equal(octPayout.nextMonthSalary.amount, 2800);
assert.equal(octPayout.nextMonthSalary.payDay, 12);
assert.equal(octPayout.nextMonthSalary.payMonth, 10); // November
assert.equal(octPayout.totalIncomingInMonth, 11700);

// 8. calcPayoutSchedule boundary cases: Dec->Jan, Jan->Dec, leap/non-leap Feb, payDay=31, cutoffDay=28
const boundaryShifts = {
  "2025-12-20": { hours: 10, totalPay: 3000 },
  "2026-01-10": { hours: 8, totalPay: 2400 },
  "2026-01-25": { hours: 10, totalPay: 3000 },
  "2026-02-14": { hours: 8, totalPay: 2400 },
  "2026-02-28": { hours: 8, totalPay: 2500 },
};

// Jan 2026: incomingPrevSalary from Dec 2025, nextMonthSalary in Feb 2026 (28 days -> payDay 31 clamped to 28)
const jan2026 = calcPayoutSchedule(boundaryShifts, 2026, 0, {
  cutoffDay: 15,
  advancePayDay: 31,
  salaryPayDay: 31,
});
assert.equal(jan2026.incomingPrevSalary.sourceYear, 2025);
assert.equal(jan2026.incomingPrevSalary.sourceMonth, 11);
assert.equal(jan2026.incomingPrevSalary.amount, 3000);
assert.equal(jan2026.advance.payDay, 31);
assert.equal(jan2026.nextMonthSalary.payMonth, 1); // Feb
assert.equal(jan2026.nextMonthSalary.payDay, 28); // clamped to 28

// Leap Jan 2024 -> Feb 2024 (29 days -> payDay 31 clamped to 29)
const jan2024 = calcPayoutSchedule({}, 2024, 0, {
  cutoffDay: 15,
  advancePayDay: 31,
  salaryPayDay: 31,
});
assert.equal(jan2024.nextMonthSalary.payDay, 29);

// Dec 2026 -> Jan 2027 rollover
const dec2026 = calcPayoutSchedule({ "2026-12-20": { hours: 10, totalPay: 4000 } }, 2026, 11, {
  cutoffDay: 15,
  advancePayDay: 27,
  salaryPayDay: 12,
});
assert.equal(dec2026.nextMonthSalary.payYear, 2027);
assert.equal(dec2026.nextMonthSalary.payMonth, 0);
assert.equal(dec2026.nextMonthSalary.amount, 4000);

// cutoffDay=28 in non-leap Feb 2026 (28 days): no inverted 29-28 range
const febCutoff28 = calcPayoutSchedule(boundaryShifts, 2026, 1, {
  cutoffDay: 28,
  advancePayDay: 31,
  salaryPayDay: 31,
});
assert.equal(febCutoff28.advance.toDay, 28);
assert.equal(febCutoff28.advance.payDay, 28);
assert.equal(febCutoff28.nextMonthSalary.hasRange, false);
assert.equal(febCutoff28.nextMonthSalary.fromDay, null);
assert.equal(febCutoff28.nextMonthSalary.toDay, null);

// 9. recalcMonthShifts preserves bonus and nightBonus, clamps negative rates
const recalcInput = {
  "2026-10-01": { hours: 10, rate: 200, payMode: "hourly", bonus: 500, nightBonus: 300, totalPay: 2800 },
  "2026-10-02": { hours: 8, rate: 200, payMode: "fixed", bonus: 0, totalPay: 200 },
  "2026-09-30": { hours: 10, rate: 200, payMode: "hourly", bonus: 0, totalPay: 2000 },
};
const recalcRes = recalcMonthShifts(recalcInput, 2026, 9, 400, "hourly");
assert.equal(recalcRes.count, 2);
assert.equal(recalcRes.updatedShifts["2026-10-01"].totalPay, 4800); // 10*400 + 500 + 300
assert.equal(recalcRes.updatedShifts["2026-10-02"].totalPay, 3200); // 8*400
assert.equal(recalcRes.updatedShifts["2026-09-30"].totalPay, 2000); // untouched other month
const recalcNeg = recalcMonthShifts(recalcInput, 2026, 9, -50, "hourly");
assert.equal(recalcNeg.updatedShifts["2026-10-02"].rate, 0);
assert.equal(recalcNeg.updatedShifts["2026-10-02"].totalPay, 0);

console.log("All domain/payroll.js tests PASSED successfully!");
