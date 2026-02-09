import { describe, it, expect } from 'vitest';
import { registerTheme, getTheme, listThemes, getDefaultTheme } from '../../src/themes/registry.js';
import type { Theme } from '../../src/core/types.js';

function createMockTheme(name: string): Theme {
  return {
    name,
    displayName: `${name.charAt(0).toUpperCase()}${name.slice(1)}`,
    description: `${name} theme`,
    render: () => ({ dark: '', light: '' }),
  };
}

describe('registerTheme', () => {
  it('should register a theme that can be retrieved', () => {
    const theme = createMockTheme('test-register');
    registerTheme(theme);

    const retrieved = getTheme('test-register');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('test-register');
  });

  it('should overwrite a theme with the same name', () => {
    const theme1 = createMockTheme('overwrite-test');
    theme1.description = 'first';
    registerTheme(theme1);

    const theme2 = createMockTheme('overwrite-test');
    theme2.description = 'second';
    registerTheme(theme2);

    const retrieved = getTheme('overwrite-test');
    expect(retrieved?.description).toBe('second');
  });
});

describe('getTheme', () => {
  it('should return a registered theme', () => {
    const theme = createMockTheme('get-test');
    registerTheme(theme);

    const result = getTheme('get-test');
    expect(result).toBeDefined();
    expect(result?.name).toBe('get-test');
    expect(result?.displayName).toBe('Get-test');
  });

  it('should return undefined for an unknown theme', () => {
    const result = getTheme('nonexistent-theme-xyz');
    expect(result).toBeUndefined();
  });

  it('should return the full theme object with all properties', () => {
    const theme = createMockTheme('full-props');
    registerTheme(theme);

    const result = getTheme('full-props');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('displayName');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('render');
    expect(typeof result?.render).toBe('function');
  });

  it('should return a theme whose render produces ThemeOutput', () => {
    const theme = createMockTheme('render-test');
    registerTheme(theme);

    const result = getTheme('render-test');
    const output = result?.render(
      {
        weeks: [],
        stats: { total: 0, longestStreak: 0, currentStreak: 0, mostActiveDay: 'Monday' },
        year: 2024,
        username: 'test',
      },
      { title: 'Test', width: 840, height: 240 },
    );
    expect(output).toEqual({ dark: '', light: '' });
  });
});

describe('listThemes', () => {
  it('should return an array of theme names', () => {
    const names = listThemes();
    expect(Array.isArray(names)).toBe(true);
  });

  it('should include a previously registered theme', () => {
    const theme = createMockTheme('list-test');
    registerTheme(theme);

    const names = listThemes();
    expect(names).toContain('list-test');
  });

  it('should include all registered themes', () => {
    const themeA = createMockTheme('list-a');
    const themeB = createMockTheme('list-b');
    registerTheme(themeA);
    registerTheme(themeB);

    const names = listThemes();
    expect(names).toContain('list-a');
    expect(names).toContain('list-b');
  });
});

describe('getDefaultTheme', () => {
  it('should return "terrain"', () => {
    expect(getDefaultTheme()).toBe('terrain');
  });

  it('should always return a string', () => {
    expect(typeof getDefaultTheme()).toBe('string');
  });
});
