/**
 * Manual CSV Export Script
 * 
 * Exports all Sysco products with full column set including additional columns.
 */

import * as SyscoModels from '../database/sysco-models.js';
import logger from '../utils/logger.js';
import path from 'path';

async function exportToCSV() {
  try {
    logger.info('Starting CSV export...');
    
    const totalCount = await SyscoModels.getTotalProductCount();
    if (totalCount === 0) {
      console.log('No products found in database. Run the scraper first.');
      return;
    }

    // Generate output path with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const outputPath = path.join(process.cwd(), 'data', `sysco_products_full_${timestamp}.csv`);

    // Export with all additional columns
    const result = await SyscoModels.exportToCsv(outputPath, {
      includeAll: true
    });

    console.log('Export completed successfully');
    console.log(`File: ${result.filePath}`);
    console.log(`Products: ${result.totalProducts}`);

  } catch (error) {
    logger.error('CSV export failed:', error.message);
    console.error('Export failed:', error.message);
    throw error;
  } finally {
    await SyscoModels.close();
  }
}

// Run export when file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exportToCSV().catch(error => {
    console.error('Export failed:', error.message);
    process.exit(1);
  });
}
