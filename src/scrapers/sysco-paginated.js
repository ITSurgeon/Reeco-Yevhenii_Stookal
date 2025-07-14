import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as SyscoModels from '../database/sysco-models.js';
import logger from '../utils/logger.js';
import { delay, retry, shouldRetryError } from '../utils/helpers.js';
import syscoConfig from '../config/sysco-config.js';

puppeteer.use(StealthPlugin());

// Global state
let browser = null;
let page = null;


async function initializeBrowser() {
  logger.info('Initializing Sysco Scraper...');
  
  browser = await puppeteer.launch({
    headless: syscoConfig.puppeteer.headless,
    args: syscoConfig.puppeteer.args
  });

  page = await browser.newPage();
  await page.setViewport(syscoConfig.puppeteer.viewport);
  await page.setUserAgent(syscoConfig.puppeteer.userAgent);
  
  logger.info('Browser initialized successfully');
}

async function authenticateAsGuest() {
  logger.info('=== STEP 1: AUTHENTICATION & ZIP CODE ===');
  
  await retry(async () => {
    await page.goto(syscoConfig.scraping.urls.home, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
  }, {
    maxRetries: 3,
    retryCondition: shouldRetryError
  });

  await delay(syscoConfig.scraping.delays.pageLoad);

  // Find and click Continue as Guest
  const buttons = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
    const buttonInfo = {};
    allButtons.forEach((btn, index) => {
      const text = btn.textContent?.trim() || btn.value?.trim() || btn.getAttribute('aria-label') || '';
      if (text) {
        buttonInfo[index] = text;
      }
    });
    return buttonInfo;
  });
  
  logger.info(`Found buttons: ${JSON.stringify(buttons, null, 2)}`);
  
  // Click the specific guest button
  const guestButtonFound = await page.evaluate((selector) => {
    const guestButton = document.querySelector(selector);
    if (guestButton) {
      guestButton.click();
      return true;
    }
    return false;
  }, syscoConfig.scraping.auth.guestButton);

  if (!guestButtonFound) {
    throw new Error('Could not find "Continue as Guest" button');
  }

  logger.info('Guest authentication successful');
  
  await delay(syscoConfig.scraping.delays.pageLoad);
}

async function handleZipCodeModal() {
  logger.info('=== STEP 2: ZIP CODE MODAL ===');
  await delay(syscoConfig.scraping.delays.modalHandling);

  try {
    // Wait for the ZIP code modal to appear
    await page.waitForSelector(syscoConfig.scraping.auth.zipCodeInput, { timeout: 10000 });
    
    const zipInput = await page.$(syscoConfig.scraping.auth.zipCodeInput);
    
    if (zipInput) {
      logger.info('Found modal ZIP input with correct data-id selector');
      await zipInput.click();
      await zipInput.type(syscoConfig.scraping.location.zipCode);
      logger.info(`ZIP code successfully entered in modal: ${syscoConfig.scraping.location.zipCode}`);
      
      await delay(syscoConfig.scraping.delays.modalHandling);

      // Find and click the submit button in the modal
      const modalSubmitClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const button of buttons) {
          const text = button.textContent?.trim() || '';
          if (text.toLowerCase().includes('start shopping') || 
              text.toLowerCase().includes('continue') || 
              text.toLowerCase().includes('submit')) {
            button.click();
            return text;
          }
        }
        return false;
      });

      if (modalSubmitClicked) {
        logger.info(`Clicking modal submit button: "${modalSubmitClicked}"`);
        await delay(syscoConfig.scraping.delays.pagination);
      }
    } else {
      throw new Error('Could not find ZIP code input with data-id selector');
    }
  } catch (error) {
    logger.error('Error handling ZIP code modal:', error);
    throw error;
  }

  logger.info('Authentication and ZIP code setup complete');
}

