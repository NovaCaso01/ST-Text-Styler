/**
 * 텍스트 꾸미기 (ST-Text-Styler) - 설정 저장/로드
 */

import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { extensionName, defaultSettings } from './constants.js';
import { log } from './state.js';

/**
 * 설정 로드
 */
export async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    
    // 기본값 병합
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    
    // 개별 필드 기본값 적용 (마이그레이션 지원)
    const settings = extension_settings[extensionName];
    
    if (settings.enabled === undefined) {
        settings.enabled = true;
    }
    if (!settings.globalRules) {
        // 기존 rules를 globalRules로 마이그레이션
        settings.globalRules = settings.rules || [];
        delete settings.rules;
    }
    if (!settings.chatRules) {
        settings.chatRules = {};
    }
    if (!settings.theme) {
        settings.theme = 'mono-gray';
    }
    if (!settings.quickHideType) {
        settings.quickHideType = 'color';
    }
    if (!settings.quickHideValue) {
        settings.quickHideValue = '#000000';
    }
    if (settings.lastProfileId === undefined) {
        settings.lastProfileId = '';
    }
    
    // 기존 presets/chatPresets 제거 (마이그레이션)
    delete settings.presets;
    delete settings.chatPresets;
    
    log('Settings loaded:', settings);
}

/**
 * 설정 가져오기
 * @returns {Object}
 */
export function getSettings() {
    return extension_settings[extensionName] || {};
}

/**
 * 설정 저장
 */
export function saveSettings() {
    saveSettingsDebounced();
}

// ===== 글로벌 규칙 관리 =====

/**
 * 글로벌 규칙 추가
 * @param {Object} rule - 새 규칙
 */
export function addGlobalRule(rule) {
    const settings = getSettings();
    settings.globalRules.push(rule);
    saveSettings();
}

/**
 * 글로벌 규칙 수정
 * @param {number} index - 규칙 인덱스
 * @param {Object} rule - 수정된 규칙
 */
export function updateGlobalRule(index, rule) {
    const settings = getSettings();
    if (index >= 0 && index < settings.globalRules.length) {
        settings.globalRules[index] = rule;
        saveSettings();
    }
}

/**
 * 글로벌 규칙 삭제
 * @param {number} index - 규칙 인덱스
 */
export function deleteGlobalRule(index) {
    const settings = getSettings();
    if (index >= 0 && index < settings.globalRules.length) {
        settings.globalRules.splice(index, 1);
        saveSettings();
    }
}

/**
 * 글로벌 규칙 목록 가져오기
 * @returns {Array}
 */
export function getGlobalRules() {
    const settings = getSettings();
    return settings.globalRules || [];
}

// ===== 채팅방별 규칙 관리 =====

/**
 * 현재 채팅방 ID 가져오기
 * @returns {string|null}
 */
export function getCurrentChatId() {
    try {
        // SillyTavern의 getContext에서 채팅 ID 가져오기
        const context = window.SillyTavern?.getContext?.() || window.getContext?.();
        if (context) {
            // 그룹 채팅인 경우 - 그룹 ID + 채팅 파일명 조합
            if (context.groupId !== undefined && context.groupId !== null) {
                const chatFile = context.chat_metadata?.main_chat || context.chatId || 'default';
                return `group_${context.groupId}_${chatFile}`;
            }
            // 캐릭터 채팅인 경우 - 캐릭터 ID + 채팅 파일명 조합
            if (context.characterId !== undefined && context.characterId !== null) {
                // chatId 또는 현재 채팅 파일명 사용
                const chatFile = context.chatId || context.chat_metadata?.main_chat || 'default';
                return `char_${context.characterId}_${chatFile}`;
            }
        }
    } catch (e) {
        console.warn('[word-hider] Failed to get chat ID:', e);
    }
    return null;
}

/**
 * 현재 채팅방 이름 가져오기
 * @returns {string}
 */
export function getCurrentChatName() {
    try {
        const context = window.SillyTavern?.getContext?.() || window.getContext?.();
        if (context) {
            if (context.name2) {
                return context.name2;
            }
            if (context.groupId && context.groups) {
                const group = context.groups.find(g => g.id === context.groupId);
                if (group) return group.name;
            }
        }
    } catch (e) {
        console.warn('[word-hider] Failed to get chat name:', e);
    }
    return '알 수 없음';
}

