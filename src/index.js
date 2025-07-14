/**
 * Sysco Product Scraper - Main Entry Point
 * 
 * This is the main entry point for the Sysco product scraper.
 */

import { runScraper } from './scrapers/sysco-paginated.js';
import logger from './utils/logger.js';

async function main() {
  try {
    logger.info('Starting Sysco Product Scraper...');
    await runScraper();
    logger.info('Scraping completed successfully!');
  } catch (error) {
    logger.error('Scraping failed:', error.message);
    console.error('Failed to run scraper:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;
