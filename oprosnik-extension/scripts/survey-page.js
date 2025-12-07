/**
 * survey-page.js - v5.1 Refactored
 * Объединённый скрипт для страницы опросника CTP
 * Включает: вставку данных, модификацию формы
 * @module survey-page
 */

/** @type {typeof OPROSNIK_CONFIG} */
const CONFIG = globalThis.OPROSNIK_CONFIG;

console.log(`📋 ${CONFIG.NAME} v${CONFIG.VERSION} загружен`);

// ============ МОДУЛЬ: ЗАПОЛНЕНИЕ ДЛИТЕЛЬНОСТИ ============

/**
 * Module for calculating and filling call duration field
 * Duration is calculated from call start to end time
 */
const DurationFiller = {
  /**
   * Parses time string to minutes
   * @param {string} duration - Time in "HH:MM:SS" or "MM:SS" format
   * @returns {number} Total minutes (with decimal)
   */
  parseToMinutes(duration) {
    if (!duration || typeof duration !== 'string') {
      console.warn('[DurationFiller] Некорректная длительность:', duration);
      return 0;
    }

    const parts = duration.trim().split(':').map(Number);

    if (parts.length === 3) {
      // Формат ЧЧ:ММ:СС
      const [hours, minutes, seconds] = parts;
      return hours * 60 + minutes + seconds / 60;
    } else if (parts.length === 2) {
      // Формат ММ:СС
      const [minutes, seconds] = parts;
      return minutes + seconds / 60;
    }

    console.warn('[DurationFiller] Неизвестный формат времени:', duration);
    return 0;
  },

  calculateFromTimestamps(startTime, endTime) {
    if (!startTime || !endTime) return null;

    const durationMs = endTime - startTime;
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map(v => String(v).padStart(2, '0'))
      .join(':');
  },

  /**
   * Gets select value based on minutes using centralized config
   * @param {number} minutes - Total minutes
   * @returns {string} Select option value (1-6)
   */
  getSelectValue(minutes) {
    const fullMinutes = Math.floor(minutes);
    const range = CONFIG.DURATION_RANGES.find(r => fullMinutes < r.max);
    return range?.value || '6';
  },

  /**
   * Gets label text for a select value
   * @param {string} value - Select option value
   * @returns {string} Human-readable label
   */
  getLabel(value) {
    const range = CONFIG.DURATION_RANGES.find(r => r.value === value);
    return range?.label || 'Неизвестно';
  },

  /**
   * Fills the call duration select element
   * @param {string} duration - Time in "HH:MM:SS" format
   * @param {string} [selectId='call_duration_id'] - ID of select element
   * @returns {boolean} Success status
   */
  fill(duration, selectId = 'call_duration_id') {
    const select = document.getElementById(selectId);

    if (!select) {
      console.warn('[DurationFiller] Select не найден:', selectId);
      return false;
    }

    const minutes = this.parseToMinutes(duration);
    const value = this.getSelectValue(minutes);

    const option = select.querySelector(`option[value="${value}"]`);
    if (!option) {
      console.warn('[DurationFiller] Option не найден для значения:', value);
      return false;
    }

    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('input', { bubbles: true }));

    Utils.log('⏱️', `Длительность заполнена: ${duration} → ${this.getLabel(value)}`);

    return true;
  },

  /**
   * Fills duration from call data object with optional timestamp recalculation
   * @param {Object} callData - Call data object
   * @param {string} [callData.duration] - Duration string
   * @param {number} [callData.startTime] - Call start timestamp
   * @param {number} [callData.endTime] - Call end timestamp
   * @returns {boolean} Success status
   */
  fillFromCallData(callData) {
    if (!callData) {
      Utils.log('ℹ️', 'Нет данных о звонке');
      return false;
    }

    // Если есть временные метки, рассчитываем длительность заново для уточнения
    let duration = callData.duration;
    if (callData.startTime && callData.endTime) {
      const recalculated = this.calculateFromTimestamps(callData.startTime, callData.endTime);
      if (recalculated) {
        Utils.log('ℹ️', `Длительность уточнена: ${callData.duration} → ${recalculated}`);
        duration = recalculated;
      }
    }

    if (!duration) {
      Utils.log('ℹ️', 'Нет данных о длительности');
      return false;
    }

    return this.fill(duration);
  }
};

// ============ УТИЛИТЫ ============

/**
 * Utility functions for DOM manipulation and logging
 */
