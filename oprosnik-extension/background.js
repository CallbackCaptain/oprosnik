/**
 * background.js - v5.1 Refactored
 * Мониторинг Cisco Finesse и управление данными звонков
 * @module background
 */

// Import centralized config
importScripts('config.js');

/** @type {typeof OPROSNIK_CONFIG} */
const CONFIG = globalThis.OPROSNIK_CONFIG;

console.log(`🚀 ${CONFIG.NAME} v${CONFIG.VERSION} - Background Service Worker`);

// ============ УТИЛИТЫ ============
const Utils = {
  /**
   * Formats milliseconds to HH:MM:SS string
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration string
   */
  formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
  },

  /**
   * Logs a message with emoji prefix
   * @param {string} emoji - Emoji prefix
   * @param {string} message - Log message
   * @param {*} [data] - Optional data to log
   */
  log(emoji, message, data = null) {
    const args = [`${emoji} ${message}`];
    if (data) args.push(data);
    console.log(...args);
  }
};

// ============ ФУНКЦИИ ИЗВЛЕЧЕНИЯ ДАННЫХ (выполняются в контексте страницы) ============

/**
 * @typedef {Object} CallData
 * @property {string|null} phone - Phone number
 * @property {string|null} duration - Call duration in HH:MM:SS format
 * @property {string|null} region - Region name
 */

/**
 * Extracts agent status from Finesse UI (runs in page context)
 * @returns {string|null} Agent status text
 */
function extractAgentStatus() {
  const el = document.querySelector('#voice-state-select-headerOptionText');
  return el?.textContent?.trim() || null;
}

/**
 * Extracts call data from Finesse UI (runs in page context)
 * @returns {CallData} Call data object
 */
function extractCallData() {
  const result = { phone: null, duration: null, region: null };

  // Телефон
  const phoneEl = document.querySelector('[aria-label*="Участник"]');
  if (phoneEl) result.phone = phoneEl.textContent.trim();

  // Длительность - ищем элемент с форматом ЧЧ:ММ:СС
  const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
  const selectors = [
    '[role="timer"]',
    '[class*="timer-timer"]',
    '[id*="call-timer"]'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent && timeRegex.test(el.textContent.trim())) {
      result.duration = el.textContent.trim();
      break;
    }
  }

  // Если не нашли по селекторам - полный поиск
  if (!result.duration) {
    for (const el of document.querySelectorAll('*')) {
      const text = el.textContent?.trim();
      if (text && timeRegex.test(text) && el.childElementCount === 0) {
        result.duration = text;
        break;
      }
    }
  }

  // Регион
  const regionEl = document.querySelector('[class*="callVariableValue"] span')
    || document.querySelector('[id*="call-header-variable-value"]');
  if (regionEl) result.region = regionEl.textContent.trim();

  return result;
}

// ============ КЛАСС МОНИТОРА ============

/**
 * Monitors Cisco Finesse for agent status and call data
 * @class
 */
class FinesseMonitor {
  constructor() {
    /** @type {number|null} */
    this.tabId = null;
    /** @type {boolean} */
    this.isActive = false;
    /** @type {string|null} */
    this.lastStatus = null;
    /** @type {boolean} */
    this.isInCall = false;
    /** @type {number|null} */
    this.callStartTime = null;
    /** @type {CallData|null} */
    this.currentCallData = null;
    /** @type {Array<Object>} */
    this.callHistory = [];
  }
  
  async init() {
    Utils.log('📡', 'Инициализация монитора...');
    await this.loadHistory();
    await this.findTab();
    this.setupAlarms();
    this.setupListeners();
  }
  
  async loadHistory() {
    const { callHistory = [] } = await chrome.storage.local.get('callHistory');
    this.callHistory = callHistory;
    Utils.log('📚', `Загружено звонков: ${this.callHistory.length}`);
  }
  
  async findTab() {
    const tabs = await chrome.tabs.query({ url: CONFIG.FINESSE_URL });
    this.tabId = tabs[0]?.id || null;
    this.isActive = !!this.tabId;
    Utils.log(this.isActive ? '✅' : '❌', 
      this.isActive ? `Finesse найден: tab ${this.tabId}` : 'Finesse не найден');
  }
  
  setupAlarms() {
    chrome.alarms.create('statusCheck', { periodInMinutes: CONFIG.CHECK_INTERVAL_MS / 60000 });
  }
  
  setupListeners() {
    chrome.tabs.onUpdated.addListener((tabId, info) => {
      if (tabId === this.tabId && info.status === 'complete') {
        setTimeout(() => this.checkStatus(), 3000);
      }
    });
    
    chrome.tabs.onRemoved.addListener(tabId => {
      if (tabId === this.tabId) {
        this.tabId = null;
        this.isActive = false;
        Utils.log('❌', 'Вкладка Finesse закрыта');
      }
    });
  }
  
