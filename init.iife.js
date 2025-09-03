(function(global) {
  'use strict';

  // --- robust feature detection for clip-path: path(...) ---
  var supportsClipPathPath = (function () {
    try {
      if (CSS && CSS.supports && CSS.supports('clip-path', 'path("M0 0 H 10 V 10 H 0 Z")')) {
        return true;
      }
      // Fallback probe attached to DOM for engines that only resolve when in document
      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:10px;height:10px;';
      document.documentElement.appendChild(probe);
      probe.style.clipPath = 'path("M0 0 H 10 V 10 H 0 Z")';
      var ok = !!getComputedStyle(probe).clipPath;
      probe.remove();
      return ok;
    } catch (e) {
      return false;
    }
  })();

  // Corner Smoothing Init Helper - IIFE Build

  function getSvgPath({ width, height, cornerRadius, cornerSmoothing, preserveSmoothing = true }) {
    const r = Math.min(cornerRadius, width / 2, height / 2);
    const smoothing = cornerSmoothing;
    const cp = r * (1 - smoothing * 0.552284749831);
    const cpSmooth = r * smoothing * 0.552284749831;

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

  let squircleCounter = 0;

function renderSquircle(element, options) {
  const { cornerRadius, cornerSmoothing, preserveSmoothing = true, borderWidth } = options;

  console.log('[renderSquircle] start →', element);
  console.log(' └ options:', { cornerRadius, cornerSmoothing, borderWidth });

  const rect = element.getBoundingClientRect();
  console.log(' └ rect:', rect.width + 'x' + rect.height);

  if (!supportsClipPathPath) {
    console.warn('[renderSquircle] clip-path not supported → fallback');
    return;
  }
  if (rect.width <= 0 || rect.height <= 0) {
    console.warn('[renderSquircle] element has 0 size, skipping');
    return;
  }

  const svgPath = getSvgPath({
    width: rect.width,
    height: rect.height,
    cornerRadius,
    cornerSmoothing,
    preserveSmoothing
  });

  if (borderWidth && borderWidth > 0) {
    console.log('[renderSquircle] BORDER mode');
    element.style.clipPath = `path("${svgPath}")`;
  } else {
    console.log('[renderSquircle] SIMPLE mode');
    element.style.clipPath = `path("${svgPath}")`;
  }
  console.log(' └ applied style.clipPath =', element.style.clipPath);
}

function squircleObserver(element, options) {
  console.log('[squircleObserver] attach observer to', element);
  renderSquircle(element, options);

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === element) {
        console.log('[squircleObserver] resize triggered');
        renderSquircle(element, options);
      }
    }
  });
  observer.observe(element);
  return observer;
}

  const elementObservers = new WeakMap();

  function isTransparentColor(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return true;
    const rgbaMatch = color.match(/rgba?\(([^)]+)\)/i);
    if (rgbaMatch) {
      const values = rgbaMatch[1].split(',').map(v => v.trim());
      if (values.length === 4 && parseFloat(values[3]) === 0) return true;
    }
    return false;
  }

  function getBorderInfo(element) {
    const computed = getComputedStyle(element);
    const borderWidth = parseFloat(computed.borderTopWidth) || 0;
    const borderColor = computed.borderTopColor;
    const borderStyle = computed.borderTopStyle;
    const hasSolidBorder = borderWidth > 0 && borderStyle !== 'none' && !isTransparentColor(borderColor);
    return { width: hasSolidBorder ? borderWidth : 0, color: borderColor, hasSolidBorder };
  }

  function getBackgroundInfo(element) {
    const computed = getComputedStyle(element);
    const backgroundColor = computed.backgroundColor;
    const backgroundImage = computed.backgroundImage;
    const hasGradient = backgroundImage && backgroundImage !== 'none';
    const hasSolidBackground = !isTransparentColor(backgroundColor);
    let innerBackground = '';
    if (hasGradient) innerBackground = computed.background;
    else if (hasSolidBackground) innerBackground = backgroundColor;
    return { inner: innerBackground, hasGradient, hasSolidBackground };
  }
  

  function initializeElement(element) {
      console.log('[initializeElement] candidate:', element);

  const cs = element.getAttribute('data-corner-smoothing');
  const cr = element.getAttribute('data-corner-radius');
  console.log(' └ attributes:', { cs, cr });

    if (elementObservers.has(element)) return;

    const cornerSmoothingAttr = element.getAttribute('data-corner-smoothing');
    const cornerRadiusAttr = element.getAttribute('data-corner-radius');
    if (!cornerSmoothingAttr) return;

    const cornerSmoothing = Math.max(0, Math.min(1, parseFloat(cornerSmoothingAttr) || 1));
    let cornerRadius;
    if (cornerRadiusAttr) {
      cornerRadius = parseFloat(cornerRadiusAttr) || 16;
    } else {
      const computed = getComputedStyle(element);
      cornerRadius = parseFloat(computed.borderTopLeftRadius) || 16;
    }

    const borderInfo = getBorderInfo(element);
    const backgroundInfo = getBackgroundInfo(element);

    const options = { cornerRadius, cornerSmoothing, preserveSmoothing: true };
    if (borderInfo.hasSolidBorder) {
      options.borderWidth = borderInfo.width;
      element.style.background = borderInfo.color;
      if (backgroundInfo.inner) {
        element.style.setProperty('--squircle-inner-bg', backgroundInfo.inner);
      }
    }

    try {
      const observer = squircleObserver(element, options);
      elementObservers.set(element, { observer, options });
    } catch (error) {
      console.warn('Failed to initialize corner smoothing on element:', error);
    }
  }

  function scan(root) {
    root = root || document;
    const elements = root.querySelectorAll('[data-corner-smoothing]');
    elements.forEach(function(element) {
      if (element instanceof HTMLElement) initializeElement(element);
    });
  }

  function disconnect(element) {
    const data = elementObservers.get(element);
    if (data) {
      data.observer.disconnect();
      elementObservers.delete(element);
      element.style.clipPath = '';
      element.style.removeProperty('--squircle-inner-bg');
      const classes = Array.from(element.classList);
      classes.forEach(function(className) {
        if (className.startsWith('squircle-')) {
          element.classList.remove(className);
          const styleElement = document.getElementById('squircle-style-' + className);
          if (styleElement) styleElement.remove();
        }
      });
    }
  }

  function onDOMReady(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback);
    else callback();
  }

  global.CornerSmoothingInit = {
    scan: scan,
    disconnect: disconnect,
    onDOMReady: onDOMReady
  };

})(typeof window !== 'undefined' ? window : this);
