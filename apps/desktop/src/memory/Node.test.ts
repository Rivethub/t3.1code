import { describe, expect, it, vi } from "vite-plus/test";

import { createMemoryNode, parseLoginUrl } from "./Node.ts";

const signedInUrl = "https://localhost:5174/login#code=test-code";
const origin = "https://localhost:5174";

function operations() {
  return {
    supported: true,
    find: vi.fn<() => Promise<string | null>>().mockResolvedValue("/fake/home/.local/bin/rh"),
    status: vi.fn<() => Promise<"stopped" | "running">>().mockResolvedValue("running"),
    login: vi.fn().mockResolvedValue(signedInUrl),
    probe: vi.fn().mockResolvedValue(200),
    install: vi
      .fn<(write: (output: string) => void) => Promise<void>>()
      .mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Memory node", () => {
  it("reports platforms without running the CLI", async () => {
    const ops = { ...operations(), supported: false };
    expect(await createMemoryNode(ops).act("open")).toEqual({ _tag: "unsupported" });
    expect(ops.find).not.toHaveBeenCalled();
  });

  it("streams installation progress and rechecks after the approved action", async () => {
    const ops = operations();
    ops.find.mockResolvedValueOnce(null);
    const node = createMemoryNode(ops);
    const installed = Promise.withResolvers<void>();
    ops.install.mockImplementation((write) => {
      write("Verifying release");
      return installed.promise;
    });
    expect(await node.act("open")).toEqual({ _tag: "not-installed" });
    expect(ops.install).not.toHaveBeenCalled();
    expect(await node.act("install")).toMatchObject({
      _tag: "installing",
      output: expect.stringContaining("Verifying release"),
    });
    await node.act("install");
    expect(ops.install).toHaveBeenCalledTimes(1);
    const refreshed = node.act("open");
    installed.resolve();
    expect(await refreshed).toEqual({
      _tag: "ready",
      origin,
      signedInUrl,
    });
  });

  it("starts a stopped node once and distinguishes missing assets from the node's own page", async () => {
    const ops = operations();
    ops.status.mockResolvedValue("stopped");
    const node = createMemoryNode(ops);
    const started = Promise.withResolvers<void>();
    ops.start.mockImplementation(() => started.promise);
    expect(await node.act("open")).toEqual({ _tag: "not-running" });
    expect(await node.act("start")).toEqual({ _tag: "starting" });
    expect(ops.login).not.toHaveBeenCalled();
    ops.status.mockResolvedValue("running");
    ops.probe.mockResolvedValueOnce(404);
    const refreshed = node.act("open");
    started.resolve();
    expect(await refreshed).toEqual({ _tag: "no-ui" });
    expect(await node.act("open")).toEqual({ _tag: "ready", origin, signedInUrl });
  });

  it("reports failed login and does not hand a guest a code from a different origin", async () => {
    const ops = operations();
    ops.login.mockResolvedValueOnce("https://example.com/login#code=foreign");
    const node = createMemoryNode(ops);
    expect(await node.act("open")).toMatchObject({ _tag: "failed" });
    expect(await node.act("open")).toMatchObject({ _tag: "ready" });
    ops.login.mockResolvedValueOnce("https://localhost:5175/login#code=another-node");
    expect(await node.relogin(origin)).toBeNull();
    expect(await node.relogin(origin)).toBe("test-code");
  });
});

it("parses the login code only from the login page fragment", () => {
  expect(parseLoginUrl("warning\n" + signedInUrl)?.code).toBe("test-code");
  expect(parseLoginUrl(origin + "/topics/tools#code=other")).toBeNull();
  expect(parseLoginUrl(origin + "/login?code=other")).toBeNull();
  expect(parseLoginUrl("see " + signedInUrl)).toBeNull();
});
