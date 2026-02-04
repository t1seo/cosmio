/**
 * Generate example SVGs using mock data (no GitHub API needed).
 * Usage: npx tsx scripts/generate-examples.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { computeStats } from '../src/core/stats.js';
import { getTheme, listThemes } from '../src/themes/registry.js';
import type { ContributionData, ContributionDay } from '../src/core/types.js';

// Register all themes
import '../src/themes/terrain/index.js';

// Generate realistic 52-week mock data
function generateRealisticData(username: string): ContributionData {
  const weeks = [];
  const baseDate = new Date(2025, 0, 5); // Jan 5, 2025 (Sunday)

  // Seed-based pseudo-random for determinism
  let seed = 42;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (let w = 0; w < 52; w++) {
    const days: ContributionDay[] = [];
    const weekStart = new Date(baseDate);
    weekStart.setDate(weekStart.getDate() + w * 7);

    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];

      // Simulate realistic patterns: weekdays more active, some bursts
      const isWeekday = d >= 1 && d <= 5;
      const burstWeek = (w % 8 === 0 || w % 13 === 0);
      const r = random();

      let count = 0;
      if (isWeekday) {
        if (burstWeek && r > 0.2) count = Math.floor(r * 15) + 3;
        else if (r > 0.35) count = Math.floor(r * 8) + 1;
      } else {
        if (r > 0.6) count = Math.floor(r * 5) + 1;
      }

      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
      days.push({ date: dateStr, count, level: level as 0 | 1 | 2 | 3 | 4 });
    }

    weeks.push({ firstDay: days[0].date, days });
  }

  const stats = computeStats(weeks);
  return { weeks, stats, year: 2025, username };
}

// Generate SVGs for all themes
const data = generateRealisticData('terraviz-user');
const outDir = join(import.meta.dirname, '..', 'examples');
mkdirSync(outDir, { recursive: true });

const themes = listThemes();
console.log(`Generating examples for ${themes.length} themes: ${themes.join(', ')}\n`);
console.log(`Stats: ${data.stats.total} contributions, ${data.stats.longestStreak}d longest streak, ${data.stats.mostActiveDay}\n`);

for (const themeName of themes) {
  const theme = getTheme(themeName)!;
  const output = theme.render(data, {
    title: `@terraviz-user`,
    width: 840,
    height: 240,
  });

  const darkPath = join(outDir, `terraviz-${themeName}-dark.svg`);
  const lightPath = join(outDir, `terraviz-${themeName}-light.svg`);

  writeFileSync(darkPath, output.dark, 'utf-8');
  writeFileSync(lightPath, output.light, 'utf-8');

  const darkSize = (Buffer.byteLength(output.dark) / 1024).toFixed(1);
  const lightSize = (Buffer.byteLength(output.light) / 1024).toFixed(1);
  console.log(`${theme.displayName}:`);
  console.log(`  Dark:  ${darkPath} (${darkSize} KB)`);
  console.log(`  Light: ${lightPath} (${lightSize} KB)`);
}

console.log(`\nDone! Open the SVG files in a browser to preview.`);
