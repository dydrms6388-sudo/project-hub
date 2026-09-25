import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampMemo,
  isServiceType,
  isValidDate,
  isValidName,
  isValidPhone,
  isValidTime,
  normalizePhone,
  parsePrice,
  sanitizeSearchTerm,
} from "./validate.ts";

test("normalizePhone strips formatting", () => {
  assert.equal(normalizePhone("010-1234-5678"), "01012345678");
  assert.equal(normalizePhone("010 1234 5678"), "01012345678");
  assert.equal(normalizePhone("+82 10-1234-5678"), "821012345678");
});

test("isValidPhone accepts Korean mobile numbers only", () => {
  assert.ok(isValidPhone("01012345678"));
  assert.ok(isValidPhone("0111234567"));
  assert.ok(!isValidPhone("0212345678"), "서울 지역번호 거부");
  assert.ok(!isValidPhone("0101234567890"), "너무 김");
  assert.ok(!isValidPhone("010123456"), "너무 짧음");
  assert.ok(!isValidPhone(""));
});

test("isValidName bounds length", () => {
  assert.ok(isValidName("김정화"));
  assert.ok(!isValidName(""));
  assert.ok(!isValidName("가".repeat(51)));
});

test("isValidDate rejects impossible dates", () => {
  assert.ok(isValidDate("2026-08-31"));
  assert.ok(!isValidDate("2026-02-30"), "2월 30일 없음");
  assert.ok(!isValidDate("2026-13-01"));
  assert.ok(!isValidDate("26-08-31"));
  assert.ok(!isValidDate(""));
});

test("isValidTime accepts HH:MM and HH:MM:SS", () => {
  assert.ok(isValidTime("09:30"));
  assert.ok(isValidTime("23:59:59"));
  assert.ok(!isValidTime("24:00"));
  assert.ok(!isValidTime("9:30"));
});

test("isServiceType guards the enum", () => {
  assert.ok(isServiceType("extension"));
  assert.ok(isServiceType("wig"));
  assert.ok(!isServiceType("perm"));
});

test("parsePrice handles blanks, separators and limits", () => {
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice("  "), null);
  assert.equal(parsePrice("150000"), 150000);
  assert.equal(parsePrice("150,000원"), 150000);
  assert.equal(parsePrice("-5000"), undefined, "음수 거부");
  assert.equal(parsePrice("abc"), undefined);
  assert.equal(parsePrice("999999999999"), undefined, "상한 초과");
});

test("clampMemo trims and caps length", () => {
  assert.equal(clampMemo("  "), null);
  assert.equal(clampMemo(" 모발 얇음 "), "모발 얇음");
  assert.equal(clampMemo("가".repeat(600))?.length, 500);
});

test("sanitizeSearchTerm strips PostgREST filter syntax", () => {
  assert.equal(sanitizeSearchTerm("김정화"), "김정화");
  assert.equal(sanitizeSearchTerm("a,b(c)"), "abc");
  assert.equal(sanitizeSearchTerm("%' or 1=1--"), "or 1=1--");
  assert.equal(sanitizeSearchTerm("name.ilike.*x*"), "name.ilike.x", "와일드카드 제거");
  assert.equal(sanitizeSearchTerm("가".repeat(50)).length, 40);
});
