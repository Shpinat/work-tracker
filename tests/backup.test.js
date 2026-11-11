import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  PAID_PAYOUTS_KEY,
  sanitizeSettings,
  loadShifts,
  loadPaidPayouts,
  savePaidPayouts,
} from "../data/storage.js";
import {
  createBackupPayload,
  parseBackupFile,
  exportCSV,
  exportICS,
  MAX_BACKUP_FILE_SIZE,
} from "../data/backup.js";

console.log("Running data/backup and storage tests...");

// Save/restore globals cleanly
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalURL = Object.getOwnPropertyDescriptor(globalThis, "URL");
const originalFileReader = Object.getOwnPropertyDescriptor(globalThis, "FileReader");
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function createMockLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

class MockFileReader {
  readAsText(file) {
    queueMicrotask(() => {
      if (file._failRead) {
        this.onerror?.();
        return;
      }
      this.onload?.({ target: { result: file._text } });
    });
  }
}

function makeMockFile(text, sizeOverride = null) {
  return {
    _text: text,
    size: sizeOverride ?? Buffer.byteLength(String(text ?? ""), "utf8"),
  };
}

try {
  Object.defineProperty(globalThis, "FileReader", {
    configurable: true,
    writable: true,
    value: MockFileReader,
  });

  // 1. Sanitize settings backward compatibility & hardening
  const v1Settings = {
    rate: "350",
    payMode: "hourly",
    presets: {
      day: { name: "1-я смена", start: "08:00", end: "16:00", breakMins: 30 },
      night: { name: "Ночь", start: "99:99", end: "bad", color: "not-hex" },
    },
  };
  const sanitized = sanitizeSettings(v1Settings);
  assert.equal(sanitized.rate, 350);
  assert.equal(sanitized.payMode, "hourly");
  assert.equal(sanitized.currency, "₽");
  assert.equal(sanitized.presets.day.name, "1-я смена");
  assert.equal(sanitized.presets.day.start, "08:00");
  assert.equal(sanitized.presets.day.end, "16:00");
  assert.equal(sanitized.presets.night.start, "21:00"); // invalid "99:99" falls back
  assert.equal(sanitized.presets.night.end, "09:00");   // invalid "bad" falls back

  const badRateSettings = sanitizeSettings({ rate: NaN });
  assert.equal(badRateSettings.rate, 300);
  const infRateSettings = sanitizeSettings({ rate: Infinity });
  assert.equal(infRateSettings.rate, 300);
  const negRateSettings = sanitizeSettings({ rate: -50 });
  assert.equal(negRateSettings.rate, 300);

  const defaultSanitized = sanitizeSettings({});
  assert.equal(defaultSanitized.payMode, "hourly");
  assert.equal(defaultSanitized.currency, "₽");
  assert.ok(defaultSanitized.presets.day);
  assert.ok(defaultSanitized.presets.night);
  assert.ok(defaultSanitized.presets.extra);

  // 2. loadShifts & loadPaidPayouts / savePaidPayouts hardening
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: createMockLocalStorage({ [STORAGE_KEY]: "null" }),
  });
  assert.deepEqual(loadShifts(), {});

  globalThis.localStorage.setItem(STORAGE_KEY, "[]");
  assert.deepEqual(loadShifts(), {});

  globalThis.localStorage.setItem(STORAGE_KEY, "{bad json");
  assert.deepEqual(loadShifts(), {});

  assert.equal(
    savePaidPayouts({
      "2026-10:advance": { paid: true, actualAmount: 15000, paidAt: "2026-10-27T10:00:00Z" },
      "bad-key": { paid: true },
      "2026-13:salary": { paid: true },
    }),
    true
  );
  const loadedPayouts = loadPaidPayouts();
  assert.deepEqual(Object.keys(loadedPayouts), ["2026-10:advance"]);
  assert.equal(loadedPayouts["2026-10:advance"].paid, true);
  assert.equal(loadedPayouts["2026-10:advance"].actualAmount, 15000);
  assert.ok(globalThis.localStorage.getItem(PAID_PAYOUTS_KEY));

  // 3. Real parseBackupFile tests
  const v2Parsed = await parseBackupFile(
    makeMockFile(
      JSON.stringify({
        app: "WorkTrack",
        schemaVersion: 2,
        shifts: {
          "2026-10-01": { hours: 10, totalPay: 3000 },
          "2026-10-02": { hours: 12, totalPay: 3600 },
          "2026-02-31": { hours: 8, totalPay: 2000 }, // invalid calendar date must be skipped
          "2026-10-03": { hours: Infinity, totalPay: -100, start: "bad", type: "evil" },
        },
        settings: { rate: 300 },
        paidPayouts: { "2026-10:advance": { paid: true } },
      })
    )
  );
  assert.equal(v2Parsed.isValid, true);
  assert.equal(v2Parsed.schemaVersion, 2);
  assert.equal(v2Parsed.stats.shiftsCount, 3);
  assert.equal(v2Parsed.shifts["2026-02-31"], undefined);
  assert.equal(v2Parsed.shifts["2026-10-03"].hours, 0);
  assert.equal(v2Parsed.shifts["2026-10-03"].totalPay, 0);
  assert.equal(v2Parsed.shifts["2026-10-03"].start, "09:00");
  assert.equal(v2Parsed.shifts["2026-10-03"].type, "day");
  assert.equal(v2Parsed.paidPayouts["2026-10:advance"].paid, true);

  // Legacy v1 payload using shift.pay fallback
  const v1Parsed = await parseBackupFile(
    makeMockFile(
      JSON.stringify({
        app: "work-tracker",
        version: "1.0",
        shifts: { "2026-05-10": { hours: 5, pay: 1500 } },
        settings: { rate: 300 },
      })
    )
  );
  assert.equal(v1Parsed.shifts["2026-05-10"].totalPay, 1500);
  assert.equal(v1Parsed.stats.totalIncome, 1500);

  // Reject empty metadata-only WorkTrack JSON, unknown JSON, and oversized files
  await assert.rejects(() => parseBackupFile(makeMockFile(JSON.stringify({ app: "WorkTrack" }))));
  await assert.rejects(() => parseBackupFile(makeMockFile(JSON.stringify({ app: "WorkTrack", shifts: {}, settings: {} }))));
  await assert.rejects(() => parseBackupFile(makeMockFile(JSON.stringify({ someUnknownApp: true }))));
  await assert.rejects(() => parseBackupFile(makeMockFile("{}", MAX_BACKUP_FILE_SIZE + 1)));

  // createBackupPayload includes paidPayouts when provided
  const payloadWithPayouts = createBackupPayload(
    { "2026-10-01": { hours: 10, totalPay: 3000 } },
    sanitized,
    { "2026-10:advance": { paid: true } }
  );
  assert.equal(payloadWithPayouts.paidPayouts["2026-10:advance"].paid, true);

  // 4. Mock browser download APIs for exportCSV & exportICS
  let exportedBlob = null;
  let exportedFilename = null;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: {
      createElement: () => ({
        click() {},
        set href(_) {},
        set download(name) {
          exportedFilename = name;
        },
      }),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: { canShare: () => false },
  });
  Object.defineProperty(globalThis, "URL", {
    configurable: true,
    writable: true,
    value: {
      createObjectURL: (blob) => {
        exportedBlob = blob;
        return "blob:test";
      },
      revokeObjectURL() {},
    },
  });

  // CSV formula injection & quoting test across preset.name, note, tags
  const dangerousSettings = sanitizeSettings({
    presets: {
      day: { name: '=HYPERLINK("http://evil","Click"); "1"', start: "09:00", end: "21:00" },
    },
  });
  const csvResult = await exportCSV({
    shifts: {
      "2026-10-01": {
        type: "day",
        start: "09:00",
        end: "18:00",
        hours: 9,
        totalPay: 2700,
        tags: ["urgent", "weekend"],
        note: "\t=CMD|'/C calc'!A0",
      },
      "2026-10-02": {
        type: "day",
        start: "09:00",
        end: "18:00",
        hours: 9,
        totalPay: 2700,
        tags: [" =1+1"],
        note: '+2+3; "quoted"',
      },
    },
    settings: dangerousSettings,
    currentDate: new Date(2026, 9, 1),
  });
  assert.equal(csvResult.count, 2);
  const csvText = await exportedBlob.text();
  assert.match(csvText, /Итого;Tags;Заметка/);
  assert.match(csvText, /urgent; weekend/);
  assert.match(csvText, /"'=HYPERLINK\(""http:\/\/evil"",""Click""\); ""1"""/);
  assert.match(csvText, /"'\t=CMD\|'\/C calc'!A0"/);
  assert.match(csvText, /"' =1\+1"/);
  assert.match(csvText, /"'\+2\+3; ""quoted"""/);

  // 5. exportICS test (including overnight shift crossing midnight & escaping)
  const icsResult = exportICS({
    shifts: {
      "2026-10-31": {
        type: "night",
        start: "21:00",
        end: "09:00",
        hours: 12,
        totalPay: 3600,
        note: "Точка А; смена, 1",
      },
      "2026-09-15": {
        type: "day",
        start: "09:00",
        end: "18:00",
        hours: 9,
        totalPay: 2700,
      },
    },
    settings: sanitized,
    year: 2026,
    month: 9, // October
  });
  assert.equal(icsResult.count, 1);
  assert.equal(exportedFilename, "shifts_2026-10.ics");
  assert.match(icsResult.icsContent, /BEGIN:VCALENDAR/);
  assert.match(icsResult.icsContent, /DTSTART:20261031T210000/);
  assert.match(icsResult.icsContent, /DTEND:20261101T090000/);
  assert.match(icsResult.icsContent, /Точка А\\; смена\\, 1/);
  assert.doesNotMatch(icsResult.icsContent, /20260915/);

  const emptyIcs = exportICS({ shifts: {}, settings: sanitized, year: 2026, month: 9 });
  assert.equal(emptyIcs.count, 0);
} finally {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else delete globalThis.document;
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else delete globalThis.navigator;
  if (originalURL) Object.defineProperty(globalThis, "URL", originalURL);
  else delete globalThis.URL;
  if (originalFileReader) Object.defineProperty(globalThis, "FileReader", originalFileReader);
  else delete globalThis.FileReader;
  if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  else delete globalThis.localStorage;
}

console.log("All data/backup and storage tests PASSED successfully!");
