(function(global) {
  'use strict';
  
  // Corner Smoothing Init Helper - IIFE Build
  // Auto-initialization with data attributes

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
  function renderSquircle(element, options) {
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
  function squircleObserver(element, options) {
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

  // Init Helper Implementation
  const elementObservers = new WeakMap();

  /**
   * Parses a CSS color value and returns whether it's transparent
   */
  function isTransparentColor(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return true;
    }
    
    // Check for rgba with 0 alpha
    const rgbaMatch = color.match(/rgba?\\(([^)]+)\\)/);
    if (rgbaMatch) {
      const values = rgbaMatch[1].split(',').map(v => v.trim());
      if (values.length === 4 && parseFloat(values[3]) === 0) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Extracts border information from computed styles
   */
  function getBorderInfo(element) {
    const computed = getComputedStyle(element);
    const borderWidth = parseFloat(computed.borderTopWidth) || 0;
    const borderColor = computed.borderTopColor;
    const borderStyle = computed.borderTopStyle;
    
    const hasSolidBorder = borderWidth > 0 && 
                          borderStyle !== 'none' && 
                          !isTransparentColor(borderColor);
    
    return {
      width: hasSolidBorder ? borderWidth : 0,
      color: borderColor,
      hasSolidBorder
    };
  }

  /**
   * Extracts background information from computed styles
   */
  function getBackgroundInfo(element) {
    const computed = getComputedStyle(element);
    const backgroundColor = computed.backgroundColor;
    const backgroundImage = computed.backgroundImage;
    
    const hasGradient = backgroundImage && backgroundImage !== 'none';
    const hasSolidBackground = !isTransparentColor(backgroundColor);
    
    let innerBackground = '';
    if (hasGradient) {
      // Use the full background shorthand to preserve gradients
      innerBackground = computed.background;
    } else if (hasSolidBackground) {
      innerBackground = backgroundColor;
    }
    
    return {
      inner: innerBackground,
      hasGradient,
      hasSolidBackground
    };
  }

  /**
   * Initializes corner smoothing on a single element
   */
  function initializeElement(element) {
    // Skip if already initialized
    if (elementObservers.has(element)) {
      return;
    }

    const cornerSmoothingAttr = element.getAttribute('data-corner-smoothing');
    const cornerRadiusAttr = element.getAttribute('data-corner-radius');
    
    if (!cornerSmoothingAttr) {
      return;
    }

    // Parse corner smoothing (0-1)
    const cornerSmoothing = Math.max(0, Math.min(1, parseFloat(cornerSmoothingAttr) || 1));
    
    // Parse or derive corner radius
    let cornerRadius;
    if (cornerRadiusAttr) {
      cornerRadius = parseFloat(cornerRadiusAttr) || 16;
    } else {
      const computed = getComputedStyle(element);
      const borderRadius = parseFloat(computed.borderTopLeftRadius) || 16;
      cornerRadius = borderRadius;
    }

    // Check for border mode
    const borderInfo = getBorderInfo(element);
    const backgroundInfo = getBackgroundInfo(element);
    
    const options = {
      cornerRadius,
      cornerSmoothing,
      preserveSmoothing: true
    };

    // Handle border mode
    if (borderInfo.hasSolidBorder) {
      options.borderWidth = borderInfo.width;
      
      // Set element background to border color
      element.style.background = borderInfo.color;
      
      // Set CSS variable for inner background
      if (backgroundInfo.inner) {
        element.style.setProperty('--squircle-inner-bg', backgroundInfo.inner);
      }
    }

    // Create observer
    try {
      const observer = squircleObserver(element, options);
      elementObservers.set(element, { observer, options });
    } catch (error) {
      console.warn('Failed to initialize corner smoothing on element:', error);
    }
  }

  /**
   * Scans for elements with data-corner-smoothing attribute and initializes them
   */
  function scan(root) {
    root = root || document;
    const elements = root.querySelectorAll('[data-corner-smoothing]');
    elements.forEach(function(element) {
      if (element instanceof HTMLElement) {
        initializeElement(element);
      }
    });
  }

  /**
   * Disconnects observer and cleans up for a specific element
   */
  function disconnect(element) {
    const data = elementObservers.get(element);
    if (data) {
      data.observer.disconnect();
      elementObservers.delete(element);
      
      // Clean up styles
      element.style.clipPath = '';
      element.style.removeProperty('--squircle-inner-bg');
      
      // Remove any generated squircle classes
      const classes = Array.from(element.classList);
      classes.forEach(function(className) {
        if (className.startsWith('squircle-')) {
          element.classList.remove(className);
          
          // Remove associated style element
          const styleElement = document.getElementById('squircle-style-' + className);
          if (styleElement) {
            styleElement.remove();
          }
        }
      });
    }
  }

  /**
   * Waits for DOM to be ready
   */
  function onDOMReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  // Export to global
  global.CornerSmoothingInit = {
    scan: scan,
    disconnect: disconnect,
    onDOMReady: onDOMReady
  };

})(typeof window !== 'undefined' ? window : this);