/**
 * Database Setup Script
 * 
 * Initializes the Sysco database with tables and indexes.
 */

import { initializeDatabase, getStatistics, close } from './sysco-models.js';
import logger from '../utils/logger.js';

async function setupDatabase() {
  try {
    logger.info('Initializing Sysco database...');
    
    // Initialize database (creates tables and indexes)
    await initializeDatabase();
    
    logger.info('Sysco database initialization completed successfully');
    
    // Get and display stats
    const stats = await getStatistics();
    console.log('Current Database Stats:');
    console.log(`Total Products: ${stats.total}`);
    console.log(`Recently Scraped: ${stats.recentlyScraped}`);
    console.log(`Products with Images: ${stats.withImages}`);
    
    if (stats.byCategory && stats.byCategory.length > 0) {
      console.log('\nProducts by Category:');
      stats.byCategory.forEach(cat => {
        console.log(`  ${cat.category}: ${cat.count}`);
      });
    }
    
    await close();
    
  } catch (error) {
    logger.error('Error setting up database:', error);
    console.error('Setup failed:', error.message);
    await close();
    process.exit(1);
  }
}

// Run setup when file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase();
}
