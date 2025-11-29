/**
 * survey-page.js - v5.0
 * Объединённый скрипт для страницы опросника CTP
 * Включает: вставку данных, модификацию формы, управление сайдбаром
 */

console.log('📋 Oprosnik Helper v5.0 загружен');

// ============ КОНФИГУРАЦИЯ ============
const CONFIG = {
  // Опции для удаления из селекторов
  OPTIONS_TO_REMOVE: {
    'type_group': ['КДГ 1 ЛТП'],
    'type_id': ['333', '42', '400']
  },
  // Интервал проверки динамических элементов
  DYNAMIC_CHECK_INTERVAL: 500,
  // Максимум попыток найти кнопку
  MAX_BUTTON_ATTEMPTS: 10
};

// ============ УТИЛИТЫ ============
const Utils = {
  $(selector) {
    return document.querySelector(selector);
  },
  
  $$(selector) {
    return document.querySelectorAll(selector);
  },
  
  log(emoji, msg, data = null) {
    const args = [`${emoji} [Oprosnik] ${msg}`];
    if (data) args.push(data);
    console.log(...args);
  },
  
  waitFor(selector, maxAttempts = 10, interval = 500) {
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
const FormModifier = {
  init() {
    this.hideCallDuration();
    this.removeStaticOptions();
    this.startDynamicRemoval();
    Utils.log('✂️', 'Форма модифицирована');
  },
  
  hideCallDuration() {
    const select = Utils.$('#call_duration_id');
    const container = select?.closest('.row');
    if (container) {
      container.style.display = 'none';
    }
  },
  
  removeStaticOptions() {
    this.removeOptions('type_group', CONFIG.OPTIONS_TO_REMOVE.type_group);
  },
  
  removeOptions(selectId, values) {
    const select = Utils.$(`#${selectId}`);
    if (!select) return;
    
    values.forEach(value => {
      const option = select.querySelector(`option[value="${value}"]`);
      option?.remove();
    });
  },
  
  startDynamicRemoval() {
    // Используем MutationObserver вместо setInterval для лучшей производительности
    const select = Utils.$('#type_id');
    if (!select) return;
    
    const observer = new MutationObserver(() => {
      this.removeOptions('type_id', CONFIG.OPTIONS_TO_REMOVE.type_id);
    });
    
    observer.observe(select, { childList: true, subtree: true });
    
    // Также делаем первичное удаление
    this.removeOptions('type_id', CONFIG.OPTIONS_TO_REMOVE.type_id);
  }
};

// ============ МОДУЛЬ: УПРАВЛЕНИЕ САЙДБАРОМ ============
const SidebarManager = {
  init() {
    this.createToggleButton();
  },
  
  createToggleButton() {
    const navbar = Utils.$('.main-header .navbar-nav');
    if (!navbar) return;
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn oprosnik-sidebar-btn';
    btn.innerHTML = '☰ Сайдбар';
    btn.addEventListener('click', this.toggle);
    
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.appendChild(btn);
    navbar.appendChild(li);
    
    Utils.log('📌', 'Кнопка сайдбара добавлена');
  },
  
  toggle() {
    document.body.classList.toggle('sidebar-hidden-by-extension');
    const hidden = document.body.classList.contains('sidebar-hidden-by-extension');
    Utils.log('📂', hidden ? 'Сайдбар скрыт' : 'Сайдбар показан');
  }
};

// ============ МОДУЛЬ: ВСТАВКА ДАННЫХ ============
const DataFiller = {
  init() {
    this.createButton();
  },
  
  async createButton() {
    try {
      const targetBtn = await Utils.waitFor('#create_inst', CONFIG.MAX_BUTTON_ATTEMPTS);
      
      // Проверяем, не добавлена ли уже кнопка
      if (Utils.$('.oprosnik-paste-btn')) {
        Utils.log('ℹ️', 'Кнопка вставки уже существует');
        return;
      }
      
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-success oprosnik-paste-btn';
      btn.innerHTML = '📞 Вставить данные';
      btn.addEventListener('click', () => this.handleClick(btn));
      
      targetBtn.insertAdjacentElement('afterend', btn);
      Utils.log('✅', 'Кнопка вставки данных добавлена');
      
    } catch (e) {
      Utils.log('❌', 'Не удалось добавить кнопку вставки', e.message);
    }
  },
  
  async handleClick(btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Загрузка...';
    btn.disabled = true;
    
    try {
      const response = await this.getCallData();
      
      if (!response?.data?.length) {
        throw new Error('Нет данных о звонках');
      }
      
      if (response.data.length === 1) {
        this.insertData(response.data[0]);
        btn.innerHTML = '✅ Вставлено!';
      } else {
        this.showHistoryModal(response.data);
        btn.innerHTML = originalText;
      }
      
    } catch (e) {
      Utils.log('❌', 'Ошибка получения данных', e.message);
      alert(`Ошибка: ${e.message}\n\nУбедитесь, что открыта вкладка Finesse и был завершён хотя бы один звонок.`);
      btn.innerHTML = originalText;
    }
    
    btn.disabled = false;
    
    // Возвращаем исходный текст через 2 сек
    if (btn.innerHTML === '✅ Вставлено!') {
      setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    }
  },
  
  getCallData() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getCallData' }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.status !== 'success') {
          reject(new Error(response?.message || 'Неизвестная ошибка'));
          return;
        }
        resolve(response);
      });
    });
  },
  
  insertData(callData) {
    const textarea = Utils.$('#comment_') 
      || Utils.$('textarea[name="comment"]')
      || Utils.$('textarea.form-control');
    
    if (!textarea) {
      alert('Не найдено поле для комментария');
      return;
    }
    
    const text = `Номер: ${callData.phone}
Длительность: ${callData.duration}
Регион: ${callData.region}`;
    
    textarea.value = text + '\n\n' + textarea.value;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.focus();
    
    Utils.log('📝', 'Данные вставлены', callData);
  },
  
  showHistoryModal(history) {
    // Удаляем старый модал если есть
    Utils.$('.oprosnik-modal-overlay')?.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'oprosnik-modal-overlay';
    
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
      const item = document.createElement('div');
      item.className = 'call-item';
      item.innerHTML = `
        <div class="call-main">
          <span class="phone">📞 ${call.phone}</span>
          ${i === 0 ? '<span class="badge">Последний</span>' : ''}
        </div>
        <div class="call-details">
          ⏱ ${call.duration} · 📍 ${call.region}
        </div>
        <div class="call-time">${call.capturedAt || ''}</div>
      `;
      
      item.addEventListener('click', () => {
        this.insertData(call);
        overlay.remove();
      });
      
      list.appendChild(item);
    });
    
    modal.querySelector('.close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }
};

// ============ ИНИЦИАЛИЗАЦИЯ ============
function init() {
  FormModifier.init();
  SidebarManager.init();
  DataFiller.init();
  Utils.log('🚀', 'Все модули инициализированы');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Debug функция
window.debugOprosnik = () => {
  console.group('🔧 Debug Oprosnik Helper');
  console.log('Кнопка вставки:', Utils.$('.oprosnik-paste-btn'));
  console.log('Кнопка сайдбара:', Utils.$('.oprosnik-sidebar-btn'));
  console.log('Поле комментария:', Utils.$('#comment_'));
  console.log('Chrome Runtime:', !!chrome.runtime?.id);
  console.groupEnd();
};
