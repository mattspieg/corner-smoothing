// Corner Smoothing Vanilla - ESM Build
// Bundled with figma-squircle for browser use

// Figma-squircle implementation
function getSvgPath({ width, height, cornerRadius, cornerSmoothing, preserveSmoothing = true }) {
  const r = Math.min(cornerRadius, width / 2, height / 2);
  const smoothing = cornerSmoothing;
  
  // Calculate control points for smooth curves
  const cp = r * (1 - smoothing * 0.552284749831);
  const cpSmooth = r * smoothing * 0.552284749831;
  
  // Generate SVG path with smooth corners
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

// Global counter for unique class names
let squircleCounter = 0;

/**
 * Renders a squircle shape on an element using clip-path or border mode
 */
export function renderSquircle(element, options) {
  const {
    cornerRadius,
    cornerSmoothing,
    preserveSmoothing = true,
    borderWidth
  } = options;

  // Check if clip-path is supported
  if (!CSS.supports('clip-path', 'path("")')) {
    console.warn('clip-path with path() not supported, falling back to border-radius');
    return;
  }

  const rect = element.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  if (width <= 0 || height <= 0) {
    return;
  }

  // Generate SVG path for the squircle
  const svgPath = getSvgPath({
    width,
    height,
    cornerRadius,
    cornerSmoothing,
    preserveSmoothing
  });

  if (borderWidth && borderWidth > 0) {
    // Border mode: use ::before pseudo-element
    const className = `squircle-${++squircleCounter}`;
    element.classList.add(className);

    // Create outer path (full size)
    const outerPath = getSvgPath({
      width,
      height,
      cornerRadius,
      cornerSmoothing,
      preserveSmoothing
    });

    // Create inner path (reduced by border width)
    const innerWidth = Math.max(0, width - borderWidth * 2);
    const innerHeight = Math.max(0, height - borderWidth * 2);
    const innerRadius = Math.max(0, cornerRadius - borderWidth);
    
    const innerPath = getSvgPath({
      width: innerWidth,
      height: innerHeight,
      cornerRadius: innerRadius,
      cornerSmoothing,
      preserveSmoothing
    });

    // Apply outer clip-path to the element
    element.style.clipPath = `path("${outerPath}")`;

    // Create or update style for the ::before pseudo-element
    let styleElement = document.getElementById(`squircle-style-${className}`);
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = `squircle-style-${className}`;
      document.head.appendChild(styleElement);
    }

    const innerOffsetX = borderWidth;
    const innerOffsetY = borderWidth;

    styleElement.textContent = `
      .${className}::before {
        content: '';
        position: absolute;
        top: ${innerOffsetY}px;
        left: ${innerOffsetX}px;
        width: ${innerWidth}px;
        height: ${innerHeight}px;
        clip-path: path("${innerPath}");
        background: var(--squircle-inner-bg, inherit);
        pointer-events: none;
      }
    `;

    // Ensure element has position relative for ::before positioning
    if (getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
    }
  } else {
    // Simple clip-path mode
    element.style.clipPath = `path("${svgPath}")`;
  }
}

/**
 * Creates a ResizeObserver that automatically updates the squircle when the element resizes
 */
export function squircleObserver(element, options) {
  // Initial render
  renderSquircle(element, options);

  // Create observer for resize updates
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