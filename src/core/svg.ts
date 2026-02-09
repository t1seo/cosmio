import type { SvgAttributes } from './types.js';

/**
 * Generate an SVG element string
 * @param tag - SVG element tag name
 * @param attrs - Element attributes
 * @param children - Optional child content
 * @returns SVG element string
 */
export function svgElement(tag: string, attrs: SvgAttributes, children?: string): string {
  const attrString = Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

  if (children !== undefined) {
    return `<${tag} ${attrString}>${children}</${tag}>`;
  }
  return `<${tag} ${attrString}/>`;
}

/**
 * Generate the root SVG element
 * @param attrs - SVG attributes
 * @param content - Inner SVG content
 * @returns Complete SVG string
 */
export function svgRoot(attrs: SvgAttributes, content: string): string {
  const mergedAttrs: SvgAttributes = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 840 240',
    ...attrs,
  };
  return svgElement('svg', mergedAttrs, content);
}

/**
 * Wrap content in defs tags
 * @param content - Definitions content
 * @returns defs element string
 */
export function svgDefs(content: string): string {
  return `<defs>${content}</defs>`;
}

/**
 * Wrap CSS in style tags with CDATA for XML safety
 * @param css - CSS content
 * @returns style element string
 */
export function svgStyle(css: string): string {
  return `<style><![CDATA[${css}]]></style>`;
}

/**
 * Generate an SVG group element
 * @param attrs - Group attributes
 * @param children - Child elements
 * @returns g element string
 */
export function svgGroup(attrs: SvgAttributes, children: string): string {
  return svgElement('g', attrs, children);
}

/**
 * Generate an SVG text element
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param text - Text content
 * @param attrs - Optional additional attributes
 * @returns text element string
 */
export function svgText(x: number, y: number, text: string, attrs?: SvgAttributes): string {
  const mergedAttrs: SvgAttributes = {
    x,
    y,
    ...attrs,
  };
  return svgElement('text', mergedAttrs, escapeXml(text));
}

/**
 * Generate an SVG filter element
 * @param id - Filter ID
 * @param content - Filter primitives
 * @param attrs - Optional additional attributes
 * @returns filter element string
 */
export function svgFilter(id: string, content: string, attrs?: SvgAttributes): string {
  const defaultAttrs: SvgAttributes = {
    id,
    x: '-50%',
    y: '-50%',
    width: '200%',
    height: '200%',
  };
  const mergedAttrs = { ...defaultAttrs, ...attrs };
  return svgElement('filter', mergedAttrs, content);
}

/**
 * Generate an SVG gradient definition
 * @param type - Gradient type (linear or radial)
 * @param id - Gradient ID
 * @param stops - Gradient stops
 * @returns gradient element string
 */
export function svgGradient(
  type: 'linear' | 'radial',
  id: string,
  stops: Array<{ offset: string; color: string; opacity?: number }>,
): string {
  const tag = type === 'linear' ? 'linearGradient' : 'radialGradient';
  const stopsContent = stops
    .map((stop) => {
      const attrs: SvgAttributes = {
        offset: stop.offset,
        'stop-color': stop.color,
      };
      if (stop.opacity !== undefined) {
        attrs['stop-opacity'] = stop.opacity;
      }
      return svgElement('stop', attrs);
    })
    .join('');

  return svgElement(tag, { id }, stopsContent);
}

/**
 * Format a number with comma separators
 * @param n - Number to format
 * @returns Formatted string (e.g., "1,247")
 */
export function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Escape special XML characters
 * @param str - String to escape
 * @returns XML-safe string
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