const Utils = {
  /**
   * querySelector wrapper
   * @param {string} selector - CSS selector
   * @returns {Element|null}
   */
  $(selector) {
    return document.querySelector(selector);
  },

  /**
   * querySelectorAll wrapper
   * @param {string} selector - CSS selector
   * @returns {NodeListOf<Element>}
   */
  $$(selector) {
    return document.querySelectorAll(selector);
  },

  /**
   * Logs a message with emoji prefix
   * @param {string} emoji - Emoji prefix
   * @param {string} msg - Log message
   * @param {*} [data] - Optional data to log
   */
  log(emoji, msg, data = null) {
    const args = [`${emoji} [Oprosnik] ${msg}`];
    if (data) args.push(data);
    console.log(...args);
  },

  /**
   * Waits for an element to appear in the DOM
   * @param {string} selector - CSS selector
   * @param {number} [maxAttempts] - Maximum number of attempts
   * @param {number} [interval] - Interval between attempts in ms
   * @returns {Promise<Element>}
   */
  waitFor(selector, maxAttempts = CONFIG.MAX_BUTTON_ATTEMPTS, interval = CONFIG.DYNAMIC_CHECK_INTERVAL) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const check = () => {
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
          return;
        }

        if (++attempts >= maxAttempts) {
          reject(new Error(`Element ${selector} not found after ${maxAttempts} attempts`));
          return;
        }

        setTimeout(check, interval);
      };

      check();
    });
  }
};

// ============ МОДУЛЬ: МОДИФИКАЦИЯ ФОРМЫ ============

/**
 * Module for modifying form options (removing unwanted select options)
 */
const FormModifier = {
  /**
   * Initializes form modifications
   */
  init() {
    this.removeStaticOptions();
    this.startDynamicRemoval();
    Utils.log('✂️', 'Форма модифицирована');
  },

  /**
   * Removes static options from type_group select
   */
  removeStaticOptions() {
    this.removeOptions('type_group', CONFIG.OPTIONS_TO_REMOVE.type_group);
  },

  /**
   * Removes options from a select element
   * @param {string} selectId - ID of the select element
   * @param {string[]} values - Array of option values to remove
   */
  removeOptions(selectId, values) {
    const select = Utils.$(`#${selectId}`);
    if (!select) return;

    values.forEach(value => {
      const option = select.querySelector(`option[value="${value}"]`);
      option?.remove();
    });
  },

  /**
   * Sets up dynamic removal using MutationObserver for better performance
   */
  startDynamicRemoval() {
    const select = Utils.$('#type_id');
    if (!select) return;

    const observer = new MutationObserver(() => {
      this.removeOptions('type_id', CONFIG.OPTIONS_TO_REMOVE.type_id);
    });

    observer.observe(select, { childList: true, subtree: true });

    // Also do initial removal
    this.removeOptions('type_id', CONFIG.OPTIONS_TO_REMOVE.type_id);
  }
};

// ============ МОДУЛЬ: ВСТАВКА ДАННЫХ ============

/**
 * Module for handling call data insertion into survey forms
 */
