/**
 * 텍스트 꾸미기 (ST-Text-Styler) - 핵심 가리기 로직
 */

import { emojiOptions, asciiOptions } from './constants.js';
import { log, processedMessages } from './state.js';
import { getAllActiveRules, getGlobalRules, getSettings } from './storage.js';

/**
 * HTML 이스케이프
 * @param {string} text 
 * @returns {string}
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 정규식 특수문자 이스케이프
 * @param {string} string 
 * @returns {string}
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 가리기 미리보기 생성
 * @param {Object} rule 
 * @returns {string}
 */
export function getHideDisplay(rule) {
    switch (rule.hideType) {
        case 'color':
            return `<span class="hider-color-preview" style="background-color: ${rule.hideValue};">&nbsp;&nbsp;&nbsp;</span>`;
        case 'emoji':
            return emojiOptions[rule.hideValue]?.value || "❤️";
        case 'ascii':
            return asciiOptions[rule.hideValue]?.value || "⋆°•☁︎⋆";
        case 'custom':
            return escapeHtml(rule.hideValue) || "[???]";
        default:
            return "???";
    }
}

/**
 * 대체 텍스트 생성
 * @param {Object} rule 
 * @returns {string}
 */
export function createReplacement(rule) {
    let content;
    let style = "";
    
    switch (rule.hideType) {
        case 'color':
            // 작고 둥근 원형 마스킹
            content = "";
            style = `background-color: ${rule.hideValue}; width: 1em; height: 1em; border-radius: 50%; display: inline-block; vertical-align: middle;`;
            break;
        case 'emoji':
            content = emojiOptions[rule.hideValue]?.value || "❤️";
            break;
        case 'ascii':
            content = asciiOptions[rule.hideValue]?.value || "⋆°•☁︎⋆";
            break;
        case 'custom':
            content = escapeHtml(rule.hideValue) || "[???]";
            break;
        default:
            content = "***";
    }
    
    return `<span class="word-hider-hidden" data-word="${escapeHtml(rule.word)}" style="${style}" title="가려진 단어">${content}</span>`;
}

/**
 * 요소에 가리기 적용
 * @param {jQuery} $element 
 * @param {Array} rules 
 */
export function applyHidingToElement($element, rules) {
    const el = $element[0];
    if (!el) return;
    
    let html = el.innerHTML;
    if (!html) return;
    
    // 이미 처리된 요소는 스킵 (성능 최적화)
    if (processedMessages.has(el) && html.includes('word-hider-hidden')) {
        return;
    }
    
    // 이미 가려진 상태면 원본으로 저장하지 않음
    const storedOriginal = $element.data("original-html");
    if (!storedOriginal && !html.includes('word-hider-hidden')) {
        $element.data("original-html", html);
    }
    
    // 이미 가려진 상태에서 다시 적용하면 원본 HTML 사용
    if (storedOriginal) {
        html = storedOriginal;
    }
    
    // 빠른 체크: 가릴 단어가 있는지 먼저 확인 (없으면 스킵)
    const hasMatch = rules.some(rule => html.toLowerCase().includes(rule.word.toLowerCase()));
    if (!hasMatch) {
        processedMessages.add(el);
        return;
    }
    
    // 보호할 패턴들을 한 번에 처리 (정규식 결합)
    const protectedPatterns = [];
    let protectedIndex = 0;
    
    // 통합 정규식으로 한 번에 처리 (성능 개선)
    const protectRegex = /\{\{[^}]+\}\}|<[^>]+>|(?:\.{0,2}\/)?(?:[\w\-\.]+\/)+[\w\-\.]+\.\w+|[\w\-]+\.(?:png|jpg|jpeg|gif|webp|svg|mp3|mp4|wav|ogg|js|css|html|json|txt|md)/gi;
    
    html = html.replace(protectRegex, (match) => {
        const placeholder = `\x00${protectedIndex}\x00`;
        protectedPatterns.push(match);
        protectedIndex++;
        return placeholder;
    });
    
    // 규칙을 단어 길이순으로 내림차순 정렬 (긴 단어 먼저 처리하여 중첩 문제 방지)
    const sortedRules = [...rules].sort((a, b) => b.word.length - a.word.length);
    
    // 모든 단어를 하나의 정규식으로 합쳐서 한 번에 처리 (중첩 문제 완전 해결)
    const ruleMap = new Map();
    sortedRules.forEach(rule => {
        ruleMap.set(rule.word.toLowerCase(), rule);
    });
    
    // 긴 단어 우선으로 정렬된 패턴들을 OR로 연결
    const combinedPattern = sortedRules
        .map(rule => escapeRegExp(rule.word))
        .join('|');
    
    if (combinedPattern) {
        const combinedRegex = new RegExp(combinedPattern, 'gi');
        html = html.replace(combinedRegex, (match) => {
            const rule = ruleMap.get(match.toLowerCase());
            if (rule) {
                if (!rule._cachedReplacement) {
                    rule._cachedReplacement = createReplacement(rule);
                }
                return rule._cachedReplacement;
            }
            return match;
        });
    }
    
    // 보호된 패턴들 복원
    html = html.replace(/\x00(\d+)\x00/g, (_, idx) => protectedPatterns[parseInt(idx)]);
    
    el.innerHTML = html;
    processedMessages.add(el);
}

/**
 * 전체 메시지에 가리기 적용
 */
