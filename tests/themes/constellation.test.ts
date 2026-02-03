import { describe, it, expect } from 'vitest';
import { mockContributionData } from '../fixtures/mock-data.js';
import { constellationTheme } from '../../src/themes/constellation/index.js';

describe('Constellation Theme', () => {
  const options = { title: '@testuser', width: 840, height: 240 };

  it('should render dark mode SVG', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.dark).toContain('<svg');
    expect(output.dark).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(output.dark).toContain('@testuser');
  });

  it('should render light mode SVG', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.light).toContain('<svg');
    expect(output.light).toContain('@testuser');
  });

  it('should produce deterministic output', () => {
    const output1 = constellationTheme.render(mockContributionData, options);
    const output2 = constellationTheme.render(mockContributionData, options);
    expect(output1.dark).toBe(output2.dark);
    expect(output1.light).toBe(output2.light);
  });

  it('should contain constellation stars', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.dark).toContain('class="constellation-stars"');
    expect(output.dark).toContain('scintillate-l1');
  });

  it('should contain constellation lines', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.dark).toContain('class="constellation-lines"');
    expect(output.dark).toContain('constellation-line');
  });

  it('should contain grid layer', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.dark).toContain('class="grid-layer"');
    expect(output.dark).toContain('sky-rotate');
  });

  it('should not use mix-blend-mode', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.dark).not.toContain('mix-blend-mode');
    expect(output.light).not.toContain('mix-blend-mode');
  });

  it('should have no background fill (transparent)', () => {
    const output = constellationTheme.render(mockContributionData, options);
    // SVG root should not have a fill attribute for background
    expect(output.dark).not.toMatch(/<svg[^>]+fill="/);
    expect(output.light).not.toMatch(/<svg[^>]+fill="/);
  });

  it('should contain contribution stats', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.dark).toContain('42');
    expect(output.dark).toContain('Wednesday');
  });

  it('should contain star glow filters', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.dark).toContain('id="star-l4-glow"');
    expect(output.dark).toContain('id="star-l3-glow"');
  });

  it('should match dark mode snapshot', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.dark).toMatchSnapshot();
  });

  it('should match light mode snapshot', () => {
    const output = constellationTheme.render(mockContributionData, options);
    expect(output.light).toMatchSnapshot();
  });
});
