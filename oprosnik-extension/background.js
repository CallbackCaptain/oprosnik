/**
 * background.js - Версия с активным мониторингом
 * Основная логика парсинга перенесена в background service worker
 */

console.log('🚀 Background Service Worker с активным мониторингом запущен');

// Функции для выполнения на странице (должны быть вне класса)
function extractAgentStatus() {
    const statusEl = document.querySelector('#voice-state-select-headerOptionText');
    return {
        status: statusEl ? statusEl.textContent.trim() : null,
        timestamp: Date.now()
    };
}

function extractCallData() {
    const data = {
        phone: null,
        duration: null,
        region: null,
        timestamp: Date.now()
    };
    
    // Ищем номер телефона
    const phoneEl = document.querySelector('[aria-label*="Участник"]');
    if (phoneEl) {
        data.phone = phoneEl.textContent.trim();
    }
    
    // Улучшенный поиск таймера - несколько способов
    const timerSelectors = [
        '[role="timer"]',
        '[class*="timer-timer"]',
        '[id*="call-timer"]',
        '[aria-label*="Общее время"]'
    ];
    
    for (const selector of timerSelectors) {
        const timerEl = document.querySelector(selector);
        if (timerEl && timerEl.textContent.trim()) {
            const timerText = timerEl.textContent.trim();
            // Проверяем, что это похоже на время (формат ЧЧ:ММ:СС)
            if (/\d{2}:\d{2}:\d{2}/.test(timerText)) {
                data.duration = timerText;
                console.log(`⏱️ Время найдено через селектор ${selector}: ${timerText}`);
                break;
            }
        }
    }
    
    // Дополнительный поиск времени в aria-label
    if (!data.duration) {
        const allElements = document.querySelectorAll('[aria-label*="время"]');
        for (const el of allElements) {
            const ariaLabel = el.getAttribute('aria-label');
            const timeMatch = ariaLabel.match(/(\d{2}:\d{2}:\d{2})/);
            if (timeMatch) {
                data.duration = timeMatch[1];
                console.log(`⏱️ Время найдено в aria-label: ${data.duration}`);
                break;
            }
        }
    }
    
    // Ищем регион в call variable value
    const regionEl = document.querySelector('[class*="callVariableValue"] span');
    if (regionEl) {
        data.region = regionEl.textContent.trim();
    }
    
    // Альтернативный поиск региона по id
    if (!data.region) {
        const regionAltEl = document.querySelector('[id*="call-header-variable-value"]');
        if (regionAltEl) {
            data.region = regionAltEl.textContent.trim();
        }
    }
    
    // Логирование для отладки
    console.log('📊 Извлеченные данные:', {
        phone: data.phone,
        duration: data.duration,
        region: data.region,
        foundTimerElements: document.querySelectorAll('[role="timer"], [class*="timer"], [id*="timer"]').length
    });
    
    return data;
}

// Основной класс для мониторинга Finesse
class FinesseActiveMonitor {
    constructor() {
        this.finesseTabId = null;
        this.monitoringActive = false;
        this.currentCallData = null;
        this.callHistory = [];
        this.lastAgentStatus = null;
        this.isInCall = false;
        
        // Интервалы мониторинга
        this.statusCheckInterval = 3000; // Проверка статуса каждые 3 сек
        this.activeCallInterval = 1000;  // Во время звонка каждую секунду
        
        this.init();
    }
    
    async init() {
        console.log('📡 Инициализация FinesseActiveMonitor...');
        
        // Загружаем сохраненные данные
        await this.loadStoredData();
        
        // Находим вкладку Finesse
        await this.findFinesseTab();
        
        // Создаем alarm для периодической проверки
        chrome.alarms.create('finesseStatusCheck', {
            periodInMinutes: 0.05 // каждые 3 секунды
        });
        
        // Слушаем изменения вкладок
        chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
        chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    }
    
    async findFinesseTab() {
        const tabs = await chrome.tabs.query({
            url: "https://ssial000ap008.si.rt.ru:8445/desktop/container/*"
        });
        
        if (tabs.length > 0) {
            this.finesseTabId = tabs[0].id;
            console.log('✅ Найдена вкладка Finesse:', this.finesseTabId);
            this.monitoringActive = true;
            return true;
        }
        
        console.log('❌ Вкладка Finesse не найдена');
        this.monitoringActive = false;
        return false;
    }
    