async function extractProductDetails(productUrl) {
  return await retry(async () => {
    // Navigate to product page
    await page.goto(productUrl, { 
      waitUntil: 'networkidle2',
      timeout: 25000 
    });

    await delay(syscoConfig.scraping.delays.productDetails);

    // Click "Read More" button for description if it exists
    const readMoreButton = await page.$(syscoConfig.scraping.productDetails.readMoreButton);
    if (readMoreButton) {
      await readMoreButton.click();
      await delay(syscoConfig.scraping.delays.productDetails);
    }

    // Extract product details using specific data-id selectors
    const productDetails = await page.evaluate((selectors) => {
      try {
        // Helper function to safely extract text from selector
        const getTextBySelector = (selector) => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };

        // Helper function to safely extract attribute from selector
        const getAttributeBySelector = (selector, attribute) => {
          const element = document.querySelector(selector);
          return element?.getAttribute(attribute) || '';
        };

        // Extract all fields using selectors from config
        const sku = getTextBySelector(selectors.sku);
        const brandName = getTextBySelector(selectors.brandName);
        const packagingInformation = getTextBySelector(selectors.packagingInformation);     
        const packagingSize = getTextBySelector(selectors.packagingSize);
        const pictureUrl = getAttributeBySelector(selectors.pictureUrl, 'src');
        const description = getTextBySelector(selectors.description);
        const category = getTextBySelector(selectors.category);
        const ingredients = getTextBySelector(selectors.ingredients);
        const gtin = getTextBySelector(selectors.gtin);
        const upc = getTextBySelector(selectors.upc);
        const caseSize = getTextBySelector(selectors.caseSize);
        const weight = getTextBySelector(selectors.weight);          
        const storageInstructions = getTextBySelector(selectors.storageInstructions);
        const productName = getTextBySelector(selectors.productName);

        // Extract location ZIP code
        let locationZip = '97209';
        const zipcodeElement = document.querySelector(selectors.locationZip);
        if (zipcodeElement) {
          locationZip = zipcodeElement.textContent?.trim() || '97209';
        }

        return {
          sku: sku || '',
          brand_name: brandName || 'Sysco',
          product_name: productName || 'Product',
          packaging_information: packagingInformation || 'Standard packaging',
          packaging_size: packagingSize || '',
          picture_url: pictureUrl || '',
          description: description || 'Premium quality product from Sysco',
          category: category || '',
          ingredients: ingredients || '',
          gtin: gtin || '',
          upc: upc || '',
          case_size: caseSize || '',
          weight: weight || '',
          storage_instructions: storageInstructions || '',
          product_url: window.location.href,
          location_zip: locationZip
        };

      } catch (error) {
        console.error('Error extracting product details:', error);
        return null;
      }
    }, syscoConfig.scraping.productDetails);

    if (productDetails && productDetails.sku) {
      logger.info(`Extracted product: ${productDetails.product_name} (SKU: ${productDetails.sku}) - Pack: ${productDetails.packaging_size}, Weight: ${productDetails.weight}`);
      return productDetails;
    } else {
      throw new Error(`Failed to extract details from: ${productUrl}`);
    }

  }, {
    maxRetries: syscoConfig.scraping.retry.maxRetries,
    baseDelay: syscoConfig.scraping.retry.baseDelay,
    retryCondition: shouldRetryError
  });
}

