import { loopbackHttpUrl } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import type { MouseEvent } from "react";

export function useMemoryLink() {
  const navigate = useNavigate();
  return (event: MouseEvent, href: string, fallback?: () => void) => {
    const bridge = window.desktopBridge;
    if (event.defaultPrevented || !bridge?.memory || !loopbackHttpUrl(href)) return false;
    event.preventDefault();
    event.stopPropagation();
    void bridge.memory
      .link(href)
      .catch(() => null)
      .then((path) => {
        if (path !== null) void navigate({ to: "/memory", search: { path } });
        else if (fallback) fallback();
        else void bridge.openExternal(href).catch(() => {});
      });
    return true;
  };
}

export function linkifyToolOutput(text: string) {
  const pieces: Array<{ offset: number; text: string; href?: string }> = [];
  let cursor = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'\\`]+/giu)) {
    const offset = match.index;
    const href = match[0].replace(/[.,;!?\])}]+$/u, "");
    const url = URL.parse(href);
    if (!url || url.username || url.password) continue;
    if (offset > cursor) pieces.push({ offset: cursor, text: text.slice(cursor, offset) });
    pieces.push({ offset, text: href, href });
    cursor = offset + href.length;
  }
  if (cursor === 0) return null;
  if (cursor < text.length) pieces.push({ offset: cursor, text: text.slice(cursor) });
  return pieces;
}

export function ToolOutputLinks({
  pieces,
}: {
  pieces: NonNullable<ReturnType<typeof linkifyToolOutput>>;
}) {
  const openMemoryLink = useMemoryLink();
  return pieces.map(({ offset, text, href }) =>
    href ? (
      <a
        key={offset}
        className="text-primary underline underline-offset-2"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openMemoryLink(event, href);
        }}
      >
        {text}
      </a>
    ) : (
      text
    ),
  );
}
