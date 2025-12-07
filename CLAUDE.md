# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome/browser extension called "Oprosnik Helper" (version 5.1.0) that assists with filling out surveys by automatically copying data from Cisco Finesse. The extension is designed for internal use at RT (Rostelecom) and integrates with their CTP survey system.

## Architecture

The extension follows Chrome Extension Manifest V3 architecture with these core components:

### Centralized Configuration (`config.js`)
- **Purpose**: Single source of truth for all URLs, timing constants, and settings
- **Key Constants**: `FINESSE_URL`, `CTP_URL`, `DURATION_RANGES`, `OPTIONS_TO_REMOVE`
- **Usage**: Imported via `importScripts()` in background.js, auto-loaded as content script

### Background Service Worker (`background.js`)
- **Primary Function**: Active monitoring of Cisco Finesse agent status and call data
- **Key Class**: `FinesseMonitor` - monitors agent status changes and captures call data
- **Monitoring Strategy**:
  - Status checks every 3 seconds via alarms
  - Active call monitoring every 1 second during calls
  - Post-call capture with enhanced monitoring after call completion
- **Data Storage**: Uses `chrome.storage.local` for call history and agent status
- **Host**: Monitors `https://ssial000ap008.si.rt.ru:8445/desktop/container/*`

### Content Scripts
1. **Survey Page (`scripts/survey-page.js`)**:
   - Unified script combining form modification, data filling, and duration calculation
   - **Modules**: `DurationFiller`, `FormModifier`, `DataFiller`, `Utils`
   - Creates "Вставить данные" button on survey pages
   - Communicates with background worker to get call data
   - Shows call history modal for selection when multiple calls exist
   - Removes specific options from dropdown lists
   - Targets survey forms on `https://ctp.rt.ru/quiz*`

2. **Finesse Page (`scripts/finesse-page.js`)**:
   - Minimal script for Finesse pages
   - Provides visual indicator of extension activity
   - Responds to ping requests from background worker

### Popup UI (`popup.html`, `popup.js`)
- Status display for Finesse connection and monitoring
- Quick buttons: Open Survey, Toggle Sidebar
- Call history count and agent status display

### Key Data Flow
1. Background worker monitors Finesse for agent status changes
2. When call starts (status = "Разговор"), begins active data capture
3. When call ends (status = "Завершение"), performs enhanced post-call capture
4. Call data includes: phone number, duration, region, timestamps
5. Data is stored in call history (max 10 calls) in chrome.storage
6. Survey pages can request and display this data via the DataFiller module

## Extension Permissions
- `alarms`: For periodic monitoring
- `storage`: Call history and settings
- `tabs`: Tab management and detection
- `scripting`: Content script injection
- Host permissions for CTP and Finesse domains

## Key Files
```
oprosnik-extension/
├── manifest.json              # Extension configuration (MV3)
├── config.js                  # Centralized configuration
├── background.js              # Service Worker (FinesseMonitor)
├── popup.html                 # Popup UI
├── popup.js                   # Popup logic
├── scripts/
│   ├── survey-page.js         # Main content script (CTP pages)
│   └── finesse-page.js        # Finesse page indicator
├── css/
│   └── styles.css             # All extension styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Development Notes
- No package.json exists - this is a pure browser extension
- No build process required - direct file deployment
- Extension loads content scripts automatically based on URL patterns
- All logging uses `Utils.log(emoji, message)` pattern with `[Oprosnik]` prefix
- Uses Chrome Extension APIs exclusively (not web APIs)
- JSDoc annotations throughout for type hints

## Testing the Extension
1. Load extension in Chrome developer mode
2. Navigate to Finesse URL to activate monitoring
3. Navigate to CTP survey URL to test form modifications and data insertion
4. Check browser console for detailed logging with emoji indicators
5. Use `debugOprosnik()` function in console for diagnostics
6. Use `monitorStatus()` in background console for monitor state