  async executeOnTab(func) {
    if (!this.tabId) return null;
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func,
        world: 'MAIN'
      });
      return result?.result;
    } catch (e) {
      Utils.log('❌', 'Ошибка выполнения скрипта', e.message);
      this.isActive = false;
      return null;
    }
  }
  
  async checkStatus() {
    if (!this.isActive) {
      await this.findTab();
      if (!this.tabId) return;
    }
    
    const status = await this.executeOnTab(extractAgentStatus);
    if (!status || status === this.lastStatus) return;
    
    Utils.log('📞', `Статус: ${this.lastStatus} → ${status}`);
    
    // Начало звонка
    if (status === 'Разговор' && !this.isInCall) {
      this.isInCall = true;
      this.callStartTime = Date.now();
      this.startActiveMonitoring();
    }
    
    // Завершение звонка
    if (this.lastStatus === 'Разговор' && status === 'Завершение') {
      this.stopActiveMonitoring();
      await this.captureAndSave();
    }
    
    this.lastStatus = status;
  }
  
  startActiveMonitoring() {
    Utils.log('🎯', 'Активный мониторинг звонка');
    chrome.alarms.create('activeCall', { periodInMinutes: CONFIG.ACTIVE_CALL_INTERVAL_MS / 60000 });
    this.captureCallData();
  }
  
  stopActiveMonitoring() {
    chrome.alarms.clear('activeCall');
    this.isInCall = false;
  }
  
  async captureCallData() {
    const data = await this.executeOnTab(extractCallData);
    if (data?.phone || data?.duration) {
      this.currentCallData = data;
    }
  }
  
  async captureAndSave() {
    Utils.log('🔄', 'Захват финальных данных...');

    const callEndTime = Date.now();
    const calculatedDuration = Utils.formatDuration(callEndTime - this.callStartTime);

    // Быстрые попытки захвата из интерфейса
    for (let i = 0; i < CONFIG.POST_CALL_ATTEMPTS; i++) {
      await this.captureCallData();

      const hasDuration = this.currentCallData?.duration
        && this.currentCallData.duration !== '00:00:00';

      if (hasDuration) {
        Utils.log('✅', 'Данные из интерфейса получены');
        break;
      }

      await new Promise(r => setTimeout(r, CONFIG.POST_CALL_DELAY_MS));
    }

    // Формируем финальные данные
    const callData = {
      phone: this.currentCallData?.phone || 'Неизвестно',
      duration: calculatedDuration,
      region: this.currentCallData?.region || 'Не указан',
      startTime: this.callStartTime,
      endTime: callEndTime,
      timestamp: Date.now(),
      capturedAt: new Date().toLocaleTimeString('ru-RU'),
      source: 'calculated'
    };
    
    // Сохраняем
    this.callHistory.unshift(callData);
    this.callHistory = this.callHistory.slice(0, CONFIG.MAX_HISTORY);
    
    await chrome.storage.local.set({
      callHistory: this.callHistory,
      lastCallData: callData,
      lastUpdate: Date.now()
    });
    
    Utils.log('💾', 'Звонок сохранён', callData);
    
    // Очищаем
    this.currentCallData = null;
    this.callStartTime = null;
  }
  
  getStatus() {
    return {
      isActive: this.isActive,
      tabId: this.tabId,
      lastStatus: this.lastStatus,
      isInCall: this.isInCall,
      historyCount: this.callHistory.length
    };
  }
}

// ============ ИНИЦИАЛИЗАЦИЯ ============
const monitor = new FinesseMonitor();
monitor.init();

// ============ ОБРАБОТЧИКИ ============
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'statusCheck') monitor.checkStatus();
  if (alarm.name === 'activeCall') monitor.captureCallData();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  Utils.log('📨', `Запрос: ${request.action}`);
  
  switch (request.action) {
    case 'getCallData':
      sendResponse({ status: 'success', data: monitor.callHistory });
      break;
      
    case 'getStatus':
      sendResponse({ status: 'success', data: monitor.getStatus() });
      break;
      
    case 'forceCheck':
      monitor.checkStatus().then(() => {
        sendResponse({ status: 'success' });
      });
      return true; // async response
      
    default:
      sendResponse({ status: 'error', message: 'Unknown action' });
  }
});

// ============ DEBUG ============
globalThis.monitorStatus = () => console.table(monitor.getStatus());
globalThis.forceCheck = () => monitor.checkStatus();

Utils.log('✅', 'Background Service Worker готов');
