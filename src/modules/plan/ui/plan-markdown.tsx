import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal, safe markdown renderer for plan replies. Supports paragraphs, headings (rendered as
 * bold lines), numbered / bulleted lists (one level), **bold**, *italic* and `code`.
 * Everything is rendered as React text nodes — model output is never injected as HTML.
 */

const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**") || token.startsWith("__")) {
      out.push(<strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      out.push(<code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono">{token.slice(1, -1)}</code>);
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ol" | "ul"; items: string[]; start: number };

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      // Blank line ends paragraphs; lists may continue across a single blank line.
      if (current?.kind === "p") flush();
      continue;
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);

    if (heading) {
      flush();
      blocks.push({ kind: "h", text: heading[1] });
    } else if (ordered) {
      if (current?.kind !== "ol") {
        flush();
        current = { kind: "ol", items: [], start: Number(ordered[1]) || 1 };
      }
      current.items.push(ordered[2]);
    } else if (bullet) {
      if (current?.kind !== "ul") {
        flush();
        current = { kind: "ul", items: [], start: 1 };
      }
      current.items.push(bullet[1]);
    } else if ((current?.kind === "ol" || current?.kind === "ul") && /^\s+/.test(raw)) {
      // Indented continuation of the previous list item.
      current.items[current.items.length - 1] += ` ${line.trim()}`;
    } else {
      if (current?.kind !== "p") {
        flush();
        current = { kind: "p", lines: [] };
      }
      current.lines.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export const PlanMarkdown = ({ content, className }: { content: string; className?: string }) => {
  const blocks = parseBlocks(content);
  return (
    <div className={cn("flex flex-col gap-2 text-sm leading-relaxed break-words [overflow-wrap:anywhere]", className)}>
      {blocks.map((block, b) => {
        const key = `b${b}`;
        if (block.kind === "h") {
          return <p key={key} className="font-semibold">{renderInline(block.text, key)}</p>;
        }
        if (block.kind === "p") {
          return (
            <p key={key}>
              {block.lines.map((l, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {renderInline(l, `${key}-${i}`)}
                </Fragment>
              ))}
            </p>
          );
        }
        const items = block.items.map((item, i) => (
          <li key={i} className="pl-1">{renderInline(item, `${key}-${i}`)}</li>
        ));
        return block.kind === "ol" ? (
          <ol key={key} start={block.start} className="list-decimal pl-5 space-y-1">{items}</ol>
        ) : (
          <ul key={key} className="list-disc pl-5 space-y-1">{items}</ul>
        );
      })}
    </div>
  );
};
