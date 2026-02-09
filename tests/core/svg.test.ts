import { describe, it, expect } from 'vitest';
import {
  svgElement,
  svgRoot,
  svgDefs,
  svgStyle,
  svgGroup,
  svgText,
  svgFilter,
  svgGradient,
  formatNumber,
  escapeXml,
} from '../../src/core/svg.js';

// ── svgElement ─────────────────────────────────────────────────────

describe('svgElement', () => {
  it('should generate a self-closing element without children', () => {
    const result = svgElement('rect', { x: '0', y: '0', width: '100', height: '50' });
    expect(result).toBe('<rect x="0" y="0" width="100" height="50"/>');
  });

  it('should generate an element with children', () => {
    const result = svgElement('g', { id: 'group1' }, '<rect/>');
    expect(result).toBe('<g id="group1"><rect/></g>');
  });

  it('should handle empty children string', () => {
    const result = svgElement('g', { id: 'empty' }, '');
    expect(result).toBe('<g id="empty"></g>');
  });

  it('should handle numeric attribute values', () => {
    const result = svgElement('circle', { cx: 50, cy: 50, r: 25 });
    expect(result).toBe('<circle cx="50" cy="50" r="25"/>');
  });

  it('should handle empty attributes', () => {
    const result = svgElement('g', {}, '<rect/>');
    expect(result).toBe('<g ><rect/></g>');
  });

  it('should handle multiple children as string', () => {
    const children = '<rect/><circle/>';
    const result = svgElement('g', { id: 'multi' }, children);
    expect(result).toBe('<g id="multi"><rect/><circle/></g>');
  });
});

// ── svgRoot ────────────────────────────────────────────────────────

