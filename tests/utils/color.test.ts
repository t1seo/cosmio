import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex, withOpacity, lerpColor } from '../../src/utils/color.js';

describe('hexToRgb', () => {
  it('should parse a hex color with # prefix', () => {
    const result = hexToRgb('#7C3AED');
    expect(result).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('should parse a hex color without # prefix', () => {
    const result = hexToRgb('7C3AED');
    expect(result).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('should parse pure red', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('should parse pure green', () => {
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('should parse pure blue', () => {
    expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('should parse black', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('should parse white', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('should handle lowercase hex', () => {
    expect(hexToRgb('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
  });
});

describe('rgbToHex', () => {
  it('should convert RGB to hex', () => {
    expect(rgbToHex(124, 58, 237)).toBe('#7c3aed');
  });

  it('should convert pure red', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
  });

  it('should convert black', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('should convert white', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });

  it('should clamp values greater than 255', () => {
    expect(rgbToHex(300, 256, 999)).toBe('#ffffff');
  });

  it('should clamp values less than 0', () => {
    expect(rgbToHex(-10, -50, -1)).toBe('#000000');
  });

  it('should clamp mixed out-of-range values', () => {
    expect(rgbToHex(300, 128, -5)).toBe('#ff8000');
  });

  it('should round fractional values', () => {
    expect(rgbToHex(127.6, 0.4, 255)).toBe('#8000ff');
  });
});

describe('withOpacity', () => {
  it('should return rgba string with given opacity', () => {
    expect(withOpacity('#FF0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('should handle full opacity', () => {
    expect(withOpacity('#00FF00', 1)).toBe('rgba(0, 255, 0, 1)');
  });

  it('should handle zero opacity', () => {
    expect(withOpacity('#0000FF', 0)).toBe('rgba(0, 0, 255, 0)');
  });

  it('should clamp opacity above 1', () => {
    expect(withOpacity('#FF0000', 1.5)).toBe('rgba(255, 0, 0, 1)');
  });

  it('should clamp opacity below 0', () => {
    expect(withOpacity('#FF0000', -0.5)).toBe('rgba(255, 0, 0, 0)');
  });

  it('should work with hex without # prefix', () => {
    expect(withOpacity('FF8800', 0.75)).toBe('rgba(255, 136, 0, 0.75)');
  });
});

describe('lerpColor', () => {
  it('should interpolate between red and blue at midpoint', () => {
    const result = lerpColor('#FF0000', '#0000FF', 0.5);
    expect(result).toBe('#800080');
  });

  it('should return colorA when t=0', () => {
    const result = lerpColor('#FF0000', '#0000FF', 0);
    expect(result).toBe('#ff0000');
  });

  it('should return colorB when t=1', () => {
    const result = lerpColor('#FF0000', '#0000FF', 1);
    expect(result).toBe('#0000ff');
  });

  it('should interpolate between black and white', () => {
    const result = lerpColor('#000000', '#FFFFFF', 0.5);
    expect(result).toBe('#808080');
  });

  it('should interpolate at quarter point', () => {
    const result = lerpColor('#000000', '#FFFFFF', 0.25);
    expect(result).toBe('#404040');
  });

  it('should return same color when both inputs are identical', () => {
    const result = lerpColor('#7C3AED', '#7C3AED', 0.5);
    expect(result).toBe('#7c3aed');
  });
});
