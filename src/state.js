/**
 * 텍스트 꾸미기 (ST-Text-Styler) - 상태 관리
 */

import { extensionName } from './constants.js';

// ===== 로깅 시스템 =====

const DEBUG = false; // 디버그 모드

/**
 * 로그 출력
 * @param {...any} args 
 */
export function log(...args) {
    if (DEBUG) {
        console.log(`[${extensionName}]`, ...args);
    }
}

// ===== 처리 상태 관리 =====

// 성능 최적화: 처리된 메시지 추적
export const processedMessages = new WeakSet();

// 디바운스 타이머
let debounceTimer = null;

/**
 * 디바운스 타이머 설정
 * @param {number} timer 
 */
export function setDebounceTimer(timer) {
    debounceTimer = timer;
}

/**
 * 디바운스 타이머 클리어
 */
export function clearDebounceTimer() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}
