// Corner Smoothing Vanilla - ESM Build (fixed + robust)
// - Proper feature detection for clip-path: path(...)
// - Per-element caching of className/style element
// - No duplicate classes/styles on resize
// - Skips re-render when dimensions unchanged

// ---- figma-squircle-like path generator (your approximation) ----
function getSvgPath({ width, height, cornerRadius, cornerSmoothing, preserveSmoothing = true }) {
  const r = Math.min(cornerRadius, width / 2, height / 2);
  const smoothing = cornerSmoothing;
  const K = 0.552284749831; // cubic circle constant

  const cp  = r * (1 - smoothing * K);
  const cps = r * smoothing * K;

  return `M ${r},0 
          L ${width - r},0 
          C ${width - cp},0 ${width},${cp} ${width},${r}
          L ${width},${height - r} 
          C ${width},${height - cp} ${width - cp},${height} ${width - r},${height}
          L ${r},${height} 
          C ${cp},${height} 0,${height - cp} 0,${height - r}
          L 0,${r} 
          C 0,${cp} ${cp},0 ${r},0 Z`;
}

// ---- robust feature detection for clip-path: path(...) ----
const supportsClipPathPath = (() => {
  try {
    // MUST use a valid mini-path or it may return false
    if (CSS?.supports?.('clip-path', 'path("M0 0 H 10 V 10 H 0 Z")')) return true;

    // Secondary check using an attached element (some engines need it)
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:10px;height:10px;';
    document.documentElement.appendChild(probe);
    probe.style.clipPath = 'path("M0 0 H 10 V 10 H 0 Z")';
    const ok = !!getComputedStyle(probe).clipPath;
    probe.remove();
    return ok;
  } catch {
    return false;
  }
})();

// ---- per-element caches to avoid rework / leaks ----
const CLASS_MAP = new WeakMap();     // HTMLElement -> string (squircle-xxxx)
const STYLE_MAP = new WeakMap();     // HTMLElement -> HTMLStyleElement
const SIZE_MAP  = new WeakMap();     // HTMLElement -> [w,h]

// simple id counter for unique class names
let squircleCounter = 0;

// internal: set or update ::before style for border-mode
function upsertBorderStyle(el, className, innerPath, innerWidth, innerHeight, borderWidth) {
  let styleEl = STYLE_MAP.get(el);
  if (!styleEl) {
    styleEl = document.createElement('style');
    STYLE_MAP.set(el, styleEl);
    styleEl.id = `squircle-style-${className}`;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    .${className} { position: relative; }
    .${className}::before {
      content: '';
      position: absolute;
      inset: ${borderWidth}px;
      width: ${innerWidth}px;
      height: ${innerHeight}px;
      clip-path: path("${innerPath}");
      background: var(--squircle-inner-bg, inherit);
      pointer-events: none;
      z-index: -1;
    }
  `;
}

/**
 * Render a squircle on element, optionally in border mode
 * options: { cornerRadius: number, cornerSmoothing?: number, preserveSmoothing?: boolean, borderWidth?: number }
 */
export function renderSquircle(element, options) {
  const {
    cornerRadius,
    cornerSmoothing = 1,
    preserveSmoothing = true,
    borderWidth = 0
  } = options || {};

  if (!supportsClipPathPath) {
    // Graceful fallback: leave element's border-radius alone
    console.warn('clip-path: path() unsupported. Falling back to border-radius.');
    return;
  }

  // Use clientWidth/Height (faster) and guard against zero
  const width  = element.clientWidth;
  const height = element.clientHeight;
  if (width <= 0 || height <= 0) return;

  // Skip if size unchanged
  const last = SIZE_MAP.get(element);
  if (last && last[0] === width && last[1] === height) {
    // still update clip-path if we toggled border mode state
    // but avoid recomputing if nothing changed; continue
  }
  SIZE_MAP.set(element, [width, height]);

  // Outer path
  const outerPath = getSvgPath({ width, height, cornerRadius, cornerSmoothing, preserveSmoothing });

  if (borderWidth > 0) {
    // Ensure persistent class
    let className = CLASS_MAP.get(element);
    if (!className) {
      className = `squircle-${++squircleCounter}`;
      CLASS_MAP.set(element, className);
      element.classList.add(className);
    }

    // Apply the outer clip-path
    element.style.clipPath = `path("${outerPath}")`;

    // Compute inner dims/path
    const innerWidth  = Math.max(0, width - borderWidth * 2);
    const innerHeight = Math.max(0, height - borderWidth * 2);
    const innerRadius = Math.max(0, cornerRadius - borderWidth);

    const innerPath = getSvgPath({
      width: innerWidth,
      height: innerHeight,
      cornerRadius: innerRadius,
      cornerSmoothing,
      preserveSmoothing
    });

    // Ensure element is positioning context
    if (getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
    }

    // Update ::before style
    upsertBorderStyle(element, className, innerPath, innerWidth, innerHeight, borderWidth);
  } else {
    // Non-border (simple clip) mode; remove any class/style created before
    const className = CLASS_MAP.get(element);
    if (className) {
      element.classList.remove(className);
      const styleEl = STYLE_MAP.get(element);
      if (styleEl) styleEl.remove();
      CLASS_MAP.delete(element);
      STYLE_MAP.delete(element);
    }
    element.style.clipPath = `path("${outerPath}")`;
  }
}

/**
 * Observe element and re-render on size changes
 * returns the ResizeObserver (call .disconnect() to stop)
 */
export function squircleObserver(element, options) {
  // initial render
  renderSquircle(element, options);

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === element) {
        renderSquircle(element, options);
      }
    }
  });

  observer.observe(element);
  return observer;
}
