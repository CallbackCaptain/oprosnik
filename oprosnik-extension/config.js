/**
 * config.js - Centralized configuration for Oprosnik Helper
 * All shared constants and URLs should be defined here
 */

const OPROSNIK_CONFIG = {
  // URLs
  FINESSE_URL: 'https://ssial000ap008.si.rt.ru:8445/desktop/container/*',
  FINESSE_HOST: 'https://ssial000ap008.si.rt.ru:8445/*',
  CTP_URL: 'https://ctp.rt.ru/quiz',
  CTP_HOST: 'https://ctp.rt.ru/*',

  // Timing
  CHECK_INTERVAL_MS: 3000,
  ACTIVE_CALL_INTERVAL_MS: 1000,
  POST_CALL_ATTEMPTS: 3,
  POST_CALL_DELAY_MS: 100,
  STATUS_UPDATE_INTERVAL_MS: 2000,
  DYNAMIC_CHECK_INTERVAL: 500,
  MAX_BUTTON_ATTEMPTS: 10,

  // Limits
  MAX_HISTORY: 10,

  // Duration ranges for call duration select
  DURATION_RANGES: [
    { max: 1, value: '1', label: '0-1 мин' },
    { max: 2, value: '2', label: '1-2 мин' },
    { max: 3, value: '3', label: '2-3 мин' },
    { max: 4, value: '4', label: '3-4 мин' },
    { max: 5, value: '5', label: '4-5 мин' },
    { max: Infinity, value: '6', label: '5+ мин' }
  ],

  // Form options to remove (survey page)
  OPTIONS_TO_REMOVE: {
    'type_group': ['КДГ 1 ЛТП'],
    'type_id': [
      "9", "20", "22", "23", "27", "333", "334", "337", "354", "375", "388", "402", "404", "405",
      "35", "37", "41", "42", "43", "44", "46", "52", "53", "56", "338", "339", "340", "345", "346",
      "349", "353", "355", "356", "379", "381", "384", "394", "400", "401", "362", "369", "364",
      "365", "390", "370", "367", "67", "371", "33", "399", "398"
    ]
  },

  // Version info
  VERSION: '5.0.0',
  NAME: 'Oprosnik Helper'
};

// Make available globally (for content scripts and background)
if (typeof globalThis !== 'undefined') {
  globalThis.OPROSNIK_CONFIG = OPROSNIK_CONFIG;
}

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OPROSNIK_CONFIG;
}
