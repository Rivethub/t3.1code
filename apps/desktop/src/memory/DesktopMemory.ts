// @effect-diagnostics nodeBuiltinImport:off -- This Electron adapter owns the native CLI processes and reads the node’s TLS certificate.
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";
import { nativeTheme, session, shell } from "electron";
import {
  loopbackHttpUrl,
  MEMORY_INSTALL_COMMAND,
  MEMORY_PARTITION,
  memoryLinkPath,
} from "@t3tools/contracts";

import { MEMORY_APPEARANCE_CHANNEL, MEMORY_APPEARANCE_CHANGED_CHANNEL } from "../ipc/channels.ts";
import { createMemoryNode } from "./Node.ts";

const execute = NodeUtil.promisify(NodeChildProcess.execFile);

export function makeDesktopMemory(platform: string, home: string, env: NodeJS.ProcessEnv) {
  const paths = [
    ...(env.PATH ?? "").split(NodePath.delimiter),
    NodePath.join(home, ".local", "bin"),
  ].filter(NodePath.isAbsolute);
  const childEnv = { ...env, PATH: paths.join(NodePath.delimiter) };
  const run = async (binary: string, args: string[], timeout = 10_000) =>
    (await execute(binary, args, { env: childEnv, timeout, maxBuffer: 128 * 1024 })).stdout;

  return createMemoryNode({
    supported: platform === "linux" || platform === "darwin",
    async find() {
      for (const path of paths) {
        const binary = NodePath.join(path, "rh");
        try {
          await NodeFSP.access(binary, NodeFS.constants.X_OK);
          if ((await NodeFSP.stat(binary)).isFile()) return binary;
        } catch {}
      }
      return null;
    },
    async status(rh) {
      const output = await run(rh, ["status"]).catch(() => "");
      if (output.startsWith("RivetHub is not running")) return "stopped";
      if (output.startsWith("RivetHub is running") && !output.includes("health unavailable"))
        return "running";
      throw new Error("RivetHub health could not be determined. Run rh status for details.");
    },
    login: (rh) =>
      run(rh, ["open", "--no-browser"]).catch(() => {
        throw new Error(
          "RivetHub could not create a sign-in link. Run rh status and check local authentication.",
        );
      }),
    async probe(origin) {
      const url = new URL(origin);
      const certificateFile = NodePath.join(
        env.RIVETHUB_HOME || NodePath.join(home, ".rivethub"),
        "tls",
        "holder.cert.pem",
      );
      const fingerprint = await NodeFSP.readFile(certificateFile, "utf8").then(
        (pem) => new NodeCrypto.X509Certificate(pem).fingerprint256,
        () => null,
      );
      const partition = session.fromPartition(MEMORY_PARTITION);
      partition.setPermissionCheckHandler(
        (_contents, permission) => permission === "clipboard-sanitized-write",
      );
      partition.setPermissionRequestHandler((_contents, permission, reply) =>
        reply(permission === "clipboard-sanitized-write"),
      );
      // Electron's certificate verifier lacks a port. Keep the pin usable only on the node's origin.
      partition.webRequest.onBeforeRequest((request, reply) => {
        const requestUrl = request.url.replace(/^ws(s?):/iu, "http$1:");
        const isPinnedHost = URL.parse(requestUrl)?.hostname === url.hostname;
        const isLocal = loopbackHttpUrl(requestUrl) !== null;
        const frame = request.resourceType === "mainFrame" || request.resourceType === "subFrame";
        reply({
          cancel: (frame || isLocal || isPinnedHost) && memoryLinkPath(origin, requestUrl) === null,
        });
      });
      partition.setCertificateVerifyProc((request, reply) => {
        if (request.hostname === url.hostname && fingerprint !== null) {
          try {
            if (
              new NodeCrypto.X509Certificate(request.certificate.data).fingerprint256 ===
              fingerprint
            ) {
              reply(0);
              return;
            }
          } catch {}
        }
        reply(-3);
      });
      try {
        const response = await partition.fetch(new URL("/", origin).href, {
          redirect: "manual",
          credentials: "omit",
          signal: AbortSignal.timeout(8_000),
        });
        void response.body?.cancel().catch(() => {});
        return response.status;
      } catch {
        throw new Error(
          "The RivetHub web app could not be reached. Check rh status and the node’s TLS configuration.",
        );
      }
    },
    install: (write) =>
      new Promise((resolve, reject) => {
        const child = NodeChildProcess.spawn(
          "bash",
          ["-o", "pipefail", "-c", MEMORY_INSTALL_COMMAND],
          {
            env: childEnv,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        const fail = () =>
          reject(
            new Error(
              "The RivetHub installer failed. Run the displayed command in a terminal for details.",
            ),
          );
        for (const stream of [child.stdout, child.stderr]) {
          let buffer = "";
          stream.setEncoding("utf8");
          stream.on("data", (chunk: string) => {
            const lines = (buffer + chunk).split(/\r?\n/u);
            buffer = (lines.pop() ?? "").slice(0, 8192);
            for (const line of lines) write(redactInstallerLine(line));
          });
          stream.on("end", () => {
            if (buffer) write(redactInstallerLine(buffer));
          });
        }
        child.once("error", fail);
        child.once("close", (code) => {
          if (code === 0) resolve();
          else fail();
        });
      }),
    async start(rh) {
      const service =
        platform === "linux" &&
        (await run("systemctl", [
          "--user",
          "show",
          "--property=LoadState",
          "--value",
          "rivethub.service",
        ]).then(
          (output) => output.trim() === "loaded",
          () => false,
        ));
      const args = service ? ["service", "start"] : ["local", "--ensure", "--wait", "30"];
      await run(rh, args, 40_000).catch(() => {
        throw new Error(
          `RivetHub could not start. Run rh ${args.join(" ")} in a terminal for details.`,
        );
      });
    },
  });
}

function redactInstallerLine(line: string): string {
  return (
    line.replace(
      /(?:https?:\/\/\S*#code=|\b(?:token|password|secret)\s*[:=]\s*)\S+/giu,
      "[redacted]",
    ) + "\n"
  );
}

export function prepareMemoryWebview(contents: Electron.WebContents, origin: string) {
  const appearance = () => (nativeTheme.shouldUseDarkColors ? "dark" : "light");
  contents.ipc.on(MEMORY_APPEARANCE_CHANNEL, (event) => {
    event.returnValue = event.senderFrame === contents.mainFrame ? appearance() : null;
  });
  const updateAppearance = () => {
    if (!contents.isDestroyed()) contents.send(MEMORY_APPEARANCE_CHANGED_CHANNEL, appearance());
  };
  nativeTheme.on("updated", updateAppearance);
  contents.once("destroyed", () => nativeTheme.removeListener("updated", updateAppearance));

  const leaveOrigin = (url: string) => {
    if (!memoryLinkPath(origin, url) && /^https?:\/\//iu.test(url))
      void shell.openExternal(url).catch(() => {});
  };
  contents.on("will-frame-navigate", (event) => {
    if (memoryLinkPath(origin, event.url) !== null) return;
    event.preventDefault();
    if (event.isMainFrame) leaveOrigin(event.url);
  });
  contents.on("will-redirect", (event) => {
    if (memoryLinkPath(origin, event.url) !== null) return;
    event.preventDefault();
    if (event.isMainFrame) leaveOrigin(event.url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (memoryLinkPath(origin, url) === null) leaveOrigin(url);
    else void contents.loadURL(url).catch(() => {});
    return { action: "deny" };
  });
}

export function isMemoryWebview(contents: Electron.WebContents): boolean {
  return session.fromPartition(MEMORY_PARTITION) === contents.session;
}
