// tests/Browser/helpers.js
// Utility functions for the Playwright simulation runner

/**
 * Sleep for a random time between min and max seconds.
 */
export async function randomSleep(minSec = 1, maxSec = 3) {
  const ms = Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Append a line to the error log file.
 */
import { promises as fs } from 'fs';
export async function logError(line) {
  const logPath = 'storage/logs/browser_simulation_errors.log';
  await fs.appendFile(logPath, line + '\n');
}
