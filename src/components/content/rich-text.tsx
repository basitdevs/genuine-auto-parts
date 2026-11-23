import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Tiny, safe Markdown subset for admin-edited copy (FAQ answers, policy pages).
 * Never renders HTML: text becomes React nodes, so pasted markup can't inject anything.
 *   ## Heading   ### Subheading   - bullet   1. numbered   **bold**   [text](/path or https://…)
 * Blank lines separate paragraphs.
 */
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\((?:\/[^\s)]*|https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\))/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      return href.startsWith("/") ? (
        <Link key={key} href={href}>{label}</Link>
      ) : (
        <a key={key} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {label}
        </a>
      );
    }
    return part;
  });
}

export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: ReactNode[] = [];
  blocks.forEach((block, b) => {
    const lines = block.split("\n");
    if (lines[0].startsWith("### ")) {
      out.push(<h3 key={b}>{inline(lines[0].slice(4), `h${b}`)}</h3>);
      if (lines.length > 1) out.push(<p key={`${b}p`}>{inline(lines.slice(1).join(" "), `p${b}`)}</p>);
    } else if (lines[0].startsWith("## ")) {
      out.push(<h2 key={b}>{inline(lines[0].slice(3), `h${b}`)}</h2>);
      if (lines.length > 1) out.push(<p key={`${b}p`}>{inline(lines.slice(1).join(" "), `p${b}`)}</p>);
    } else if (lines.every((l) => /^[-*] /.test(l))) {
      out.push(<ul key={b}>{lines.map((l, i) => <li key={i}>{inline(l.slice(2), `u${b}${i}`)}</li>)}</ul>);
    } else if (lines.every((l) => /^\d+[.)] /.test(l))) {
      out.push(<ol key={b}>{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\d+[.)] /, ""), `o${b}${i}`)}</li>)}</ol>);
    } else {
      out.push(<p key={b}>{inline(lines.join(" "), `p${b}`)}</p>);
    }
  });
  return <div className={className}>{out}</div>;
}
