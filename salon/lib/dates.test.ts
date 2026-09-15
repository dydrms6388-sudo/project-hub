import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, formatKoreanDate, formatTime, isPast, todayKST } from "./dates.ts";

test("todayKST returns an ISO date string", () => {
  assert.match(todayKST(), /^\d{4}-\d{2}-\d{2}$/);
});

test("todayKST is KST, not UTC", () => {
  // UTC 자정 직후 = KST 오전 9시(같은 날), UTC 15:00 = KST 다음날 0시
  const utcLateEvening = new Date("2026-08-31T15:30:00Z");
  assert.equal(todayKST(utcLateEvening), "2026-09-01");
  const utcMorning = new Date("2026-08-31T02:00:00Z");
  assert.equal(todayKST(utcMorning), "2026-08-31");
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-08-31", 35), "2026-10-05");
  assert.equal(addDays("2026-12-20", 35), "2027-01-24");
  assert.equal(addDays("2026-03-01", -2), "2026-02-27");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29", "윤년");
});

test("formatKoreanDate renders month/day/weekday", () => {
  assert.equal(formatKoreanDate("2026-08-31"), "8월 31일 (월)");
});

test("formatTime trims seconds and handles null", () => {
  assert.equal(formatTime("14:30:00"), "14:30");
  assert.equal(formatTime("09:05"), "09:05");
  assert.equal(formatTime(null), "");
});

test("isPast compares date strings against KST today", () => {
  const now = new Date("2026-08-31T02:00:00Z"); // KST 8/31 11:00
  assert.ok(isPast("2026-08-30", now));
  assert.ok(!isPast("2026-08-31", now), "오늘은 과거가 아님");
  assert.ok(!isPast("2026-09-01", now));
});