    // Обработка обновления вкладок
    handleTabUpdate(tabId, changeInfo, tab) {
        if (tabId === this.finesseTabId && changeInfo.status === 'complete') {
            console.log('🔄 Вкладка Finesse перезагружена');
            // Даем время на загрузку страницы
            setTimeout(() => this.checkAgentStatus(), 3000);
        }
    }
    
    // Обработка закрытия вкладок
    handleTabRemoved(tabId) {
        if (tabId === this.finesseTabId) {
            console.log('❌ Вкладка Finesse закрыта');
            this.finesseTabId = null;
            this.monitoringActive = false;
        }
    }
    
    // Основная функция проверки статуса агента
    async checkAgentStatus() {
        if (!this.monitoringActive || !this.finesseTabId) {
            await this.findFinesseTab();
            if (!this.finesseTabId) return;
        }
        
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: this.finesseTabId },
                func: extractAgentStatus,
                world: 'MAIN'
            });
            
            if (results && results[0] && results[0].result) {
                await this.processStatusData(results[0].result);
            }
        } catch (error) {
            console.error('❌ Ошибка при проверке статуса:', error);
            this.monitoringActive = false;
        }
    }
    
    
    // Обработка данных статуса
    async processStatusData(data) {
        if (!data.status) return;
        
        const currentStatus = data.status;
        const previousStatus = this.lastAgentStatus;
        
        // Проверяем изменение статуса
        if (currentStatus !== previousStatus) {
            console.log(`📞 Статус изменился: ${previousStatus} → ${currentStatus}`);
            
            // Начало разговора
            if (currentStatus === 'Разговор' && !this.isInCall) {
                console.log('🔔 Начат новый звонок!');
                this.isInCall = true;
                this.startActiveCallMonitoring();
            }
            
            // Завершение звонка
            if (previousStatus === 'Разговор' && currentStatus === 'Завершение') {
                console.log('☎️ Звонок завершается...');
                this.startPostCallCapture();
            }
            
            // Переход в статус "Готов" после звонка
            if (previousStatus === 'Завершение' && currentStatus === 'Готов') {
                console.log('✅ Агент готов к новым звонкам');
                // Делаем дополнительный захват данных в статусе "Готов"
                // В этом статусе данные могут быть ещё доступны
                setTimeout(async () => {
                    console.log('📊 Дополнительный захват в статусе "Готов"');
                    await this.captureCallData();
                }, 500);
            }
            
            this.lastAgentStatus = currentStatus;
        }
    }
    
    // Начинаем активный мониторинг звонка
    startActiveCallMonitoring() {
        console.log('🎯 Запуск активного мониторинга звонка');
        
        // Создаем более частый alarm
        chrome.alarms.create('activeCallMonitor', {
            periodInMinutes: 0.0167 // каждую секунду
        });
        
        // Сразу делаем первый захват
        this.captureCallData();
    }
    
    // Захват данных активного звонка
    async captureCallData() {
        if (!this.finesseTabId) return;
        
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: this.finesseTabId },
                func: extractCallData,
                world: 'MAIN'
            });
            
            if (results && results[0] && results[0].result) {
                const callData = results[0].result;
                if (callData.phone || callData.duration) {
                    this.currentCallData = callData;
                    console.log('📊 Данные звонка обновлены:', callData);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка захвата данных звонка:', error);
        }
    }
    
    
    // Пост-звонковый захват (быстрая фиксация финальных данных)
    async startPostCallCapture() {
        console.log('🔄 Запуск пост-звонкового захвата');
        
        this.isInCall = false;
        
        // Останавливаем активный мониторинг
        chrome.alarms.clear('activeCallMonitor');
        
        // Делаем быстрые попытки захвата финальных данных
        let captureAttempts = 0;
        const maxAttempts = 4; // Увеличили до 4 попыток для лучшего захвата времени
        
        const attemptCapture = async () => {
            captureAttempts++;
            console.log(`📸 Финальная попытка захвата ${captureAttempts}/${maxAttempts}`);
            
            const previousData = this.currentCallData ? {...this.currentCallData} : null;
            await this.captureCallData();
            
            // Проверяем качество захваченных данных
            const hasValidDuration = this.currentCallData?.duration && 
                                   this.currentCallData.duration !== '00:00:00' &&
                                   /\d{2}:\d{2}:\d{2}/.test(this.currentCallData.duration);
            
            const dataChanged = !previousData || 
                                previousData.duration !== this.currentCallData?.duration ||
                                previousData.phone !== this.currentCallData?.phone;
            
            // Фиксируем, если получили валидную длительность или данные изменились
            if (hasValidDuration && dataChanged) {
                console.log('✅ Получена валидная длительность, фиксируем:', this.currentCallData.duration);
                await this.finalizeCall();
                return;
            }
            
            // Если это последняя попытка - фиксируем что есть
            if (captureAttempts >= maxAttempts) {
                console.log('⏰ Финальная попытка, фиксируем имеющиеся данные');
                if (!hasValidDuration) {
                    console.warn('⚠️ Не удалось получить валидную длительность звонка');
                }
                await this.finalizeCall();
                return;
            }
            
            // Делаем следующую попытку через короткий интервал
            setTimeout(attemptCapture, 300); // Немного увеличили интервал
        };
        
        // Начинаем с небольшой задержки, чтобы данные успели обновиться
        setTimeout(attemptCapture, 150);
    }
    
    // Финализация и сохранение звонка
    async finalizeCall() {
        if (!this.currentCallData) {
            console.warn('⚠️ Нет данных для сохранения');
            return;
        }
        
        console.log('💾 Финализация звонка:', this.currentCallData);
        
        // Добавляем метаданные
        const finalCallData = {
            ...this.currentCallData,
            completedAt: new Date().toISOString(),
            savedAt: Date.now()
        };
        
        // Добавляем в историю
        this.callHistory.unshift(finalCallData);
        if (this.callHistory.length > 10) {
            this.callHistory = this.callHistory.slice(0, 10);
        }
        
        // Сохраняем в chrome.storage
        await this.saveData();
        
        // Очищаем текущие данные
        this.currentCallData = null;
        
        console.log('✅ Звонок сохранен в историю');
    }
    
    // Сохранение данных в chrome.storage
    async saveData() {
        try {
            await chrome.storage.local.set({
                callHistory: this.callHistory,
                lastCallData: this.callHistory[0] || null,
                lastAgentStatus: this.lastAgentStatus,
                lastUpdate: Date.now()
            });
            console.log('💾 Данные сохранены в storage');
        } catch (error) {
            console.error('❌ Ошибка сохранения:', error);
        }
    }
    
    // Загрузка сохраненных данных
    async loadStoredData() {
        try {
            const data = await chrome.storage.local.get([
                'callHistory', 
                'lastAgentStatus'
            ]);
            
            if (data.callHistory) {
                this.callHistory = data.callHistory;
                console.log(`📚 Загружена история: ${this.callHistory.length} звонков`);
            }
            
            if (data.lastAgentStatus) {
                this.lastAgentStatus = data.lastAgentStatus;
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
        }
    }
}

