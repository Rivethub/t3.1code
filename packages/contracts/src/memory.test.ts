import { expect, it } from "vite-plus/test";

import { memoryLinkPath, memoryPageUrl } from "./memory.ts";

const origin = "https://localhost:5174";

it("matches the complete node origin and preserves the URL's route", () => {
  expect(memoryLinkPath(origin, origin + "/topics/some-topic?q=two#part")).toBe(
    "/topics/some-topic?q=two#part",
  );
  for (const url of [
    "https://localhost:5175/topics/a",
    "http://localhost:5174/topics/a",
    "https://127.0.0.1:5174/topics/a",
    "https://localhost:5174.example.com/topics/a",
    "https://user@localhost:5174/topics/a",
    "file:///topics/a",
  ]) {
    expect(memoryLinkPath(origin, url)).toBeNull();
  }
});

it("rechecks the origin when applying a route's untrusted destination", () => {
  expect(memoryPageUrl(origin, "/settings")).toBe(origin + "/settings");
  expect(memoryPageUrl(origin, "//example.com/topics/a")).toBe(origin + "/");
  expect(memoryPageUrl(origin, "/\\example.com")).toBe(origin + "/");
});
