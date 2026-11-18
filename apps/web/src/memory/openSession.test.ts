import { expect, it, vi } from "vite-plus/test";

import { openMemorySession } from "./openSession";

const request = {
  sessionId: "memory-session",
  harness: "claude-code",
  title: "Transcript",
  startedAt: "2026-11-17T15:10:00Z",
  nativeSessionId: "native-session",
  cwd: "/work/project",
  resumeCommand: "claude --resume native-session",
  handoffPrompt: "Pick up from here.",
};

it("rejects malformed bridge requests before invoking either action", async () => {
  const actions = { resume: vi.fn(), handoff: vi.fn() };
  for (const input of [
    null,
    { ...request, cwd: [] },
    { ...request, startedAt: "yesterday" },
    {
      ...request,
      handoffPrompt: " ",
    },
  ]) {
    expect(await openMemorySession(input, actions)).toMatchObject({ result: { opened: false } });
  }
  expect(actions.resume).not.toHaveBeenCalled();
  expect(actions.handoff).not.toHaveBeenCalled();
});

it("prefers an existing or imported native thread over a handoff", async () => {
  const actions = { resume: vi.fn().mockResolvedValue("thread"), handoff: vi.fn() };
  expect(await openMemorySession(request, actions)).toEqual({
    result: { opened: true, how: "resumed" },
    destination: "thread",
  });
  expect(actions.resume).toHaveBeenCalledWith(request, {
    driver: "claudeAgent",
    nativeSessionId: "native-session",
  });
  expect(actions.handoff).not.toHaveBeenCalled();
});

it("passes the unsent prompt to the handoff if native history is unavailable", async () => {
  const actions = {
    resume: vi.fn().mockRejectedValue(new Error("Transcript missing")),
    handoff: vi.fn().mockResolvedValue("draft"),
  };
  expect(await openMemorySession(request, actions)).toEqual({
    result: { opened: true, how: "handoff" },
    destination: "draft",
  });
  expect(actions.handoff).toHaveBeenCalledWith(request);
  actions.resume.mockClear();
  actions.handoff.mockResolvedValue(null);
  expect(await openMemorySession({ ...request, harness: "unknown" }, actions)).toMatchObject({
    result: { opened: false },
  });
  expect(actions.resume).not.toHaveBeenCalled();
});

it("hands off when the request supplies only a resume command", async () => {
  const { nativeSessionId: _nativeSessionId, ...legacyRequest } = request;
  const actions = { resume: vi.fn(), handoff: vi.fn().mockResolvedValue("draft") };
  expect(await openMemorySession(legacyRequest, actions)).toEqual({
    result: { opened: true, how: "handoff" },
    destination: "draft",
  });
  expect(actions.resume).not.toHaveBeenCalled();
  expect(actions.handoff).toHaveBeenCalledWith(legacyRequest);
});