/**
 * 채팅방 규칙 추가
 * @param {Object} rule - 새 규칙
 * @param {string} chatId - 채팅방 ID (없으면 현재 채팅방)
 */
export function addChatRule(rule, chatId = null) {
    const settings = getSettings();
    const targetChatId = chatId || getCurrentChatId();
    
    if (!targetChatId) {
        log('No chat ID available');
        return false;
    }
    
    if (!settings.chatRules[targetChatId]) {
        settings.chatRules[targetChatId] = [];
    }
    
    settings.chatRules[targetChatId].push(rule);
    saveSettings();
    return true;
}

/**
 * 채팅방 규칙 수정
 * @param {number} index - 규칙 인덱스
 * @param {Object} rule - 수정된 규칙
 * @param {string} chatId - 채팅방 ID (없으면 현재 채팅방)
 */
export function updateChatRule(index, rule, chatId = null) {
    const settings = getSettings();
    const targetChatId = chatId || getCurrentChatId();
    
    if (!targetChatId || !settings.chatRules[targetChatId]) {
        return false;
    }
    
    const rules = settings.chatRules[targetChatId];
    if (index >= 0 && index < rules.length) {
        rules[index] = rule;
        saveSettings();
        return true;
    }
    return false;
}

/**
 * 채팅방 규칙 삭제
 * @param {number} index - 규칙 인덱스
 * @param {string} chatId - 채팅방 ID (없으면 현재 채팅방)
 */
export function deleteChatRule(index, chatId = null) {
    const settings = getSettings();
    const targetChatId = chatId || getCurrentChatId();
    
    if (!targetChatId || !settings.chatRules[targetChatId]) {
        return false;
    }
    
    const rules = settings.chatRules[targetChatId];
    if (index >= 0 && index < rules.length) {
        rules.splice(index, 1);
        saveSettings();
        return true;
    }
    return false;
}

/**
 * 채팅방 규칙 목록 가져오기
 * @param {string} chatId - 채팅방 ID (없으면 현재 채팅방)
 * @returns {Array}
 */
export function getChatRules(chatId = null) {
    const settings = getSettings();
    const targetChatId = chatId || getCurrentChatId();
    
    if (!targetChatId) {
        return [];
    }
    
    return settings.chatRules[targetChatId] || [];
}

/**
 * 현재 채팅방에 적용할 모든 규칙 가져오기 (글로벌 + 채팅방)
 * @returns {Array}
 */
export function getAllActiveRules() {
    const globalRules = getGlobalRules();
    const chatRules = getChatRules();
    return [...globalRules, ...chatRules];
}

// ===== 기타 설정 =====

/**
 * 활성화 상태 설정
 * @param {boolean} enabled 
 */
export function setEnabled(enabled) {
    const settings = getSettings();
    settings.enabled = enabled;
    saveSettings();
}

/**
 * 테마 설정
 * @param {string} theme 
 */
export function setTheme(theme) {
    const settings = getSettings();
    settings.theme = theme;
    saveSettings();
}

/**
 * 빠른 가리기 설정 저장
 * @param {string} type 
 * @param {string} value 
 */
export function setQuickHideSettings(type, value) {
    const settings = getSettings();
    settings.quickHideType = type;
    settings.quickHideValue = value;
    saveSettings();
}

/**
 * 빠른 가리기 설정 가져오기
 * @returns {Object}
 */
export function getQuickHideSettings() {
    const settings = getSettings();
    const type = settings.quickHideType || 'color';
    
    // 타입별 기본값 설정
    let defaultValue;
    switch (type) {
        case 'color':
            defaultValue = '#000000';
            break;
        case 'custom':
            defaultValue = '';
            break;
        default:
            defaultValue = '';
    }
    
    return {
        type: type,
        value: settings.quickHideValue !== undefined ? settings.quickHideValue : defaultValue
    };
}

/**
 * 빠른 가리기 활성화 상태 설정
 * @param {boolean} enabled 
 */
export function setQuickHideEnabled(enabled) {
    const settings = getSettings();
    settings.quickHideEnabled = enabled;
    saveSettings();
}

/**
 * 빠른 가리기 활성화 상태 가져오기
 * @returns {boolean}
 */
export function isQuickHideEnabled() {
    const settings = getSettings();
    return settings.quickHideEnabled !== false; // 기본값 true
}
