/**
 * finesse-page.js - Минимальный скрипт для страницы Finesse
 * Визуальный индикатор + ответы на ping
 */

console.log('✅ Oprosnik Helper: Finesse page script loaded');

// Показываем индикатор активности
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
indicator.textContent = '📋 Oprosnik Helper';
indicator.addEventListener('mouseenter', () => indicator.style.opacity = '0.3');
indicator.addEventListener('mouseleave', () => indicator.style.opacity = '0.9');
document.body.appendChild(indicator);

// Удаляем через 5 секунд
setTimeout(() => {
  indicator.style.opacity = '0';
  setTimeout(() => indicator.remove(), 300);
}, 5000);

// Ответ на ping от background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ 
      status: 'pong',
      url: window.location.href 
    });
  }
  return true;
});
