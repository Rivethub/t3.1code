import { createFileRoute } from "@tanstack/react-router";

import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import { SidebarInset } from "../components/ui/sidebar";
import { MemoryPane } from "../memory/MemoryPane";

export const Route = createFileRoute("/_chat/memory")({
  validateSearch: (input: Record<string, unknown>): { path?: string } =>
    typeof input.path === "string" ? { path: input.path } : {},
  component: MemoryPage,
});

function MemoryPage() {
  const { path } = Route.useSearch();
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden">
      <WorkspacePageHeader electron={Boolean(window.desktopBridge)} />
      <MemoryPane key={path} {...(path ? { path } : {})} />
    </SidebarInset>
  );
}
