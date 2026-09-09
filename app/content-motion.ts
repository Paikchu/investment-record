export function revealContent(element: HTMLElement | null, kind: "page" | "report" | "return" | "stock" = "page") {
  if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const returning = kind === "return";
  const transform = returning || kind === "stock" ? "none" : kind === "report" ? "translateX(8px)" : "translateY(6px)";
  return element.animate([
    { opacity: returning ? 0.65 : 0, transform },
    { opacity: 1, transform: "none" },
  ], { duration: returning ? 100 : kind === "report" ? 200 : 180, easing: "cubic-bezier(0.25, 1, 0.5, 1)" });
}