async function scrapeProductsFromPage(categoryName, pageNumber) {
  logger.info(`=== SCRAPING ${categoryName} - PAGE ${pageNumber} ===`);
  
  await delay(syscoConfig.scraping.delays.pageLoad);

  // Get product links from current page
  const productLinks = await page.evaluate((productListing) => {
    const links = Array.from(document.querySelectorAll(productListing.productLinks))
      .map(link => link.href)
      .filter(href => href.includes(productListing.productUrlFilter));
    
    return [...new Set(links)];
  }, syscoConfig.scraping.productListing);

  logger.info(`Found ${productLinks.length} product links on page ${pageNumber}`);

  if (productLinks.length === 0) {
    logger.warn(`No products found on page ${pageNumber} for ${categoryName}`);
    return [];
  }

  const categoryProducts = [];

  // Visit each product detail page
  for (let i = 0; i < productLinks.length && categoryProducts.length < syscoConfig.scraping.maxProductsPerCategory; i++) {
    try {
      logger.info(`Extracting details from: ${productLinks[i]}`);
      
      const productDetails = await extractProductDetails(productLinks[i]);
      
      if (productDetails) {
        categoryProducts.push(productDetails);
        logger.info(`Product ${i + 1}/${productLinks.length}: ${productDetails.product_name}`);
      } else {
        logger.warn(`Failed to extract product ${i + 1}/${productLinks.length}`);
      }

      // Small delay between products
      await delay(syscoConfig.scraping.delays.betweenProducts);

    } catch (error) {
      logger.error(`Error processing product ${i + 1}:`, error.message);
      logger.warn(`Failed to extract product ${i + 1}/${productLinks.length}`);
      continue;
    }
  }

  logger.info(`Page ${pageNumber} complete: ${categoryProducts.length} products. Total: ${categoryProducts.length}`);
  
  // Save products to database after each page
  if (categoryProducts.length > 0) {
    logger.info(`Saving ${categoryProducts.length} products from ${categoryName} page ${pageNumber}...`);
    try {
      await SyscoModels.batchUpsertProducts(categoryProducts);
      logger.info(`Successfully saved ${categoryProducts.length} products to database`);
    } catch (dbError) {
      logger.error(`Database save error for ${categoryName} page ${pageNumber}:`, dbError.message);
      // Continue processing even if save fails
    }
  }
  
  return categoryProducts;
}

async function navigateToNextPage(categoryPageUrl) {
  logger.info('Looking for next page button...');
  
  // Navigate back to category listing page
  logger.info(`Navigating back to category listing page: ${categoryPageUrl}`);
  await page.goto(categoryPageUrl, { waitUntil: 'networkidle2' });
  await delay(syscoConfig.scraping.delays.modalHandling);
  
  // Wait for products and pagination to fully load
  await delay(syscoConfig.scraping.delays.pagination);

  // Check for next page button
  const nextPageClicked = await page.evaluate((pagination) => {
    const exactButton = document.querySelector(pagination.nextButton);
    
    if (exactButton) {
      const isDisabled = exactButton.disabled || 
                        exactButton.getAttribute('aria-disabled') === 'true' ||
                        exactButton.classList.contains('disabled') ||
                        exactButton.classList.contains('inactive');
      
      if (!isDisabled) {
        exactButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        try {
          exactButton.click();
          return { success: true, method: 'exact-data-id-click' };
        } catch (e) {
          exactButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return { success: true, method: 'exact-data-id-dispatch' };
        }
      } else {
        return { success: false, reason: 'button-disabled' };
      }
    }
    
    // Try numbered pagination buttons as fallback
    const numberButtons = document.querySelectorAll(pagination.pageButtons);
    
    if (numberButtons.length > 0) {
      let currentPage = 1;
      const activeButton = document.querySelector(pagination.pageButtons + '.active, ' + pagination.pageButtons + '[disabled]');
      if (activeButton) {
        const pageMatch = activeButton.getAttribute('data-id').match(/button_page_(\d+)/);
        if (pageMatch) {
          currentPage = parseInt(pageMatch[1]);
        }
      }
      
      const nextPageNumber = currentPage + 1;
      const nextPageButton = document.querySelector(`button[data-id="button_page_${nextPageNumber}"]`);
      
      if (nextPageButton && !nextPageButton.disabled) {
        nextPageButton.click();
        return { success: true, method: 'numbered-pagination', page: nextPageNumber };
      }
    }
    
    return { success: false, reason: 'no-buttons-found' };
  }, syscoConfig.scraping.pagination);

  if (nextPageClicked.success) {
    logger.info(`Next page button clicked using method: ${nextPageClicked.method}`);
    if (nextPageClicked.page) {
      logger.info(`Navigated to page: ${nextPageClicked.page}`);
    }
    
    await delay(syscoConfig.scraping.delays.pagination);
    
    // Wait for new products to load
    try {
      await page.waitForSelector('[href*="/app/product-details/"]', { timeout: 15000 });
      logger.info('New products loaded after pagination');
    } catch (error) {
      logger.info('Product loading timeout, checking if page content changed...');
    }
    
    return true;
  } else {
    logger.info(`Pagination ended - Reason: ${nextPageClicked.reason}`);
    return false;
  }
}

