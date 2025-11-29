/**
 * popup.js - Простой popup без фреймворков
 */

const $ = id => document.getElementById(id);

// Обновление статуса
async function updateStatus() {
  try {
    // Проверяем Finesse
    const tabs = await chrome.tabs.query({
      url: 'https://ssial000ap008.si.rt.ru:8445/desktop/container/*'
    });
    
    const finesseActive = tabs.length > 0;
    $('dotFinesse').classList.toggle('active', finesseActive);
    
    // Получаем данные из storage
    const data = await chrome.storage.local.get(['callHistory', 'lastAgentStatus']);
    
    $('dotMonitor').classList.toggle('active', finesseActive);
    $('callCount').textContent = data.callHistory?.length || 0;
    $('agentStatus').textContent = data.lastAgentStatus || 'Неизвестен';
    
  } catch (e) {
    console.error('Ошибка обновления статуса:', e);
  }
}

// Открыть опросник
$('btnOpenSurvey').addEventListener('click', async () => {
  const url = 'https://ctp.rt.ru/quiz';
  
  // Ищем уже открытую вкладку
  const tabs = await chrome.tabs.query({ url: url + '*' });
  
  if (tabs.length > 0) {
    // Переключаемся на существующую
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Открываем новую
    await chrome.tabs.create({ url });
  }
  
  window.close();
});

// Переключить сайдбар
$('btnToggleSidebar').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.url?.includes('ctp.rt.ru')) {
    alert('Эта функция работает только на странице опросника (ctp.rt.ru)');
    return;
  }
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.body.classList.toggle('sidebar-hidden-by-extension');
      }
    });
  } catch (e) {
    console.error('Ошибка переключения сайдбара:', e);
    alert('Не удалось переключить сайдбар');
  }
});

// Инициализация
updateStatus();
setInterval(updateStatus, 2000);
