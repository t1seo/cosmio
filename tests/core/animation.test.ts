import { describe, it, expect } from 'vitest';
import {
  smilAnimate,
  smilAnimateTransform,
  cssKeyframes,
  staggerDelay,
} from '../../src/core/animation.js';

// ── smilAnimate ────────────────────────────────────────────────────

describe('smilAnimate', () => {
  it('should generate a basic animate element', () => {
    const result = smilAnimate({
      attributeName: 'opacity',
      values: ['0', '1'],
      dur: '2s',
      repeatCount: 'indefinite',
    });

    expect(result).toContain('<animate');
    expect(result).toContain('attributeName="opacity"');
    expect(result).toContain('values="0;1"');
    expect(result).toContain('dur="2s"');
    expect(result).toContain('repeatCount="indefinite"');
    expect(result).toContain('/>');
  });

  it('should include begin attribute when provided', () => {
    const result = smilAnimate({
      attributeName: 'opacity',
      values: ['0', '1'],
      dur: '1s',
      repeatCount: '1',
      begin: '0.5s',
    });

    expect(result).toContain('begin="0.5s"');
  });

  it('should not include begin attribute when omitted', () => {
    const result = smilAnimate({
      attributeName: 'opacity',
      values: ['0', '1'],
      dur: '1s',
      repeatCount: '1',
    });

    expect(result).not.toContain('begin=');
  });

  it('should default fill to "freeze"', () => {
    const result = smilAnimate({
      attributeName: 'x',
      values: ['0', '100'],
      dur: '3s',
      repeatCount: '1',
    });

    expect(result).toContain('fill="freeze"');
  });

  it('should respect explicit fill="remove"', () => {
    const result = smilAnimate({
      attributeName: 'x',
      values: ['0', '100'],
      dur: '3s',
      repeatCount: '1',
      fill: 'remove',
    });

    expect(result).toContain('fill="remove"');
    expect(result).not.toContain('fill="freeze"');
  });

  it('should join multiple values with semicolons', () => {
    const result = smilAnimate({
      attributeName: 'opacity',
      values: ['0', '0.5', '1', '0.5', '0'],
      dur: '4s',
      repeatCount: 'indefinite',
    });

    expect(result).toContain('values="0;0.5;1;0.5;0"');
  });

  it('should handle numeric repeatCount', () => {
    const result = smilAnimate({
      attributeName: 'opacity',
      values: ['0', '1'],
      dur: '1s',
      repeatCount: 3,
    });

    expect(result).toContain('repeatCount="3"');
  });
});

// ── smilAnimateTransform ───────────────────────────────────────────

describe('smilAnimateTransform', () => {
  it('should generate a basic animateTransform element', () => {
    const result = smilAnimateTransform({
      type: 'rotate',
      values: ['0 50 50', '360 50 50'],
      dur: '3s',
      repeatCount: 'indefinite',
    });

    expect(result).toContain('<animateTransform');
    expect(result).toContain('attributeName="transform"');
    expect(result).toContain('type="rotate"');
    expect(result).toContain('values="0 50 50;360 50 50"');
    expect(result).toContain('dur="3s"');
    expect(result).toContain('repeatCount="indefinite"');
    expect(result).toContain('/>');
  });

  it('should include begin attribute when provided', () => {
    const result = smilAnimateTransform({
      type: 'scale',
      values: ['1', '1.5', '1'],
      dur: '2s',
      repeatCount: 'indefinite',
      begin: '1s',
    });

    expect(result).toContain('begin="1s"');
  });

  it('should not include begin attribute when omitted', () => {
    const result = smilAnimateTransform({
      type: 'translate',
      values: ['0 0', '10 10'],
      dur: '1s',
      repeatCount: '1',
    });

    expect(result).not.toContain('begin=');
  });

  it('should handle translate type', () => {
    const result = smilAnimateTransform({
      type: 'translate',
      values: ['0 0', '50 0', '0 0'],
      dur: '5s',
      repeatCount: 'indefinite',
    });

    expect(result).toContain('type="translate"');
    expect(result).toContain('values="0 0;50 0;0 0"');
  });

  it('should handle scale type', () => {
    const result = smilAnimateTransform({
      type: 'scale',
      values: ['1', '2'],
      dur: '1s',
      repeatCount: '1',
    });

    expect(result).toContain('type="scale"');
  });
});

// ── cssKeyframes ───────────────────────────────────────────────────

