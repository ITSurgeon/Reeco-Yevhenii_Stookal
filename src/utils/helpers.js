/**
 * Utilities - Essential Helper Functions
 * Contains only the helper functions that are actually used in the codebase
 */

import logger from './logger.js';

/**
 * Execution delay
 * @param {number} ms - Milliseconds
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes operation with retry attempts
 * @param {Function} operation - Function to execute
 * @param {Object} options - Retry options
 * @returns {Promise} Operation result
 */
export async function retry(operation, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    exponentialBackoff = true,
    retryCondition = () => true
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        logger.info(`Operation successful after ${attempt} attempts`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      logger.warn(`Attempt ${attempt} failed: ${error.message}`);
      
      // Check if we should retry
      if (!retryCondition(error) || attempt >= maxRetries + 1) {
        break;
      }
      
      // Calculate delay
      const retryDelay = exponentialBackoff 
        ? baseDelay * Math.pow(2, attempt - 1)
        : baseDelay;
      
      logger.info(`Waiting ${retryDelay}ms before retry attempt ${attempt + 1}...`);
      await delay(retryDelay);
    }
  }
  
  logger.error(`All retry attempts failed. Last error: ${lastError.message}`);
  throw lastError;
}

/**
 * Check if error type should be retried
 * @param {Error} error - Error object
 */
export function shouldRetryError(error) {
  const retryableErrors = [
    'TimeoutError',
    'ProtocolError',
    'NetworkError',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'Failed to extract details'
  ];
  
  return retryableErrors.some(errorType => 
    error.name.includes(errorType) || error.message.includes(errorType)
  );
}