async function scrapeCategory(categoryName) {
  logger.info(`=== SCRAPING CATEGORY: ${categoryName} ===`);
  
  await delay(syscoConfig.scraping.delays.betweenCategories);

  const selector = syscoConfig.scraping.categorySelectors[categoryName];
  if (!selector) {
    logger.error(`Unknown category: ${categoryName}`);
    return [];
  }

  // Look for and click the category using the specific data-id
  logger.info(`Looking for category: ${categoryName} with selector: ${selector}`);
  
  const categoryClicked = await page.evaluate((categorySelector) => {
    const categoryElement = document.querySelector(categorySelector);
    if (categoryElement) {
      // Find the clickable parent
      let clickableElement = categoryElement;
      
      while (clickableElement && clickableElement !== document.body) {
        if (clickableElement.tagName === 'BUTTON' || 
            clickableElement.tagName === 'A' ||
            clickableElement.onclick ||
            clickableElement.addEventListener) {
          break;
        }
        clickableElement = clickableElement.parentElement;
      }
      
      if (clickableElement && clickableElement !== document.body) {
        clickableElement.click();
        return true;
      } else {
        categoryElement.click();
        return true;
      }
    }
    return false;
  }, selector);

  if (!categoryClicked) {
    logger.error(`Could not find or click category: ${categoryName}`);
    return [];
  }

  logger.info(`Clicked category ${categoryName}`);
  await delay(syscoConfig.scraping.delays.afterCategoryClick);

  // Wait for navigation to category page
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
  } catch (error) {
    // Continue even if navigation doesn't complete
    logger.info('Navigation timeout, continuing...');
  }

  const currentUrl = page.url();
  logger.info(`Current URL after category click: ${currentUrl}`);

  const allCategoryProducts = [];
  let currentPage = 1;
  let categoryPageUrl = currentUrl;

  // Scrape multiple pages
  while (currentPage <= syscoConfig.scraping.maxPagesPerCategory && allCategoryProducts.length < syscoConfig.scraping.maxProductsPerCategory) {
    logger.info(`=== ${categoryName} - PAGE ${currentPage} ===`);
    
    // Scrape products from current page
    const pageProducts = await scrapeProductsFromPage(categoryName, currentPage);
    allCategoryProducts.push(...pageProducts);

    if (currentPage >= syscoConfig.scraping.maxPagesPerCategory) {
      logger.info(`Reached max pages limit (${syscoConfig.scraping.maxPagesPerCategory}) for ${categoryName}`);
      break;
    }

    // Try to navigate to next page
    const hasNextPage = await navigateToNextPage(categoryPageUrl);
    
    if (!hasNextPage) {
      logger.info(`No more pages for ${categoryName}`);
      break;
    }

    currentPage++;
    categoryPageUrl = page.url();
  }

  logger.info(`Category ${categoryName} complete: ${allCategoryProducts.length} products from ${currentPage} pages`);
  
  // Navigate back to category list page for next category
  await returnToCategoryListPage();
  
  return allCategoryProducts;
}