describe('cssKeyframes', () => {
  it('should generate @keyframes block and class rule', () => {
    const result = cssKeyframes({
      name: 'fadeIn',
      keyframes: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      duration: '1s',
      easing: 'ease-in',
      iterationCount: '1',
    });

    expect(result).toContain('@keyframes fadeIn');
    expect(result).toContain('0% { opacity: 0; }');
    expect(result).toContain('100% { opacity: 1; }');
    expect(result).toContain('.fadeIn {');
    expect(result).toContain('animation: fadeIn 1s ease-in 1 forwards;');
  });

  it('should include animation-delay when delay is provided', () => {
    const result = cssKeyframes({
      name: 'slideIn',
      keyframes: {
        '0%': { transform: 'translateX(-100%)' },
        '100%': { transform: 'translateX(0)' },
      },
      duration: '0.5s',
      easing: 'ease-out',
      iterationCount: '1',
      delay: '0.3s',
    });

    expect(result).toContain('animation-delay: 0.3s;');
  });

  it('should not include animation-delay when delay is omitted', () => {
    const result = cssKeyframes({
      name: 'pulse',
      keyframes: {
        '0%': { transform: 'scale(1)' },
        '50%': { transform: 'scale(1.1)' },
        '100%': { transform: 'scale(1)' },
      },
      duration: '2s',
      easing: 'ease-in-out',
      iterationCount: 'infinite',
    });

    expect(result).not.toContain('animation-delay');
  });

  it('should default fillMode to "forwards"', () => {
    const result = cssKeyframes({
      name: 'test',
      keyframes: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      duration: '1s',
      easing: 'linear',
      iterationCount: '1',
    });

    expect(result).toContain('forwards');
  });

  it('should respect explicit fillMode', () => {
    const result = cssKeyframes({
      name: 'test',
      keyframes: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      duration: '1s',
      easing: 'linear',
      iterationCount: '1',
      fillMode: 'both',
    });

    expect(result).toContain('both');
    expect(result).not.toContain('forwards');
  });

  it('should handle multiple properties in a single keyframe stop', () => {
    const result = cssKeyframes({
      name: 'multi',
      keyframes: {
        '0%': { opacity: '0', transform: 'scale(0)' },
        '100%': { opacity: '1', transform: 'scale(1)' },
      },
      duration: '1s',
      easing: 'linear',
      iterationCount: '1',
    });

    expect(result).toContain('opacity: 0;');
    expect(result).toContain('transform: scale(0);');
    expect(result).toContain('opacity: 1;');
    expect(result).toContain('transform: scale(1);');
  });

  it('should separate keyframes block and class rule with newline', () => {
    const result = cssKeyframes({
      name: 'test',
      keyframes: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      duration: '1s',
      easing: 'linear',
      iterationCount: '1',
    });

    const parts = result.split('\n');
    expect(parts.length).toBe(2);
    expect(parts[0]).toContain('@keyframes');
    expect(parts[1]).toContain('.test');
  });
});

// ── staggerDelay ───────────────────────────────────────────────────

describe('staggerDelay', () => {
  it('should parse seconds format', () => {
    const result = staggerDelay(1, 3, '2s');
    expect(result).toBe('1s');
  });

  it('should parse milliseconds format', () => {
    const result = staggerDelay(1, 2, '1500ms');
    expect(result).toBe('1.5s');
  });

  it('should return "0s" for invalid duration format', () => {
    expect(staggerDelay(0, 5, 'invalid')).toBe('0s');
    expect(staggerDelay(0, 5, '2x')).toBe('0s');
    expect(staggerDelay(0, 5, '')).toBe('0s');
  });

  it('should return "0s" when total is 1', () => {
    expect(staggerDelay(0, 1, '2s')).toBe('0s');
  });

  it('should return "0s" for first element (index 0)', () => {
    expect(staggerDelay(0, 5, '2s')).toBe('0s');
  });

  it('should return full duration for last element', () => {
    expect(staggerDelay(4, 5, '2s')).toBe('2s');
  });

  it('should distribute evenly across elements', () => {
    // 5 elements over 4s: delays at 0, 1, 2, 3, 4 seconds
    expect(staggerDelay(0, 5, '4s')).toBe('0s');
    expect(staggerDelay(1, 5, '4s')).toBe('1s');
    expect(staggerDelay(2, 5, '4s')).toBe('2s');
    expect(staggerDelay(3, 5, '4s')).toBe('3s');
    expect(staggerDelay(4, 5, '4s')).toBe('4s');
  });

  it('should handle two elements', () => {
    expect(staggerDelay(0, 2, '1s')).toBe('0s');
    expect(staggerDelay(1, 2, '1s')).toBe('1s');
  });

  it('should handle fractional delays', () => {
    // 3 elements over 1s: delays at 0, 0.5, 1 seconds
    expect(staggerDelay(0, 3, '1s')).toBe('0s');
    expect(staggerDelay(1, 3, '1s')).toBe('0.5s');
    expect(staggerDelay(2, 3, '1s')).toBe('1s');
  });
});