// Создаем экземпляр монитора
const monitor = new FinesseActiveMonitor();

// Обработчик alarm событий
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'finesseStatusCheck') {
        await monitor.checkAgentStatus();
    } else if (alarm.name === 'activeCallMonitor') {
        await monitor.captureCallData();
    }
});

// Обработчик сообщений от content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Получен запрос:', request.action);
    
    if (request.action === 'getCallData') {
        // Возвращаем данные из нашего монитора
        sendResponse({
            status: 'success',
            data: monitor.callHistory
        });
        return true;
    }
    
    if (request.action === 'test') {
        sendResponse({ 
            status: 'success', 
            message: 'Background service работает',
            monitorActive: monitor.monitoringActive,
            historyCount: monitor.callHistory.length
        });
        return true;
    }
});

// Диагностические функции
globalThis.monitorStatus = async function() {
    console.group('📊 Статус мониторинга');
    console.log('Активен:', monitor.monitoringActive);
    console.log('Tab ID:', monitor.finesseTabId);
    console.log('Последний статус:', monitor.lastAgentStatus);
    console.log('В звонке:', monitor.isInCall);
    console.log('Текущие данные:', monitor.currentCallData);
    console.log('История:', monitor.callHistory.length, 'звонков');
    console.groupEnd();
};

globalThis.forceCheck = async function() {
    console.log('🔄 Принудительная проверка...');
    await monitor.checkAgentStatus();
};

console.log('✅ Background Service Worker готов к работе');
console.log('💡 Команды: monitorStatus(), forceCheck()');