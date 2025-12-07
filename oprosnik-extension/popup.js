/**
 * popup.js - v5.1 Refactored
 * Extension popup UI logic
 * @module popup
 */

/** @type {(id: string) => HTMLElement|null} */
const $ = id => document.getElementById(id);

// Config will be loaded from storage or use defaults
const DEFAULT_CONFIG = {
  FINESSE_URL: 'https://ssial000ap008.si.rt.ru:8445/desktop/container/*',
  CTP_URL: 'https://ctp.rt.ru/quiz',
  STATUS_UPDATE_INTERVAL_MS: 2000
};

/**
 * Safely queries for tabs with error handling
 * @param {chrome.tabs.QueryInfo} queryInfo
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
async function safeTabs(queryInfo) {
  try {
    return await chrome.tabs.query(queryInfo);
  } catch (e) {
    console.error('Tab query error:', e);
    return [];
  }
}

/**
 * Safely gets data from storage with error handling
 * @param {string[]} keys
 * @returns {Promise<Object>}
 */
async function safeStorage(keys) {
  try {
    return await chrome.storage.local.get(keys);
  } catch (e) {
    console.error('Storage error:', e);
    return {};
  }
}

/**
 * Updates the popup status display
 */
async function updateStatus() {
  try {
    const tabs = await safeTabs({ url: DEFAULT_CONFIG.FINESSE_URL });
    const finesseActive = tabs.length > 0;

    const dotFinesse = $('dotFinesse');
    const dotMonitor = $('dotMonitor');
    const callCount = $('callCount');
    const agentStatus = $('agentStatus');

    if (dotFinesse) dotFinesse.classList.toggle('active', finesseActive);
    if (dotMonitor) dotMonitor.classList.toggle('active', finesseActive);

    const data = await safeStorage(['callHistory', 'lastAgentStatus']);

    if (callCount) callCount.textContent = data.callHistory?.length || 0;
    if (agentStatus) agentStatus.textContent = data.lastAgentStatus || 'Неизвестен';

  } catch (e) {
    console.error('Status update error:', e);
  }
}

/**
 * Opens or switches to the survey tab
 */
async function openSurvey() {
  try {
    const url = DEFAULT_CONFIG.CTP_URL;
    const tabs = await safeTabs({ url: url + '*' });

    if (tabs.length > 0 && tabs[0].id) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url });
    }

    window.close();
  } catch (e) {
    console.error('Open survey error:', e);
    alert('Не удалось открыть опросник');
  }
}

/**
 * Toggles the sidebar on the current CTP page
 */
async function toggleSidebar() {
  try {
    const [tab] = await safeTabs({ active: true, currentWindow: true });

    if (!tab?.url?.includes('ctp.rt.ru')) {
      alert('Эта функция работает только на странице опросника (ctp.rt.ru)');
      return;
    }

    if (!tab.id) {
      alert('Не удалось получить доступ к вкладке');
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sidebarToggle = document.querySelector('.nav-link[data-widget="pushmenu"]');
        if (sidebarToggle) {
          sidebarToggle.click();
        }

        const sidebar = document.querySelector('.main-sidebar');
        if (sidebar) {
          sidebar.remove();
        }

        document.body.classList.add('sidebar-hidden-by-extension');
      }
    });
  } catch (e) {
    console.error('Toggle sidebar error:', e);
    alert('Не удалось переключить сайдбар');
  }
}

// Event Listeners
$('btnOpenSurvey')?.addEventListener('click', openSurvey);
$('btnToggleSidebar')?.addEventListener('click', toggleSidebar);

// Initialize
updateStatus();
setInterval(updateStatus, DEFAULT_CONFIG.STATUS_UPDATE_INTERVAL_MS);
