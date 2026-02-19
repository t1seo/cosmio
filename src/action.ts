/**
 * Maeul in the Sky GitHub Action entry point
 *
 * Reads action inputs, fetches contribution data, renders themed SVGs,
 * and writes them to the specified output directory.
 */

import * as core from '@actions/core';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { fetchContributions } from './api/client.js';
import { computeStats } from './core/stats.js';
import { getTheme, listThemes } from './themes/registry.js';

// Import theme modules to trigger self-registration
import './themes/terrain/index.js';

async function run(): Promise<void> {
  try {
    // Read inputs
    const token = core.getInput('github_token');
    const themeName = core.getInput('theme') || 'terrain';
    const title = core.getInput('title');
    const outputDir = core.getInput('output_dir') || './';
    const yearInput = core.getInput('year');
    const hemisphereInput = core.getInput('hemisphere') || 'north';
    const hemisphere = hemisphereInput === 'south' ? ('south' as const) : ('north' as const);
    const densityInput = core.getInput('density');
    const density = densityInput ? Math.max(1, Math.min(10, parseInt(densityInput, 10) || 5)) : 5;

    // Determine username from GITHUB_ACTOR
    const username = process.env.GITHUB_ACTOR;
    if (!username) {
      throw new Error('GITHUB_ACTOR environment variable is not set');
    }

    // Determine year (omit for rolling 52 weeks)
    const year = yearInput ? parseInt(yearInput, 10) : undefined;
    if (yearInput && (year == null || isNaN(year))) {
      throw new Error(`Invalid year: "${yearInput}"`);
    }

    // Validate theme
    const theme = getTheme(themeName);
    if (!theme) {
      throw new Error(`Unknown theme "${themeName}". Available themes: ${listThemes().join(', ')}`);
    }

    const displayTitle = title || `@${username}`;

    const yearLabel = year ?? 'last 52 weeks';
    core.info(`Fetching contributions for @${username} (${yearLabel})...`);

    // Fetch contribution data
    const data = await fetchContributions(username, year, token || undefined);

    // Compute stats
    const stats = computeStats(data.weeks);
    const fullData = { ...data, stats };

    core.info(`Rendering with ${theme.displayName} theme...`);

    // Render SVGs
    const output = theme.render(fullData, {
      title: displayTitle,
      width: 840,
      height: 240,
      hemisphere,
      density,
    });

    // Write output files
    const darkPath = join(outputDir, `maeul-in-the-sky-dark.svg`);
    const lightPath = join(outputDir, `maeul-in-the-sky-light.svg`);

    await writeFile(darkPath, output.dark, 'utf-8');
    await writeFile(lightPath, output.light, 'utf-8');

    core.info(`Written: ${darkPath}`);
    core.info(`Written: ${lightPath}`);

    // Set outputs
    core.setOutput('dark_svg_path', darkPath);
    core.setOutput('light_svg_path', lightPath);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

run();
