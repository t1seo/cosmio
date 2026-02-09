#!/usr/bin/env node

/**
 * Maeul in the Sky CLI — Transform GitHub contributions into animated terrain SVGs
 */

import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CliOptions } from './core/types.js';
import { fetchContributions } from './api/client.js';
import { computeStats } from './core/stats.js';
import { getTheme, listThemes, getDefaultTheme } from './themes/registry.js';

// Import theme modules to trigger self-registration
import './themes/terrain/index.js';

const program = new Command();

program
  .name('maeul-sky')
  .description('Transform GitHub contributions into animated terrain SVGs')
  .version('1.0.0')
  .requiredOption('-u, --user <username>', 'GitHub username')
  .option('-t, --theme <name>', 'Theme name', getDefaultTheme())
  .option('--title <text>', 'Custom title text')
  .option('-o, --output <dir>', 'Output directory', './')
  .option('-y, --year <number>', 'Year to visualize (omit for rolling 52 weeks)')
  .option('--token <token>', 'GitHub personal access token (or use GITHUB_TOKEN env)')
  .option('--hemisphere <hemisphere>', 'Hemisphere for seasonal terrain (north or south)', 'north')
  .action(async (opts) => {
    const hemisphere = opts.hemisphere === 'south' ? ('south' as const) : ('north' as const);
    const options: CliOptions = {
      user: opts.user,
      theme: opts.theme,
      title: opts.title || `@${opts.user}`,
      output: opts.output,
      year: opts.year ? parseInt(opts.year, 10) : undefined,
      token: opts.token || process.env.GITHUB_TOKEN,
      hemisphere,
    };

    // Validate theme exists
    const theme = getTheme(options.theme);
    if (!theme) {
      console.error(`Error: Unknown theme "${options.theme}"`);
      console.error(`Available themes: ${listThemes().join(', ')}`);
      process.exit(1);
    }

    try {
      const yearLabel = options.year ?? 'last 52 weeks';
      console.log(`Fetching contributions for @${options.user} (${yearLabel})...`);

      // Fetch contribution data
      const data = await fetchContributions(options.user, options.year, options.token);

      // Compute stats
      const stats = computeStats(data.weeks);
      const fullData = { ...data, stats };

      console.log(`Rendering with ${theme.displayName} theme...`);

      // Render SVGs
      const output = theme.render(fullData, {
        title: options.title,
        width: 840,
        height: 240,
        hemisphere: options.hemisphere,
      });

      // Write output files
      const darkPath = join(options.output, `maeul-in-the-sky-dark.svg`);
      const lightPath = join(options.output, `maeul-in-the-sky-light.svg`);

      await writeFile(darkPath, output.dark, 'utf-8');
      await writeFile(lightPath, output.light, 'utf-8');

      console.log(`Written: ${darkPath}`);
      console.log(`Written: ${lightPath}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error(`Error: ${String(error)}`);
      }
      process.exit(1);
    }
  });

program.parse();