export function applyWordHiding() {
    const settings = getSettings();
    const rules = getAllActiveRules(); // 글로벌 + 현재 채팅방 규칙
    
    removeWordHiding();
    
    if (!settings.enabled || rules.length === 0) {
        return;
    }
    
    // 성능 최적화: 화면에 보이는 메시지만 우선 처리
    const chatContainer = document.getElementById('chat');
    if (!chatContainer) return;
    
    const messages = chatContainer.querySelectorAll('.mes .mes_text');
    const visibleMessages = [];
    const hiddenMessages = [];
    
    // 화면에 보이는 메시지와 안 보이는 메시지 분리
    messages.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            visibleMessages.push(el);
        } else {
            hiddenMessages.push(el);
        }
    });
    
    // 화면에 보이는 메시지 즉시 처리
    visibleMessages.forEach(el => {
        applyHidingToElement($(el), rules);
    });
    
    // 안 보이는 메시지는 idle 콜백으로 처리 (모바일 성능 개선)
    if (hiddenMessages.length > 0 && 'requestIdleCallback' in window) {
        requestIdleCallback(() => {
            hiddenMessages.forEach(el => {
                applyHidingToElement($(el), rules);
            });
        }, { timeout: 2000 });
    } else if (hiddenMessages.length > 0) {
        // requestIdleCallback 미지원 시 setTimeout으로 대체
        setTimeout(() => {
            hiddenMessages.forEach(el => {
                applyHidingToElement($(el), rules);
            });
        }, 100);
    }
}

/**
 * 가리기 제거
 */
export function removeWordHiding() {
    const messages = document.querySelectorAll("#chat .mes .mes_text");
    
    messages.forEach(el => {
        const $mesText = $(el);
        const original = $mesText.data("original-html");
        
        if (original) {
            el.innerHTML = original;
            $mesText.removeData("original-html");
        } else {
            // original-html이 없는 경우, word-hider-hidden 스팬을 원래 단어로 복원
            let html = el.innerHTML;
            if (html && html.includes('word-hider-hidden')) {
                html = html.replace(/<span class="word-hider-hidden"[^>]*data-word="([^"]*)"[^>]*>[^<]*<\/span>/gi, (match, word) => {
                    const textarea = document.createElement('textarea');
                    textarea.innerHTML = word;
                    return textarea.value;
                });
                el.innerHTML = html;
            }
        }
    });
    
    // 규칙 캐시 클리어
    const allRules = getAllActiveRules();
    allRules.forEach(rule => {
        delete rule._cachedReplacement;
        delete rule._cachedRegex;
    });
}

// ===== 이벤트 리스너 =====

import { eventSource, event_types } from "../../../../../script.js";
import { clearDebounceTimer, setDebounceTimer } from './state.js';

/**
 * 메시지 렌더링 이벤트 핸들러
 * @param {number} messageId 
 */
function onMessageRendered(messageId) {
    const settings = getSettings();
    const rules = getAllActiveRules();
    
    if (!settings.enabled || rules.length === 0) {
        return;
    }
    
    requestAnimationFrame(() => {
        const message = document.querySelector(`#chat .mes[mesid="${messageId}"] .mes_text`);
        if (message) {
            applyHidingToElement($(message), rules);
        }
    });
}

/**
 * 메시지 업데이트 이벤트 핸들러
 * @param {number} messageId 
 */
function onMessageUpdated(messageId) {
    const settings = getSettings();
    const rules = getAllActiveRules();
    
    if (!settings.enabled || rules.length === 0) {
        return;
    }
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            if (typeof messageId === 'number' || !isNaN(messageId)) {
                const message = document.querySelector(`#chat .mes[mesid="${messageId}"] .mes_text`);
                if (message) {
                    const $message = $(message);
                    if (!message.querySelector('textarea')) {
                        $message.removeData("original-html");
                        applyHidingToElement($message, rules);
                    }
                }
            } else {
                applyWordHiding();
            }
        }, 150);
    });
}

/**
 * 채팅 변경 이벤트 핸들러
 */
function onChatChanged() {
    log('채팅 변경됨');
    setTimeout(applyWordHiding, 500);
}

/**
 * 이벤트 리스너 등록
 */
export function registerEventListeners() {
    if (!eventSource) {
        console.warn('[word-hider] eventSource not available');
        return;
    }
    
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, onMessageRendered);
    eventSource.on(event_types.MESSAGE_UPDATED, onMessageUpdated);
    eventSource.on(event_types.MESSAGE_EDITED, onMessageUpdated);
    eventSource.on(event_types.MESSAGE_SWIPED, onMessageUpdated);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    
    log('이벤트 리스너 등록 완료');
}

/**
 * MutationObserver 초기화
 */
export function initMutationObserver() {
    const chatContainer = document.getElementById('chat');
    if (!chatContainer) {
        log('Chat container not found, retrying...');
        setTimeout(initMutationObserver, 1000);
        return;
    }
    
    const observer = new MutationObserver((mutations) => {
        const settings = getSettings();
        if (!settings.enabled) return;
        
        const rules = getAllActiveRules();
        if (rules.length === 0) return;
        
        let hasEdit = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'TEXTAREA' || node.querySelector?.('textarea')) {
                            hasEdit = true;
                        }
                    }
                });
            }
        }
        
        if (hasEdit) {
            clearDebounceTimer();
            setDebounceTimer(setTimeout(() => {
                applyWordHiding();
            }, 300));
        }
    });
    
    observer.observe(chatContainer, {
        childList: true,
        subtree: true,
        characterData: false
    });
    
    log('MutationObserver 초기화 완료');
}
