import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const syscoConfig = {
  database: {
    path: process.env.SYSCO_DB_PATH || './data/sysco.db'
  },

  puppeteer: {
    headless: process.env.HEADLESS !== 'false',
    viewport: {
      width: parseInt(process.env.VIEWPORT_WIDTH) || 1920,
      height: parseInt(process.env.VIEWPORT_HEIGHT) || 1080
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },

  scraping: {
    location: {
      zipCode: process.env.SYSCO_LOCATION_ZIP || '97209'
    },
    
    // Pagination configuration for categories
    maxPagesPerCategory: parseInt(process.env.MAX_PAGES_PER_CATEGORY) || 10,
    maxProductsPerCategory: parseInt(process.env.MAX_PRODUCTS_PER_CATEGORY) || 500,
    
    // Categories to scrape
    categories: ['Produce', 'Meat & Seafood', 'Bakery & Breads', 'Dairy & Eggs', 'Canned & Dry', 'Frozen Foods', 'Beverages'],
    
    // Category selector mappings
    categorySelectors: {
      'Produce': '[data-id="lbl_category_app.dashboard.produce.title"]',
      'Meat & Seafood': '[data-id="lbl_category_app.dashboard.meatseafood.title"]',
      'Bakery & Breads': '[data-id="lbl_category_app.dashboard.bakerybread.title"]',
      'Dairy & Eggs': '[data-id="lbl_category_app.dashboard.dairyeggs.title"]',
      'Canned & Dry': '[data-id="lbl_category_app.dashboard.canneddry.title"]',
      'Frozen Foods': '[data-id="lbl_category_app.dashboard.frozenfoods.title"]',
      'Beverages': '[data-id="lbl_category_app.dashboard.beverages.title"]'
    },
    
    // Authentication and modal selectors
    auth: {
      guestButton: 'button[data-id="btn_login_continue_as_guest"]',
      zipCodeInput: 'input[data-id="initial_zipcode_modal_input"]'
    },
    
    // Product detail page selectors
    productDetails: {
      brandName: '[data-id="product_brand_link"]',
      packagingInformation: '[data-id="product_packaging_text"]',
      packagingSize: '[data-id="pack_size"]',
      sku: '[data-id="product_id"]',
      pictureUrl: '[data-id="main-product-img-v2"]',
      description: '[data-id="product_description_section"]',
      category: '[data-id="breadcrumb_category_level1"]',
      ingredients: '[data-id="ingredients_text"]',
      gtin: '[data-id="gtin_text"]',
      upc: '[data-id="manufacturer_upc_text"]',
      caseSize: '[data-id="case_dimensions_text"]',
      weight: '[data-id="net_weight_text"]',
      storageInstructions: '[data-id="storage_location_text"]',
      locationZip: 'div.zipcode',
      readMoreButton: '[data-id="ellipsis-read-more-button"]',
      productName: '[data-testid="product-title"]'
    },
    
    // Pagination selectors
    pagination: {
      nextButton: 'button[data-id="button_page_next"]',
      pageButtons: 'button[data-id^="button_page_"]'
    },
    
    // Product listing selectors
    productListing: {
      productLinks: 'a[href*="/product-details/"]',
      productUrlFilter: '/product/'
    },
    
    // Navigation URLs
    urls: {
      home: 'https://shop.sysco.com/',
      discover: 'https://shop.sysco.com/app/discover'
    },
    
    // Timing configuration
    delays: {
      pageLoad: parseInt(process.env.DELAY_PAGE_LOAD) || 3000,
      modalHandling: parseInt(process.env.DELAY_MODAL_HANDLING) || 2000,
      betweenProducts: parseInt(process.env.DELAY_BETWEEN_PRODUCTS) || 500,
      betweenCategories: parseInt(process.env.DELAY_BETWEEN_CATEGORIES) || 2000,
      afterCategoryClick: parseInt(process.env.DELAY_AFTER_CATEGORY_CLICK) || 8000,
      pagination: parseInt(process.env.DELAY_PAGINATION) || 5000,
      productDetails: parseInt(process.env.DELAY_PRODUCT_DETAILS) || 1000
    },

    // Retry configuration
    retry: {
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      baseDelay: parseInt(process.env.RETRY_BASE_DELAY) || 2000
    }
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: process.env.LOG_MAX_FILES || '5',
    maxSize: process.env.LOG_MAX_SIZE || '20m'
  }
};

export default syscoConfig;
