/**
 * finesse-page.js - v5.1 Refactored
 * Minimal script for Finesse page
 * Shows visual indicator and responds to ping messages
 * @module finesse-page
 */

/** @type {typeof OPROSNIK_CONFIG} */
const CONFIG = globalThis.OPROSNIK_CONFIG;

/**
 * Logs a message with emoji prefix (consistent with other modules)
 * @param {string} emoji - Emoji prefix
 * @param {string} msg - Log message
 */
function log(emoji, msg) {
  console.log(`${emoji} [Oprosnik] ${msg}`);
}

log('✅', `${CONFIG.NAME} v${CONFIG.VERSION}: Finesse page script loaded`);

/**
 * Creates and shows the activity indicator badge
 */
function createIndicator() {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font: 12px -apple-system, sans-serif;
    z-index: 99999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    opacity: 0.9;
    transition: opacity 0.3s;
  `;
  indicator.textContent = `📋 ${CONFIG.NAME}`;
  indicator.addEventListener('mouseenter', () => indicator.style.opacity = '0.3');
  indicator.addEventListener('mouseleave', () => indicator.style.opacity = '0.9');
  document.body.appendChild(indicator);

  // Auto-fade after 5 seconds
  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 5000);
}

/**
 * Sets up message listener for ping/pong communication
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({
        status: 'pong',
        url: window.location.href,
        version: CONFIG.VERSION
      });
    }
    return true;
  });
}

// Initialize
createIndicator();
setupMessageListener();