describe('svgRoot', () => {
  it('should include xmlns attribute', () => {
    const result = svgRoot({}, 'content');
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('should include default viewBox', () => {
    const result = svgRoot({}, 'content');
    expect(result).toContain('viewBox="0 0 840 240"');
  });

  it('should wrap content in svg tags', () => {
    const result = svgRoot({}, '<rect/>');
    expect(result).toMatch(/^<svg .+><rect\/><\/svg>$/);
  });

  it('should allow custom attributes to override defaults', () => {
    const result = svgRoot({ viewBox: '0 0 100 100' }, 'content');
    expect(result).toContain('viewBox="0 0 100 100"');
    expect(result).not.toContain('viewBox="0 0 840 240"');
  });

  it('should include additional custom attributes', () => {
    const result = svgRoot({ width: '800', height: '200' }, 'content');
    expect(result).toContain('width="800"');
    expect(result).toContain('height="200"');
  });
});

// ── svgDefs ────────────────────────────────────────────────────────

describe('svgDefs', () => {
  it('should wrap content in defs tags', () => {
    const result = svgDefs('<filter id="blur"/>');
    expect(result).toBe('<defs><filter id="blur"/></defs>');
  });

  it('should handle empty content', () => {
    const result = svgDefs('');
    expect(result).toBe('<defs></defs>');
  });
});

// ── svgStyle ───────────────────────────────────────────────────────

describe('svgStyle', () => {
  it('should wrap CSS in CDATA', () => {
    const result = svgStyle('.cls { fill: red; }');
    expect(result).toBe('<style><![CDATA[.cls { fill: red; }]]></style>');
  });

  it('should handle empty CSS', () => {
    const result = svgStyle('');
    expect(result).toBe('<style><![CDATA[]]></style>');
  });

  it('should preserve complex CSS', () => {
    const css = '@keyframes fade { 0% { opacity: 0; } 100% { opacity: 1; } }';
    const result = svgStyle(css);
    expect(result).toContain(css);
    expect(result).toContain('<![CDATA[');
    expect(result).toContain(']]>');
  });
});

// ── svgGroup ───────────────────────────────────────────────────────

describe('svgGroup', () => {
  it('should generate a g element with attributes and children', () => {
    const result = svgGroup({ id: 'layer1', opacity: '0.5' }, '<rect/>');
    expect(result).toBe('<g id="layer1" opacity="0.5"><rect/></g>');
  });

  it('should handle empty children', () => {
    const result = svgGroup({ id: 'empty' }, '');
    expect(result).toBe('<g id="empty"></g>');
  });

  it('should handle transform attribute', () => {
    const result = svgGroup({ transform: 'translate(10, 20)' }, '<circle/>');
    expect(result).toContain('transform="translate(10, 20)"');
  });
});

// ── svgText ────────────────────────────────────────────────────────

describe('svgText', () => {
  it('should generate a text element with x, y, and content', () => {
    const result = svgText(10, 20, 'Hello');
    expect(result).toContain('x="10"');
    expect(result).toContain('y="20"');
    expect(result).toContain('>Hello</text>');
  });

  it('should include additional attributes', () => {
    const result = svgText(0, 0, 'Text', { 'font-size': '14', fill: '#fff' });
    expect(result).toContain('font-size="14"');
    expect(result).toContain('fill="#fff"');
  });

  it('should escape XML special characters in text content', () => {
    const result = svgText(0, 0, 'A & B <C>');
    expect(result).toContain('A &amp; B &lt;C&gt;');
    expect(result).not.toContain('A & B <C>');
  });

  it('should escape quotes in text content', () => {
    const result = svgText(0, 0, 'He said "hello" & \'bye\'');
    expect(result).toContain('&quot;');
    expect(result).toContain('&apos;');
  });
});

// ── svgFilter ──────────────────────────────────────────────────────

describe('svgFilter', () => {
  it('should include default position and size attributes', () => {
    const result = svgFilter('blur', '<feGaussianBlur/>');
    expect(result).toContain('id="blur"');
    expect(result).toContain('x="-50%"');
    expect(result).toContain('y="-50%"');
    expect(result).toContain('width="200%"');
    expect(result).toContain('height="200%"');
  });

  it('should wrap content in filter tags', () => {
    const result = svgFilter('test', '<feGaussianBlur stdDeviation="5"/>');
    expect(result).toMatch(/^<filter .+>.*<\/filter>$/);
    expect(result).toContain('<feGaussianBlur stdDeviation="5"/>');
  });

  it('should allow custom attributes to override defaults', () => {
    const result = svgFilter('custom', '<feTurbulence/>', {
      x: '0',
      y: '0',
      width: '100%',
      height: '100%',
    });
    expect(result).toContain('x="0"');
    expect(result).toContain('y="0"');
    expect(result).toContain('width="100%"');
    expect(result).toContain('height="100%"');
  });

  it('should preserve filter ID when custom attrs are provided', () => {
    const result = svgFilter('myFilter', '<feTurbulence/>', { filterUnits: 'userSpaceOnUse' });
    expect(result).toContain('id="myFilter"');
    expect(result).toContain('filterUnits="userSpaceOnUse"');
  });
});

// ── svgGradient ────────────────────────────────────────────────────

describe('svgGradient', () => {
  it('should generate a linear gradient', () => {
    const result = svgGradient('linear', 'grad1', [
      { offset: '0%', color: '#ff0000' },
      { offset: '100%', color: '#0000ff' },
    ]);

    expect(result).toContain('<linearGradient');
    expect(result).toContain('id="grad1"');
    expect(result).toContain('</linearGradient>');
  });

  it('should generate a radial gradient', () => {
    const result = svgGradient('radial', 'grad2', [
      { offset: '0%', color: '#ffffff' },
      { offset: '100%', color: '#000000' },
    ]);

    expect(result).toContain('<radialGradient');
    expect(result).toContain('id="grad2"');
    expect(result).toContain('</radialGradient>');
  });

  it('should generate stop elements with offset and color', () => {
    const result = svgGradient('linear', 'test', [
      { offset: '0%', color: '#ff0000' },
      { offset: '50%', color: '#00ff00' },
      { offset: '100%', color: '#0000ff' },
    ]);

    expect(result).toContain('offset="0%"');
    expect(result).toContain('stop-color="#ff0000"');
    expect(result).toContain('offset="50%"');
    expect(result).toContain('stop-color="#00ff00"');
    expect(result).toContain('offset="100%"');
    expect(result).toContain('stop-color="#0000ff"');
  });

  it('should include stop-opacity when opacity is specified', () => {
    const result = svgGradient('linear', 'test', [
      { offset: '0%', color: '#ff0000', opacity: 0.5 },
      { offset: '100%', color: '#0000ff', opacity: 1 },
    ]);

    expect(result).toContain('stop-opacity="0.5"');
    expect(result).toContain('stop-opacity="1"');
  });

  it('should not include stop-opacity when opacity is not specified', () => {
    const result = svgGradient('linear', 'test', [{ offset: '0%', color: '#ff0000' }]);

    expect(result).not.toContain('stop-opacity');
  });

  it('should handle mixed stops with and without opacity', () => {
    const result = svgGradient('linear', 'test', [
      { offset: '0%', color: '#ff0000', opacity: 0.3 },
      { offset: '100%', color: '#0000ff' },
    ]);

    expect(result).toContain('stop-opacity="0.3"');
    // The second stop should not have stop-opacity — verify by counting occurrences
    const matches = result.match(/stop-opacity/g);
    expect(matches).toHaveLength(1);
  });
});

// ── formatNumber ───────────────────────────────────────────────────

describe('formatNumber', () => {
  it('should format thousands with commas', () => {
    expect(formatNumber(1247)).toBe('1,247');
  });

  it('should leave small numbers unchanged', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('should format millions', () => {
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should handle exactly 1000', () => {
    expect(formatNumber(1000)).toBe('1,000');
  });

  it('should handle large numbers', () => {
    expect(formatNumber(123456789)).toBe('123,456,789');
  });
});

// ── escapeXml ──────────────────────────────────────────────────────

describe('escapeXml', () => {
  it('should escape ampersand', () => {
    expect(escapeXml('A & B')).toBe('A &amp; B');
  });

  it('should escape less-than', () => {
    expect(escapeXml('a < b')).toBe('a &lt; b');
  });

  it('should escape greater-than', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b');
  });

  it('should escape double quotes', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('should escape single quotes (apostrophes)', () => {
    expect(escapeXml("it's")).toBe('it&apos;s');
  });

  it('should escape all special characters together', () => {
    expect(escapeXml('A & B < C > D "E" \'F\'')).toBe(
      'A &amp; B &lt; C &gt; D &quot;E&quot; &apos;F&apos;',
    );
  });

  it('should leave normal text unchanged', () => {
    expect(escapeXml('Hello World 123')).toBe('Hello World 123');
  });

  it('should handle empty string', () => {
    expect(escapeXml('')).toBe('');
  });

  it('should handle multiple ampersands', () => {
    expect(escapeXml('a & b & c')).toBe('a &amp; b &amp; c');
  });
});
