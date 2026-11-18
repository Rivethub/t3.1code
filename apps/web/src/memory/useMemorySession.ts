import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { normalizeProjectPathForComparison } from "@t3tools/shared/path";
import type { EnvironmentId, ThreadId, MemoryOpenSessionRequest } from "@t3tools/contracts";

import { useNewThreadHandler } from "../hooks/useHandleNewThread";
import { useScratchProject } from "../hooks/useScratchProject";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { agentSessionImport } from "../state/agentSessions";
import { readProjects } from "../state/entities";
import { environmentSummaries } from "../state/presentation";
import { hostEnvironmentIdAtom, primaryEnvironmentIdAtom } from "../state/primaryEnvironment";
import { useAtomCommand } from "../state/use-atom-command";
import { openMemorySession } from "./openSession";

type Destination =
  | {
      to: "/$environmentId/$threadId";
      params: { environmentId: EnvironmentId; threadId: ThreadId };
    }
  | { to: "/draft/$draftId"; params: { draftId: string } };

function localEnvironment() {
  const local =
    appAtomRegistry.get(hostEnvironmentIdAtom) ?? appAtomRegistry.get(primaryEnvironmentIdAtom);
  return appAtomRegistry
    .get(environmentSummaries.connectedEnvironmentIdsAtom)
    .find((id) => id === local);
}

function matchingProject(environmentId: EnvironmentId, cwd: MemoryOpenSessionRequest["cwd"]) {
  if (!cwd) return undefined;
  const directory = normalizeProjectPathForComparison(cwd);
  return readProjects()
    .filter((project) => project.environmentId === environmentId && !project.archivedAt)
    .map((project) => ({ project, root: normalizeProjectPathForComparison(project.workspaceRoot) }))
    .filter(
      ({ root }) =>
        directory === root || directory.startsWith(root.endsWith("/") ? root : root + "/"),
    )
    .sort((left, right) => right.root.length - left.root.length)[0]?.project;
}

export function useMemorySession() {
  const importSession = useAtomCommand(agentSessionImport, { reportFailure: false });
  const openDraft = useNewThreadHandler();
  const { openScratchProject } = useScratchProject();

  return (raw: unknown) =>
    openMemorySession<Destination>(raw, {
      async resume(request, target) {
        const environmentId = localEnvironment();
        if (!environmentId) return null;
        const project = matchingProject(environmentId, request.cwd);
        const result = await importSession({
          environmentId,
          input: project
            ? { projectId: project.id, expectedWorkspaceRoot: project.workspaceRoot, target }
            : { target },
        });
        if (result._tag !== "Success" || !result.value.threadId) return null;
        return {
          to: "/$environmentId/$threadId",
          params: { environmentId, threadId: result.value.threadId },
        };
      },
      async handoff(request) {
        const environmentId = localEnvironment();
        if (!environmentId) return null;
        const project =
          matchingProject(environmentId, request.cwd) ?? (await openScratchProject(environmentId));
        if (!project) return null;
        const draft = await openDraft(scopeProjectRef(environmentId, project.id), {
          prompt: request.handoffPrompt,
          background: true,
        });
        return draft ? { to: "/draft/$draftId", params: { draftId: draft.draftId } } : null;
      },
    });
}
