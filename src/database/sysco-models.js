import sqlite3 from 'sqlite3';
import logger from '../utils/logger.js';
import { stringify } from 'csv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import syscoConfig from '../config/sysco-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection state
let db = null;
const dbPath = path.resolve(syscoConfig.database.path);

/**
 * Connect to the database
 */
export async function connect() {
  if (db) {
    return db;
  }

  try {
    // Ensure the data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new sqlite3.Database(dbPath);
    console.log('Database connection established.');
    logger.debug(`Connected to Sysco database: ${dbPath}`);
    return db;
  } catch (error) {
    logger.error('Error connecting to Sysco database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function close() {
  if (db) {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) {
          logger.error('Error closing Sysco database:', err);
          reject(err);
        } else {
          db = null;
          logger.debug('Sysco database connection closed');
          resolve();
        }
      });
    });
  }
}

/**
 * Initialize the database with tables and indexes
 */
export async function initializeDatabase() {
  try {
    await connect();
    await createTable();
    await createIndexes();
    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Create the sysco_products table
 */
export async function createTable() {
  const database = await connect();
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS sysco_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE,
      product_name TEXT NOT NULL,
      brand_name TEXT,
      packaging_information TEXT,
      packaging_size TEXT,
      picture_url TEXT,
      description TEXT,
      category TEXT,
      product_url TEXT,
      
      -- Additional product details
      unit_size TEXT,
      case_size TEXT,
      weight TEXT,
      upc TEXT,
      gtin TEXT,
      supplier TEXT,
      manufacturer TEXT,
      
      -- Product specifications
      specifications TEXT, -- JSON string
      nutrition_info TEXT, -- JSON string
      ingredients TEXT,
      allergens TEXT,
      storage_instructions TEXT,
      shelf_life TEXT,
      
      -- Scraping metadata
      location_zip TEXT DEFAULT '97209',
      scraped_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      scrape_session_id TEXT,
      
      -- Structured data
      structured_data TEXT, -- JSON string
      
      UNIQUE(sku, location_zip)
    )
  `;

  return new Promise((resolve, reject) => {
    database.run(createTableSQL, (err) => {
      if (err) {
        logger.error('Error creating sysco_products table:', err);
        reject(err);
      } else {
        logger.info('Sysco products table created or already exists');
        resolve();
      }
    });
  });
}

/**
 * Create indexes for better performance
 */
export async function createIndexes() {
  const database = await connect();
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sysco_sku ON sysco_products(sku)',
    'CREATE INDEX IF NOT EXISTS idx_sysco_category ON sysco_products(category)',
    'CREATE INDEX IF NOT EXISTS idx_sysco_brand ON sysco_products(brand_name)',
    'CREATE INDEX IF NOT EXISTS idx_sysco_scraped_date ON sysco_products(scraped_date)',
    'CREATE INDEX IF NOT EXISTS idx_sysco_location ON sysco_products(location_zip)'
  ];

  for (const indexSQL of indexes) {
    await new Promise((resolve, reject) => {
      database.run(indexSQL, (err) => {
        if (err) {
          logger.error('Error creating index:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  logger.info('Sysco products indexes created');
}

/**
 * Insert or update a product
 */
export async function upsertProduct(productData, sessionId = null) {
  const database = await connect();
  
  const {
    sku,
    product_name,
    brand_name,
    packaging_information,
    packaging_size,
    picture_url,
    description,
    category,
    product_url,
    unit_size,
    case_size,
    weight,
    upc,
    gtin,
    supplier,
    manufacturer,
    specifications,
    nutrition_info,
    ingredients,
    allergens,
    storage_instructions,
    shelf_life,
    location_zip = '97209',
    structured_data
  } = productData;

  const upsertSQL = `
    INSERT INTO sysco_products (
      sku, product_name, brand_name, packaging_information, packaging_size, picture_url, description,
      category, product_url, unit_size, case_size, weight, upc, gtin,
      supplier, manufacturer, specifications, nutrition_info, ingredients, allergens,
      storage_instructions, shelf_life, location_zip, scrape_session_id, structured_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sku, location_zip) DO UPDATE SET
      product_name = excluded.product_name,
      brand_name = excluded.brand_name,
      packaging_information = excluded.packaging_information,
      packaging_size = excluded.packaging_size,
      picture_url = excluded.picture_url,
      description = excluded.description,
      category = excluded.category,
      product_url = excluded.product_url,
      unit_size = excluded.unit_size,
      case_size = excluded.case_size,
      weight = excluded.weight,
      upc = excluded.upc,
      gtin = excluded.gtin,
      supplier = excluded.supplier,
      manufacturer = excluded.manufacturer,
      specifications = excluded.specifications,
      nutrition_info = excluded.nutrition_info,
      ingredients = excluded.ingredients,
      allergens = excluded.allergens,
      storage_instructions = excluded.storage_instructions,
      shelf_life = excluded.shelf_life,
      updated_date = CURRENT_TIMESTAMP,
      scrape_session_id = excluded.scrape_session_id,
      structured_data = excluded.structured_data
  `;

  return new Promise((resolve, reject) => {
    database.run(upsertSQL, [
      sku, product_name, brand_name, packaging_information, packaging_size, picture_url, description,
      category, product_url, unit_size, case_size, weight, upc, gtin,
      supplier, manufacturer, 
      typeof specifications === 'object' ? JSON.stringify(specifications) : specifications,
      typeof nutrition_info === 'object' ? JSON.stringify(nutrition_info) : nutrition_info,
      ingredients, allergens, storage_instructions, shelf_life, location_zip, sessionId,
      typeof structured_data === 'object' ? JSON.stringify(structured_data) : structured_data
    ], function(err) {
      if (err) {
        logger.error('Error upserting product:', err);
        reject(err);
      } else {
        const isNew = this.changes > 0 && this.lastID > 0;
        resolve({ 
          isNew: isNew, 
          id: this.lastID || null,
          changes: this.changes
        });
      }
    });
  });
}

/**
 * Batch upsert products
 * @param {Array} productsArray - Array of product data objects
 * @param {String} sessionId - Optional session ID for tracking
 */
export async function batchUpsertProducts(productsArray, sessionId = null) {
  if (!Array.isArray(productsArray) || productsArray.length === 0) {
    logger.info('No products to save');
    return { saved: 0, errors: 0 };
  }

  let saved = 0;
  let errors = 0;

  logger.info(`Starting batch upsert of ${productsArray.length} products...`);

  for (let i = 0; i < productsArray.length; i++) {
    try {
      const product = productsArray[i];
      await upsertProduct(product, sessionId);
      saved++;
      
      if ((i + 1) % 10 === 0) {
        logger.info(`Progress: ${i + 1}/${productsArray.length} products processed`);
      }
    } catch (error) {
      errors++;
      logger.error(`Error saving product ${i + 1}:`, error.message);
    }
  }

  logger.info(`Batch upsert complete: ${saved} saved, ${errors} errors`);
  return { saved, errors };
}

/**
 * Get products by category
 */
export async function getProductsByCategory(category, limit = null) {
  const database = await connect();
  
  let sql = 'SELECT * FROM sysco_products WHERE category = ? ORDER BY updated_date DESC';
  const params = [category];
  
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Get total product count
 */
export async function getTotalProductCount() {
  const database = await connect();
  
  return new Promise((resolve, reject) => {
    database.get('SELECT COUNT(*) as count FROM sysco_products', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.count);
      }
    });
  });
}

/**
 * Get product count by category
 */
export async function getProductCountByCategory() {
  const database = await connect();
  
  return new Promise((resolve, reject) => {
    database.all(
      'SELECT category, COUNT(*) as count FROM sysco_products GROUP BY category ORDER BY count DESC',
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

/**
 * Export all products to CSV
 */
export async function exportToCsv(outputPath = null, options = {}) {
  const database = await connect();
  
  const defaultPath = path.join(__dirname, '../../data', `sysco_products_${new Date().toISOString().split('T')[0]}.csv`);
  const filePath = outputPath || defaultPath;
  
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    database.all('SELECT * FROM sysco_products ORDER BY category, brand_name, product_name', (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      if (rows.length === 0) {
        reject(new Error('No products found to export'));
        return;
      }

      // Define the required columns in the specific order requested
      const requiredColumns = [
        'brand_name',
        'product_name', 
        'packaging_information',
        'sku',
        'picture_url',
        'description'
      ];

      // Optional additional columns
      const additionalColumns = [
        'category',
        'product_url',
        'case_size',
        'upc',
        'gtin',
        'ingredients',
        'storage_instructions',
        'location_zip',
        'scraped_date'
      ];

      const allColumns = options.includeAll ? 
        [...requiredColumns, ...additionalColumns] : 
        requiredColumns;

      // Prepare data for CSV
      const csvData = rows.map(row => {
        const csvRow = {};
        allColumns.forEach(col => {
          csvRow[col] = row[col] || '';
        });
        return csvRow;
      });

      // Create CSV content
      stringify(csvData, {
        header: true,
        columns: allColumns
      }, (err, csvString) => {
        if (err) {
          reject(err);
          return;
        }

        fs.writeFileSync(filePath, csvString);
        
        resolve({
          filePath: filePath,
          totalProducts: rows.length,
          columns: allColumns.length,
          categories: [...new Set(rows.map(r => r.category))].length
        });
      });
    });
  });
}

/**
 * Get statistics about scraped data
 */
export async function getStatistics() {
  const database = await connect();
  
  return new Promise((resolve, reject) => {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM sysco_products',
      byCategory: 'SELECT category, COUNT(*) as count FROM sysco_products GROUP BY category ORDER BY count DESC',
      byBrand: 'SELECT brand_name, COUNT(*) as count FROM sysco_products GROUP BY brand_name ORDER BY count DESC LIMIT 10',
      withImages: 'SELECT COUNT(*) as count FROM sysco_products WHERE picture_url IS NOT NULL AND picture_url != ""',
      recentlyScraped: 'SELECT COUNT(*) as count FROM sysco_products WHERE date(scraped_date) = date("now")'
    };

    const stats = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
      database.all(query, (err, rows) => {
        if (err) {
          logger.error(`Error getting ${key} statistics:`, err);
        } else {
          if (key === 'total' || key === 'withImages' || key === 'recentlyScraped') {
            stats[key] = rows[0].count;
          } else {
            stats[key] = rows;
          }
        }
        
        completed++;
        if (completed === total) {
          resolve(stats);
        }
      });
    });
  });
}
