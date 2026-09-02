import type { ReactElement, ReactNode } from "react";
import { figures } from "./figures";

/**
 * OG 이미지(satori)용: 도형 React 엘리먼트를 순수 SVG 마크업으로 직렬화한다.
 * satori의 인라인 <svg> 지원이 불안정하므로 base64 data URI <img>로 전달한다.
 */

const attrName = (k: string) =>
  k === "viewBox" ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function ser(node: ReactNode): string {
  if (node == null || node === false || node === true) return "";
  if (Array.isArray(node)) return node.map(ser).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  const el = node as ReactElement<Record<string, unknown>>;
  const type = el.type;
  if (typeof type === "function") {
    return ser((type as (p: unknown) => ReactNode)(el.props ?? {}));
  }
  const props = (el.props ?? {}) as Record<string, unknown>;
  const attrs = Object.entries(props)
    .filter(([k, v]) => k !== "children" && k !== "key" && v != null)
    .map(([k, v]) => ` ${attrName(k)}="${String(v)}"`)
    .join("");
  const kids = ser(props.children as ReactNode);
  return `<${String(type)}${attrs}>${kids}</${String(type)}>`;
}

export function figureDataUri(slug: string, w: number, h: number): string {
  const Fig = figures[slug];
  if (!Fig) return "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="${w}" height="${h}"><rect x="0" y="0" width="200" height="140" fill="#ffffff"></rect>${ser(
    Fig()
  )}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