async function returnToCategoryListPage() {
  logger.info('Returning to category list page...');
  
  try {
    // Try navigating directly to the discover page
    const currentUrl = page.url();
    logger.info(`Current URL before return: ${currentUrl}`);
    
    // If we're already on the discover page, just scroll to top
    if (currentUrl.includes('/app/discover')) {
      logger.info('Already on discover page, scrolling to top...');
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await delay(syscoConfig.scraping.delays.modalHandling);
      
      // Check if categories are visible
      const categoriesVisible = await page.evaluate(() => {
        const categories = document.querySelectorAll('[data-id*="lbl_category_app.dashboard"]');
        return categories.length > 0;
      });
      
      if (categoriesVisible) {
        logger.info('Categories are visible, no navigation needed');
        return;
      }
    }
    
    // Navigate back to discover page
    logger.info('Navigating back to discover page...');
    await page.goto(syscoConfig.scraping.urls.discover, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await delay(syscoConfig.scraping.delays.pageLoad);
    
    // Verify we're on the right page with categories
    const categoriesFound = await page.evaluate(() => {
      const categoryElements = document.querySelectorAll('[data-id*="lbl_category_app.dashboard"]');
      const categoryNames = Array.from(categoryElements).map(el => {
        const dataId = el.getAttribute('data-id');
        const text = el.textContent?.trim();
        return { dataId, text };
      });
      return categoryNames;
    });
    
    if (categoriesFound.length > 0) {
      logger.info(`Successfully returned to category list page with ${categoriesFound.length} categories visible`);
    } else {
      logger.warn('Returned to discover page but categories not immediately visible');
      
      // Try scrolling and waiting
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await delay(syscoConfig.scraping.delays.modalHandling);
      
      const categoriesAfterScroll = await page.evaluate(() => {
        return document.querySelectorAll('[data-id*="lbl_category_app.dashboard"]').length;
      });
      
      if (categoriesAfterScroll > 0) {
        logger.info(`Categories found after scrolling: ${categoriesAfterScroll}`);
      } else {
        logger.warn('Categories still not visible, continuing anyway...');
      }
    }
    
  } catch (error) {
    logger.error('Failed to return to category list page:', error.message);
    
    // Last resort: try to refresh the discover page
    try {
      logger.info('Last resort: refreshing discover page...');
      await page.goto(syscoConfig.scraping.urls.discover, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await delay(syscoConfig.scraping.delays.pagination);
      logger.info('Page refreshed successfully');
    } catch (refreshError) {
      logger.error('Failed to refresh page:', refreshError.message);
      throw new Error('Could not return to category list page');
    }
  }
}

async function scrapeAllCategories() {
  const allProducts = [];

  for (const category of syscoConfig.scraping.categories) {
    try {
      const categoryProducts = await scrapeCategory(category);
      allProducts.push(...categoryProducts);
      
      logger.info('=== PROGRESS UPDATE ===');
      logger.info(`Category: ${category} - Products: ${categoryProducts.length}`);
      logger.info(`Total Products So Far: ${allProducts.length}`);

      // Save products after each category
      if (categoryProducts.length > 0) {
        logger.info(`Exporting ${categoryProducts.length} products from ${category} to CSV...`);
        try {
          await SyscoModels.exportToCsv();
          logger.info('CSV export completed successfully');
        } catch (csvError) {
          logger.error(`CSV export error for ${category}:`, csvError.message);
          // Continue processing other categories even if CSV export fails
        }
      }

      // Small delay between categories
      await delay(syscoConfig.scraping.delays.betweenCategories);

    } catch (error) {
      logger.error(`Error scraping category ${category}:`, error.message);
      continue;
    }
  }

  return allProducts;
}

async function runScraper() {
  try {
    await initializeBrowser();
    await authenticateAsGuest();
    await handleZipCodeModal();
    
    const allProducts = await scrapeAllCategories();
    
    logger.info('=== FINAL SUMMARY ===');
    logger.info(`Total Categories Processed: ${syscoConfig.scraping.categories.length}`);
    logger.info(`Total Products Extracted: ${allProducts.length}`);
    
    const summary = {};
    syscoConfig.scraping.categories.forEach(category => {
      const categoryProducts = allProducts.filter(p => p.product_url?.includes(category.toLowerCase().replace(/\s+/g, '-')));
      summary[category] = categoryProducts.length;
    });
    
    logger.info('Products by category:', summary);
    
    if (allProducts.length > 0) {
      logger.info('Scraping completed successfully!');
      logger.info('Products saved to database and CSV exported');
    } else {
      logger.warn('No products were extracted');
    }

  } catch (error) {
    logger.error('Scraping failed:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Export for use in other modules
export { runScraper };

// Run the scraper if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper().catch(error => {
    console.error('Failed to run scraper:', error);
    process.exit(1);
  });
}