const DataFiller = {
  /** @type {string} */
  originalButtonText: 'Вставить данные',

  /**
   * Initializes the data filler module
   */
  init() {
    this.createButton();
  },

  /**
   * Creates the "Insert Data" button on the page
   */
  async createButton() {
    try {
      const targetBtn = await Utils.waitFor('#create_inst');

      if (Utils.$('.oprosnik-paste-btn')) {
        Utils.log('ℹ️', 'Кнопка вставки уже существует');
        return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-success btn-lg oprosnik-paste-btn';
      btn.innerHTML = this.originalButtonText;
      btn.addEventListener('click', () => this.handleClick(btn));

      targetBtn.insertAdjacentElement('beforebegin', btn);
      Utils.log('✅', 'Кнопка вставки данных добавлена');

    } catch (e) {
      Utils.log('❌', 'Не удалось добавить кнопку вставки', e.message);
    }
  },

  /**
   * Sets button to loading state
   * @param {HTMLButtonElement} btn - The button element
   */
  setButtonLoading(btn) {
    btn.innerHTML = '⏳ Загрузка...';
    btn.disabled = true;
  },

  /**
   * Sets button to success state with auto-reset
   * @param {HTMLButtonElement} btn - The button element
   */
  setButtonSuccess(btn) {
    btn.innerHTML = '✅ Вставлено!';
    btn.disabled = false;
    setTimeout(() => {
      btn.innerHTML = this.originalButtonText;
    }, 2000);
  },

  /**
   * Resets button to original state
   * @param {HTMLButtonElement} btn - The button element
   */
  resetButton(btn) {
    btn.innerHTML = this.originalButtonText;
    btn.disabled = false;
  },

  /**
   * Handles button click - fetches data and processes it
   * @param {HTMLButtonElement} btn - The button element
   */
  async handleClick(btn) {
    this.setButtonLoading(btn);

    try {
      const response = await this.fetchCallData();
      this.processCallData(response.data, btn);
    } catch (e) {
      this.handleError(e, btn);
    }
  },

  /**
   * Fetches call data from background script
   * @returns {Promise<{status: string, data: Array}>}
   * @throws {Error} If no data or communication error
   */
  fetchCallData() {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        reject(new Error('Extension context invalidated'));
        return;
      }

      chrome.runtime.sendMessage({ action: 'getCallData' }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.status !== 'success') {
          reject(new Error(response?.message || 'Неизвестная ошибка'));
          return;
        }
        if (!response?.data?.length) {
          reject(new Error('Нет данных о звонках'));
          return;
        }
        resolve(response);
      });
    });
  },

  /**
   * Processes fetched call data
   * @param {Array} data - Array of call data objects
   * @param {HTMLButtonElement} btn - The button element
   */
  processCallData(data, btn) {
    if (data.length === 1) {
      this.insertData(data[0]);
      this.setButtonSuccess(btn);
    } else {
      this.showHistoryModal(data);
      this.resetButton(btn);
    }
  },

  /**
   * Handles errors during data fetch
   * @param {Error} e - The error object
   * @param {HTMLButtonElement} btn - The button element
   */
  handleError(e, btn) {
    Utils.log('❌', 'Ошибка получения данных', e.message);
    alert(`Ошибка: ${e.message}\n\nУбедитесь, что открыта вкладка Finesse и был завершён хотя бы один звонок.`);
    this.resetButton(btn);
  },

  /**
   * Inserts call data into the comment textarea
   * @param {Object} callData - Call data object
   * @param {string} callData.phone - Phone number
   * @param {string} callData.duration - Call duration
   * @param {string} callData.region - Region
   */
  insertData(callData) {
    const textarea = Utils.$('#comment_')
      || Utils.$('textarea[name="comment"]')
      || Utils.$('textarea.form-control');

    if (!textarea) {
      alert('Не найдено поле для комментария');
      return;
    }

    const text = `Номер: ${callData.phone || 'Н/Д'}
Длительность: ${callData.duration || 'Н/Д'}
Регион: ${callData.region || 'Н/Д'}`;

    textarea.value = textarea.value ? textarea.value + '\n\n' + text : text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.focus();

    DurationFiller.fillFromCallData(callData);

    Utils.log('📝', 'Данные вставлены', callData);
  },

  /**
   * Creates and shows the call history selection modal
   * @param {Array} history - Array of call data objects
   */
  showHistoryModal(history) {
    Utils.$('.oprosnik-modal-overlay')?.remove();

    const overlay = this.createModalOverlay();
    const modal = this.createModalContent(history);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  },

  /**
   * Creates the modal overlay element
   * @returns {HTMLDivElement}
   */
  createModalOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'oprosnik-modal-overlay';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    return overlay;
  },

  /**
   * Creates the modal content with call list
   * @param {Array} history - Array of call data objects
   * @returns {HTMLDivElement}
   */
  createModalContent(history) {
    const modal = document.createElement('div');
    modal.className = 'oprosnik-modal';
    modal.innerHTML = `
      <h3>Выберите звонок</h3>
      <p class="subtitle">Найдено: ${history.length} звонков</p>
      <div class="call-list"></div>
      <button class="close-btn">Закрыть</button>
    `;

    const list = modal.querySelector('.call-list');
    history.forEach((call, i) => {
      list.appendChild(this.createCallItem(call, i));
    });

    modal.querySelector('.close-btn').addEventListener('click', () => {
      modal.closest('.oprosnik-modal-overlay')?.remove();
    });

    return modal;
  },

  /**
   * Creates a single call item for the modal list
   * @param {Object} call - Call data object
   * @param {number} index - Item index
   * @returns {HTMLDivElement}
   */
  createCallItem(call, index) {
    const item = document.createElement('div');
    item.className = 'call-item';
    item.innerHTML = `
      <div class="call-main">
        <span class="phone">📞 ${call.phone || 'Н/Д'}</span>
        ${index === 0 ? '<span class="badge">Последний</span>' : ''}
      </div>
      <div class="call-details">
        ⏱ ${call.duration || 'Н/Д'} · 📍 ${call.region || 'Н/Д'}
      </div>
      <div class="call-time">${call.capturedAt || ''}</div>
    `;

    item.addEventListener('click', () => {
      this.insertData(call);
      item.closest('.oprosnik-modal-overlay')?.remove();
    });

    return item;
  }
};

// ============ ИНИЦИАЛИЗАЦИЯ ============

/**
 * Initializes all modules
 */
function init() {
  FormModifier.init();
  DataFiller.init();
  Utils.log('🚀', 'Все модули инициализированы');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * Debug function for troubleshooting
 * Usage: debugOprosnik() in browser console
 */
window.debugOprosnik = () => {
  console.group(`🔧 Debug ${CONFIG.NAME} v${CONFIG.VERSION}`);
  console.log('Config:', CONFIG);
  console.log('Кнопка вставки:', Utils.$('.oprosnik-paste-btn'));
  console.log('Поле комментария:', Utils.$('#comment_'));
  console.log('Chrome Runtime:', !!chrome.runtime?.id);
  console.groupEnd();
};
