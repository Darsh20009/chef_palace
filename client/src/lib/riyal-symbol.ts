const SYMBOL_URL = "/riyal-symbol.svg";

const PATTERN = /(ر\.\u200f?س|ريال\s*سعودي|\bSAR\b|\bSR\b)/g;

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "CODE",
  "PRE",
  "SVG",
]);

const PROCESSED_NODES = new WeakSet<Node>();

function makeSymbolElement(): HTMLImageElement {
  const img = document.createElement("img");
  img.src = SYMBOL_URL;
  img.alt = "ريال";
  img.setAttribute("data-riyal-symbol", "true");
  img.style.cssText =
    "display:inline-block;width:0.95em;height:0.95em;vertical-align:-0.15em;margin:0 0.12em;object-fit:contain;";
  return img;
}

function processTextNode(textNode: Text): void {
  if (PROCESSED_NODES.has(textNode)) return;
  const parent = textNode.parentNode as HTMLElement | null;
  if (!parent) return;
  const tag = (parent as HTMLElement).tagName;
  if (!tag || SKIP_TAGS.has(tag)) return;
  if ((parent as HTMLElement).closest?.("[data-no-riyal]")) return;
  if ((parent as HTMLElement).closest?.("[contenteditable='true']")) return;

  const original = textNode.nodeValue || "";
  PATTERN.lastIndex = 0;
  if (!PATTERN.test(original)) return;
  PATTERN.lastIndex = 0;

  const frag = document.createDocumentFragment();
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = PATTERN.exec(original)) !== null) {
    if (match.index > cursor) {
      frag.appendChild(
        document.createTextNode(original.slice(cursor, match.index)),
      );
    }
    const sym = makeSymbolElement();
    PROCESSED_NODES.add(sym);
    frag.appendChild(sym);
    cursor = match.index + match[0].length;
  }
  if (cursor < original.length) {
    frag.appendChild(document.createTextNode(original.slice(cursor)));
  }
  PATTERN.lastIndex = 0;
  parent.replaceChild(frag, textNode);
}

function processSubtree(root: Node): void {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as HTMLElement;
  if (!el.tagName || SKIP_TAGS.has(el.tagName)) return;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n: Node): number => {
      const p = (n as Text).parentNode as HTMLElement | null;
      if (!p || !p.tagName) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      const txt = (n as Text).nodeValue || "";
      PATTERN.lastIndex = 0;
      const ok = PATTERN.test(txt);
      PATTERN.lastIndex = 0;
      return ok ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const collected: Text[] = [];
  let node: Node | null = walker.nextNode();
  while (node) {
    collected.push(node as Text);
    node = walker.nextNode();
  }
  for (const t of collected) processTextNode(t);
}

export function installRiyalSymbol(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if ((window as any).__riyalSymbolInstalled) return;
  (window as any).__riyalSymbolInstalled = true;

  const boot = () => {
    if (document.body) processSubtree(document.body);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        m.addedNodes.forEach((n) => processSubtree(n));
      } else if (
        m.type === "characterData" &&
        m.target &&
        m.target.nodeType === Node.TEXT_NODE
      ) {
        processTextNode(m.target as Text);
      }
    }
  });

  const start = () => {
    if (!document.body) {
      requestAnimationFrame(start);
      return;
    }
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };
  start();
}
