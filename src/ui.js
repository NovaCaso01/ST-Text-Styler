/**
 * 텍스트 꾸미기 (ST-Text-Styler) - UI 핸들링 v2.1
 */

import { extensionFolderPath, emojiOptions, asciiOptions } from './constants.js';
import { log } from './state.js';
import { 
    saveSettings, setEnabled, setTheme, getSettings,
    addGlobalRule, updateGlobalRule, deleteGlobalRule, getGlobalRules,
    addChatRule, updateChatRule, deleteChatRule, getChatRules,
    getAllActiveRules, getCurrentChatId, getCurrentChatName,
    setQuickHideSettings, getQuickHideSettings,
    setQuickHideEnabled, isQuickHideEnabled
} from './storage.js';
import { escapeHtml, getHideDisplay, applyWordHiding, createReplacement } from './hider.js';
import { generateHtml, getConnectionProfiles } from './htmlgen.js';

// 현재 활성 탭 (글로벌/채팅방)
let currentTab = 'global';
// 현재 활성 메인 탭 (hider/htmlgen)
let currentMainTab = 'hider';
// 수정 모드 상태
let editMode = { active: false, index: -1, target: 'global' };

/**
 * 클립보드 복사 폴백 (모바일 호환)
 * @param {string} text 
 * @param {boolean} showToast - true면 토스트 표시
 * @returns {boolean} 성공 여부
 */
function fallbackCopy(text, showToast = false) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    let success = false;
    try {
        success = document.execCommand('copy');
        if (showToast) {
            if (success) {
                toastr.success("복사되었습니다!");
            } else {
                toastr.error("복사에 실패했습니다.");
            }
        }
    } catch (err) {
        if (showToast) {
            toastr.error("복사에 실패했습니다.");
        }
    }
    
    document.body.removeChild(textarea);
    return success;
}

/**
 * 팝업 HTML 로드
 */
export async function loadPopupHtml() {
    try {
        const popupHtml = await $.get(`${extensionFolderPath}/popup.html`);
        $("body").append(popupHtml);
        log('Popup HTML loaded');
        return true;
    } catch (error) {
        console.error("[word-hider] Failed to load popup.html:", error);
        return false;
    }
}

/**
 * 팝업 열기
 */
export function openPopup() {
    const settings = getSettings();
    
    // 설정값 UI에 반영
    $("#hider-enabled").prop("checked", settings.enabled);
    
    // 테마 적용
    applyTheme(settings.theme || 'mono-gray');
    
    // 빠른 가리기 설정 로드
    loadQuickHideSettings();
    
    // 글꾸미기 Connection Profile 로드
    loadHtmlGenProfiles();
    
    // 현재 채팅방 정보 표시
    updateChatInfo();
    
    // 규칙 목록 렌더링
    renderGlobalRulesList();
    renderChatRulesList();
    
    // 팝업 표시
    $("#word-hider-popup").addClass("open");
}

/**
 * 팝업 닫기
 */
export function closePopup() {
    $("#word-hider-popup").removeClass("open");
    resetEditMode();
}

/**
 * 테마 적용
 * @param {string} theme 
 */
export function applyTheme(theme) {
    const popup = document.getElementById('word-hider-popup');
    if (popup) {
        popup.setAttribute('data-theme', theme);
    }
    
    // select 값 업데이트
    $("#hider-ui-theme").val(theme);
    
    // 테마 팔레트 미리보기 업데이트
    updateThemePreview(theme);
}

/**
 * 테마 팔레트 미리보기 업데이트
 * @param {string} theme 
 */
function updateThemePreview(theme) {
    const themeColors = {
        'mono-gray': { 'bg-primary': '#ffffff', 'bg-secondary': '#f8f8f8', 'bg-tertiary': '#f0f0f0', 'border': '#e0e0e0', 'accent': '#555555', 'text-primary': '#333333' },
        'dark-mono': { 'bg-primary': '#1a1a1a', 'bg-secondary': '#242424', 'bg-tertiary': '#2d2d2d', 'border': '#3d3d3d', 'accent': '#888888', 'text-primary': '#e0e0e0' },
        'dusty-rose': { 'bg-primary': '#faf5f5', 'bg-secondary': '#f5eeee', 'bg-tertiary': '#efe6e6', 'border': '#e5d5d5', 'accent': '#c49898', 'text-primary': '#5a4545' },
        'ocean-breeze': { 'bg-primary': '#f5fafa', 'bg-secondary': '#eef5f5', 'bg-tertiary': '#e6efef', 'border': '#d5e5e5', 'accent': '#6b9a9a', 'text-primary': '#3a5555' },
        'matcha-garden': { 'bg-primary': '#f7faf5', 'bg-secondary': '#f0f5ed', 'bg-tertiary': '#e8efe4', 'border': '#d8e5d2', 'accent': '#7a9a6b', 'text-primary': '#455540' },
        'strawberry-milk': { 'bg-primary': '#fff8f8', 'bg-secondary': '#fff0f0', 'bg-tertiary': '#ffe8e8', 'border': '#ffd8d8', 'accent': '#e87a7a', 'text-primary': '#5a3a3a' },
        'butter-cream': { 'bg-primary': '#fffbf5', 'bg-secondary': '#fff5e8', 'bg-tertiary': '#ffefdb', 'border': '#ffe5c8', 'accent': '#d4a56a', 'text-primary': '#5a4830' }
    };
    
    const colors = themeColors[theme] || themeColors['mono-gray'];
    $("#hider-theme-preview .hider-theme-swatch").each(function() {
        const colorKey = $(this).data('color');
        $(this).css('background-color', colors[colorKey] || '#ccc');
    });
}

/**
 * 현재 채팅방 정보 업데이트
 */
function updateChatInfo() {
    const chatName = getCurrentChatName();
    const chatId = getCurrentChatId();
    
    $("#hider-chat-name-badge").text(chatName || '');
    
    // 채팅방이 없으면 채팅방 관련 버튼 비활성화
    if (!chatId) {
        $("#hider-add-chat-btn").prop("disabled", true).addClass("disabled");
    } else {
        $("#hider-add-chat-btn").prop("disabled", false).removeClass("disabled");
    }
}

/**
 * 글로벌 규칙 목록 렌더링
 */
export function renderGlobalRulesList() {
    const rules = getGlobalRules();
    const container = $("#hider-global-rules-list");
    container.empty();
    
    if (rules.length === 0) {
        container.append('<div class="hider-rules-empty">글로벌 규칙이 없습니다.</div>');
        return;
    }
    
    rules.forEach((rule, index) => {
        container.append(createRuleItemHtml(rule, index, 'global'));
    });
}

/**
 * 채팅방 규칙 목록 렌더링
 */
export function renderChatRulesList() {
    const rules = getChatRules();
    const container = $("#hider-chat-rules-list");
    container.empty();
    
    const chatId = getCurrentChatId();
    if (!chatId) {
        container.append('<div class="hider-rules-empty">채팅방을 선택해주세요.</div>');
        return;
    }
    
    if (rules.length === 0) {
        container.append('<div class="hider-rules-empty">이 채팅방 전용 규칙이 없습니다.</div>');
        return;
    }
    
    rules.forEach((rule, index) => {
        container.append(createRuleItemHtml(rule, index, 'chat'));
    });
}

/**
 * 규칙 아이템 HTML 생성
 */
function createRuleItemHtml(rule, index, target) {
    const hideDisplay = getHideDisplay(rule);
    return `
        <div class="hider-rule-item" data-index="${index}" data-target="${target}">
            <div class="hider-rule-info">
                <span class="hider-rule-word">"${escapeHtml(rule.word)}"</span>
                <span class="hider-rule-arrow">→</span>
                <span class="hider-rule-preview">${hideDisplay}</span>
            </div>
            <div class="hider-rule-actions">
                <button class="hider-edit-btn" data-index="${index}" data-target="${target}" title="수정">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="hider-delete-btn" data-index="${index}" data-target="${target}" title="삭제">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

/**
 * 수정 모드 초기화
 */
function resetEditMode() {
    editMode = { active: false, index: -1, target: 'global' };
    $("#hider-add-global-btn").html('<i class="fa-solid fa-globe"></i> 글로벌에 추가');
    $("#hider-add-chat-btn").html('<i class="fa-solid fa-comment"></i> 이 채팅방에 추가');
    $("#hider-word-input").val("");
    $("#hider-hide-type").val("color");
    onHideTypeChange();
}

/**
 * 셀렉트 옵션 초기화
 */
export function initSelectOptions() {
    // 이모지 옵션
    const emojiSelect = $("#hider-emoji-select, #hider-quick-emoji");
    emojiSelect.empty();
    emojiOptions.forEach((opt, index) => {
        emojiSelect.append(`<option value="${index}">${opt.value} ${opt.name}</option>`);
    });
    
    // 아스키아트 옵션
    const asciiSelect = $("#hider-ascii-select, #hider-quick-ascii");
    asciiSelect.empty();
    asciiOptions.forEach((opt, index) => {
        asciiSelect.append(`<option value="${index}">${opt.value}</option>`);
    });
}

/**
 * 가리기 방식 변경 핸들러
 */
function onHideTypeChange() {
    const type = $("#hider-hide-type").val();
    
    $("#hider-color-group, #hider-emoji-group, #hider-ascii-group, #hider-custom-group").hide();
    
    switch (type) {
        case 'color':
            $("#hider-color-group").show();
            break;
        case 'emoji':
            $("#hider-emoji-group").show();
            break;
        case 'ascii':
            $("#hider-ascii-group").show();
            break;
        case 'custom':
            $("#hider-custom-group").show();
            break;
    }
}

/**
 * 빠른 가리기 방식 변경 핸들러
 */
function onQuickHideTypeChange() {
    const type = $("#hider-quick-type").val();
    
    $("#hider-quick-color-group, #hider-quick-emoji-group, #hider-quick-ascii-group, #hider-quick-custom-group").hide();
    
    switch (type) {
        case 'color':
            $("#hider-quick-color-group").show();
            break;
        case 'emoji':
            $("#hider-quick-emoji-group").show();
            break;
        case 'ascii':
            $("#hider-quick-ascii-group").show();
            break;
        case 'custom':
            $("#hider-quick-custom-group").show();
            break;
    }
    
    saveQuickHideSettings();
}

/**
 * 빠른 가리기 설정 로드
 */
function loadQuickHideSettings() {
    const { type, value } = getQuickHideSettings();
    
    // 토글 상태 로드
    $("#hider-quick-enabled").prop("checked", isQuickHideEnabled());
    
    $("#hider-quick-type").val(type);
    onQuickHideTypeChange();
    
    switch (type) {
        case 'color':
            $("#hider-quick-color").val(value);
            break;
        case 'emoji':
            $("#hider-quick-emoji").val(value);
            break;
        case 'ascii':
            $("#hider-quick-ascii").val(value);
            break;
        case 'custom':
            $("#hider-quick-custom").val(value);
            break;
    }
}

/**
 * 빠른 가리기 설정 저장
 */
function saveQuickHideSettings() {
    const type = $("#hider-quick-type").val();
    let value;
    
    switch (type) {
        case 'color':
            value = $("#hider-quick-color").val();
            break;
        case 'emoji':
            value = $("#hider-quick-emoji").val();
            break;
        case 'ascii':
            value = $("#hider-quick-ascii").val();
            break;
        case 'custom':
            value = $("#hider-quick-custom").val();
            break;
    }
    
    setQuickHideSettings(type, value);
}

/**
 * 입력값으로 규칙 객체 생성
 */
function createRuleFromInput() {
    const word = $("#hider-word-input").val().trim();
    if (!word) {
        toastr.warning("가릴 단어를 입력해주세요.");
        return null;
    }
    
    const hideType = $("#hider-hide-type").val();
    let hideValue;
    
    switch (hideType) {
        case 'color':
            hideValue = $("#hider-color-picker").val();
            break;
        case 'emoji':
            hideValue = $("#hider-emoji-select").val();
            break;
        case 'ascii':
            hideValue = $("#hider-ascii-select").val();
            break;
        case 'custom':
            hideValue = $("#hider-custom-input").val();
            if (!hideValue) {
                toastr.warning("대체할 텍스트를 입력해주세요.");
                return null;
            }
            break;
    }
    
    return {
        id: Date.now(),
        word: word,
        hideType: hideType,
        hideValue: hideValue
    };
}

/**
 * 글로벌 규칙 추가/수정 핸들러
 */
function onAddGlobalRule() {
    const rule = createRuleFromInput();
    if (!rule) return;
    
    if (editMode.active && editMode.target === 'global') {
        updateGlobalRule(editMode.index, rule);
        toastr.success("글로벌 규칙이 수정되었습니다.");
    } else {
        addGlobalRule(rule);
        toastr.success("글로벌 규칙이 추가되었습니다.");
    }
    
    resetEditMode();
    renderGlobalRulesList();
    applyWordHiding();
}

/**
 * 채팅방 규칙 추가/수정 핸들러
 */
function onAddChatRule() {
    const chatId = getCurrentChatId();
    if (!chatId) {
        toastr.error("채팅방이 선택되지 않았습니다.");
        return;
    }
    
    const rule = createRuleFromInput();
    if (!rule) return;
    
    if (editMode.active && editMode.target === 'chat') {
        updateChatRule(editMode.index, rule);
        toastr.success("채팅방 규칙이 수정되었습니다.");
    } else {
        addChatRule(rule);
        toastr.success("채팅방 규칙이 추가되었습니다.");
    }
    
    resetEditMode();
    renderChatRulesList();
    applyWordHiding();
}

/**
 * 규칙 수정 시작
 */
function onEditRule(index, target) {
    const rules = target === 'global' ? getGlobalRules() : getChatRules();
    const rule = rules[index];
    
    if (!rule) return;
    
    editMode = { active: true, index, target };
    
    // 입력 필드에 값 채우기
    $("#hider-word-input").val(rule.word);
    $("#hider-hide-type").val(rule.hideType);
    onHideTypeChange();
    
    switch (rule.hideType) {
        case 'color':
            $("#hider-color-picker").val(rule.hideValue);
            break;
        case 'emoji':
            $("#hider-emoji-select").val(rule.hideValue);
            break;
        case 'ascii':
            $("#hider-ascii-select").val(rule.hideValue);
            break;
        case 'custom':
            $("#hider-custom-input").val(rule.hideValue);
            break;
    }
    
    // 버튼 텍스트 변경
    if (target === 'global') {
        $("#hider-add-global-btn").html('<i class="fa-solid fa-check"></i> 글로벌 규칙 수정');
    } else {
        $("#hider-add-chat-btn").html('<i class="fa-solid fa-check"></i> 채팅방 규칙 수정');
    }
    
    // 해당 탭으로 전환
    switchTab(target);
}

/**
 * 규칙 삭제
 */
function onDeleteRule(index, target) {
    if (target === 'global') {
        deleteGlobalRule(index);
        renderGlobalRulesList();
    } else {
        deleteChatRule(index);
        renderChatRulesList();
    }
    
    applyWordHiding();
    toastr.info("규칙이 삭제되었습니다.");
}

/**
 * 탭 전환 (글로벌/채팅방)
 */
function switchTab(tab) {
    currentTab = tab;
    
    $(".hider-tab-btn").removeClass("active");
    $(`.hider-tab-btn[data-tab="${tab}"]`).addClass("active");
    
    $(".hider-tab-content").hide();
    $(`.hider-tab-content[data-tab="${tab}"]`).show();
}

/**
 * 메인 탭 전환 (단어가리기/글꾸미기)
 */
function switchMainTab(maintab) {
    currentMainTab = maintab;
    
    $(".hider-main-tab").removeClass("active");
    $(`.hider-main-tab[data-maintab="${maintab}"]`).addClass("active");
    
    $(".hider-main-tab-content").removeClass("active");
    $(`#maintab-${maintab}`).addClass("active");
}

/**
 * 활성화 토글 핸들러
 */
function onEnabledChange() {
    const enabled = $("#hider-enabled").prop("checked");
    setEnabled(enabled);
    applyWordHiding();
}

/**
 * 테마 변경 핸들러
 */
function onThemeChange(theme) {
    setTheme(theme);
    applyTheme(theme);
}

// ===== 메시지 복사 기능 =====

/**
 * 가린 채로 메시지 복사 (getContext().chat 배열 기반 - 로딩 여부 무관)
 * @param {boolean} removeTags - true면 태그 제거, false면 그대로
 */
export function copyMessagesWithHiding(removeTags = false) {
    const settings = getSettings();
    const startInput = $("#hider-copy-start").val()?.trim();
    const endInput = $("#hider-copy-end").val()?.trim();
    
    // SillyTavern context에서 전체 채팅 기록 가져오기
    let chat = null;
    try {
        const context = window.SillyTavern.getContext();
        chat = context.chat;
    } catch (e) {
        console.error('[word-hider] Failed to get context.chat:', e);
        toastr.error("SillyTavern 채팅 데이터에 접근할 수 없습니다.");
        return;
    }
    
    if (!chat || !Array.isArray(chat) || chat.length === 0) {
        toastr.warning("복사할 메시지가 없습니다.");
        return;
    }
    
    console.log('[word-hider] Total chat messages:', chat.length, 'removeTags:', removeTags);
    
    // 시작/끝 인덱스 파싱 (비어있으면 전체)
    let startIdx = 0;
    let endIdx = chat.length - 1;
    
    if (startInput && !isNaN(parseInt(startInput))) {
        startIdx = parseInt(startInput);
    }
    if (endInput && !isNaN(parseInt(endInput))) {
        endIdx = Math.min(parseInt(endInput), chat.length - 1);
    }
    
    console.log(`[word-hider] Copy range: ${startIdx} ~ ${endIdx} (total: ${chat.length})`);
    
    const rules = getAllActiveRules();
    let result = [];
    let skippedSystem = 0;
    let skippedEmpty = 0;
    
    for (let i = startIdx; i <= endIdx; i++) {
        const msg = chat[i];
        if (!msg) continue;
        
        // 진짜 시스템 메시지만 스킵 (빈 메시지이거나 특수 타입)
        // is_system은 숨겨진 메시지에도 붙을 수 있으므로 무시
        if (!msg.mes && !msg.name) {
            skippedSystem++;
            continue;
        }
        
        // 메시지 텍스트만 (이름 없이)
        let text = msg.mes || '';
        
        // 태그 제거 옵션이 켜져있으면 태그 정리
        if (removeTags) {
            text = removeTagsFromText(text);
        }
        
        // 규칙 적용하여 가리기
        if (settings.enabled && rules.length > 0) {
            for (const rule of rules) {
                const regex = new RegExp(escapeRegExpForCopy(rule.word), 'gi');
                const replacement = getTextReplacement(rule);
                text = text.replace(regex, replacement);
            }
        }
        
        if (text.trim()) {
            result.push({ index: i, text });
        } else {
            skippedEmpty++;
        }
    }
    
    console.log(`[word-hider] Copied: ${result.length}, Skipped system: ${skippedSystem}, Skipped empty: ${skippedEmpty}`);
    
    if (result.length === 0) {
        toastr.warning("지정한 범위에 메시지가 없습니다.");
        return;
    }
    
    // 텍스트만 연결 (이름 없이)
    const finalText = result.map(r => r.text).join('\n\n');
    
    // 클립보드에 복사 (폴백 포함)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(finalText).then(() => {
            const modeText = removeTags ? '(태그 제외)' : '(원본)';
            toastr.success(`${result.length}개 메시지 복사 완료 ${modeText}`);
        }).catch(() => {
            // 폴백
            if (fallbackCopy(finalText)) {
                const modeText = removeTags ? '(태그 제외)' : '(원본)';
                toastr.success(`${result.length}개 메시지 복사 완료 ${modeText}`);
            }
        });
    } else {
        // 폴백
        if (fallbackCopy(finalText)) {
            const modeText = removeTags ? '(태그 제외)' : '(원본)';
            toastr.success(`${result.length}개 메시지 복사 완료 ${modeText}`);
        }
    }
}

/**
 * 정규식 이스케이프 (복사용)
 */
function escapeRegExpForCopy(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 텍스트 대체값 가져오기 (HTML 없이)
 */
function getTextReplacement(rule) {
    switch (rule.hideType) {
        case 'color':
            return '●';
        case 'emoji':
            return emojiOptions[rule.hideValue]?.value || "❤️";
        case 'ascii':
            return asciiOptions[rule.hideValue]?.value || "⋆°•☁︎⋆";
        case 'custom':
            return rule.hideValue || "[???]";
        default:
            return "***";
    }
}

/**
 * 복사 시 태그 제거
 * - <tag>...</tag> 형태
 * - [TAG]...[/TAG] 형태  
 * - {{tag::...}} 또는 {{tag}} 형태
 * - 빈 줄 정리
 */
function removeTagsFromText(text) {
    if (!text) return '';
    
    // <tag>내용</tag> 형태 제거 (status, character_profile, var_update, choices 등)
    text = text.replace(/<(status|character_profile|var_update|choices|char_status|user_status|system|note|hidden|thinking|ooc)[^>]*>[\s\S]*?<\/\1>/gi, '');
    
    // <tag>내용</tag> - 일반적인 XML 스타일 태그 (한 줄짜리)
    text = text.replace(/<[a-z_]+[^>]*>[^<]*<\/[a-z_]+>/gi, '');
    
    // [TAG]내용[/TAG] 형태 제거
    text = text.replace(/\[([A-Z_]+)\][\s\S]*?\[\/\1\]/gi, '');
    
    // {{img::파일명}} 형태 제거
    text = text.replace(/\{\{img::[^}]+\}\}/gi, '');
    
    // {{태그}} 또는 {{태그::값}} 형태 제거 (일반)
    text = text.replace(/\{\{[^}]+\}\}/gi, '');
    
    // 연속된 빈 줄을 하나로 정리
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // 앞뒤 공백 정리
    text = text.trim();
    
    return text;
}

// ===== 글꾸미기 (HTML Generator) =====

/**
 * Connection Profile 목록 로드
 */
function loadHtmlGenProfiles() {
    const profiles = getConnectionProfiles();
    const $select = $("#htmlgen-profile");
    const settings = getSettings();
    
    // 기존 옵션 제거 (첫 번째 옵션 제외)
    $select.find("option:not(:first)").remove();
    
    // 프로필 추가
    profiles.forEach(profile => {
        $select.append(`<option value="${profile.id}">${profile.name}</option>`);
    });
    
    // 마지막 선택한 프로필 복원
    if (settings.lastProfileId) {
        $select.val(settings.lastProfileId);
    }
}

/**
 * HTML 생성 버튼 클릭 핸들러
 */
async function onHtmlGenerate() {
    const source = $(".hider-source-tab.active").data('source') || 'range';
    const concept = $("#htmlgen-concept").val().trim();
    const profileId = $("#htmlgen-profile").val();
    
    // 선택한 프로필 저장
    const settings = getSettings();
    settings.lastProfileId = profileId;
    saveSettings();
    
    // 입력 검증
    let options = {
        source,
        concept,
        profileId
    };
    
    if (source === 'range') {
        const startInput = $("#htmlgen-start").val().trim();
        const endInput = $("#htmlgen-end").val().trim();
        const applyHider = $("#htmlgen-apply-hider").prop("checked");
        
        options.startIdx = startInput ? parseInt(startInput) : 0;
        options.endIdx = endInput ? parseInt(endInput) : null;
        options.applyHider = applyHider;
    } else {
        options.customText = $("#htmlgen-custom-text").val().trim();
        options.applyHider = false; // 직접 입력 시에는 단어가리기 적용 불가
        
        if (!options.customText) {
            toastr.warning("변환할 내용을 입력해주세요.");
            return;
        }
    }
    
    // UI 상태 변경
    $("#htmlgen-generate-btn").prop("disabled", true);
    $("#htmlgen-loading").show();
    $("#htmlgen-result").hide();
    $("#htmlgen-preview").hide();
    
    try {
        const html = await generateHtml(options);
        
        // 결과 표시
        $("#htmlgen-code").text(html);
        $("#htmlgen-result").show();
        
        toastr.success("HTML이 생성되었습니다!");
    } catch (error) {
        console.error('[htmlgen] Error:', error);
        toastr.error(`생성 실패: ${error.message}`);
    } finally {
        $("#htmlgen-generate-btn").prop("disabled", false);
        $("#htmlgen-loading").hide();
    }
}

// ===== 빠른 가리기 (플로팅 버튼) =====

/**
 * 플로팅 버튼 초기화 (텍스트 선택 시 나타남)
 */
export function initContextMenu() {
    // 기존 메뉴 제거
    $("#word-hider-floating-btn").remove();
    
    // 플로팅 버튼 HTML 추가
    const floatingHtml = `
        <div id="word-hider-floating-btn" class="word-hider-floating" style="display: none;">
            <button class="word-hider-float-item" id="hider-float-global" title="글로벌 규칙에 추가">
                <i class="fa-solid fa-globe"></i>
            </button>
            <button class="word-hider-float-item" id="hider-float-chat" title="이 채팅방 규칙에 추가">
                <i class="fa-solid fa-comment"></i>
            </button>
        </div>
    `;
    $("body").append(floatingHtml);
    
    let hideTimeout = null;
    
    // 텍스트 선택 감지 (mouseup 이벤트)
    $(document).on("mouseup", "#chat .mes_text", function(e) {
        // 빠른 가리기가 비활성화되어 있으면 무시
        if (!isQuickHideEnabled()) {
            return;
        }
        
        // 약간의 딜레이로 선택 완료 대기
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            if (selectedText && selectedText.length > 0 && selectedText.length < 100) {
                // 선택된 텍스트 저장
                $("#word-hider-floating-btn").data("selected-text", selectedText);
                
                // 선택 영역의 위치 계산
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                // 플로팅 버튼 위치 설정 (선택 영역 위쪽, 더 위로)
                const floatBtn = $("#word-hider-floating-btn");
                const btnWidth = 70; // 버튼 예상 너비
                
                let left = rect.left + (rect.width / 2) - (btnWidth / 2) + window.scrollX;
                let top = rect.top - 50 + window.scrollY;  // 40 -> 50으로 더 위로
                
                // 화면 밖으로 나가지 않도록 조정
                if (left < 10) left = 10;
                if (top < 10) top = rect.bottom + 10 + window.scrollY;  // 아래쪽으로 갈 때도 더 여유
                
                floatBtn.css({
                    top: top + "px",
                    left: left + "px",
                    display: "flex"
                });
                
                // 이전 타이머 취소
                if (hideTimeout) clearTimeout(hideTimeout);
            }
        }, 10);
    });
    
    // 글로벌에 빠른 추가
    $(document).on("click", "#hider-float-global", function(e) {
        e.stopPropagation();
        const text = $("#word-hider-floating-btn").data("selected-text");
        if (text) {
            quickAddRule(text, 'global');
        }
        hideFloatingBtn();
    });
    
    // 채팅방에 빠른 추가
    $(document).on("click", "#hider-float-chat", function(e) {
        e.stopPropagation();
        const text = $("#word-hider-floating-btn").data("selected-text");
        if (text) {
            quickAddRule(text, 'chat');
        }
        hideFloatingBtn();
    });
    
    // 다른 곳 클릭 시 버튼 숨김
    $(document).on("mousedown", function(e) {
        const $btn = $("#word-hider-floating-btn");
        if ($btn.is(":visible") && !$(e.target).closest("#word-hider-floating-btn").length) {
            hideFloatingBtn();
        }
    });
    
    // ESC 키로 버튼 숨김
    $(document).on("keydown", function(e) {
        if (e.key === "Escape" && $("#word-hider-floating-btn").is(":visible")) {
            hideFloatingBtn();
        }
    });
    
    // 스크롤 시 버튼 숨김
    $(document).on("scroll", function() {
        if ($("#word-hider-floating-btn").is(":visible")) {
            hideFloatingBtn();
        }
    });
    
    log("플로팅 버튼 초기화 완료");
}

/**
 * 플로팅 버튼 숨기기
 */
function hideFloatingBtn() {
    $("#word-hider-floating-btn").hide();
    // 선택 해제
    window.getSelection()?.removeAllRanges();
}

/**
 * 빠른 규칙 추가
 * @param {string} word 
 * @param {string} target - 'global' 또는 'chat'
 */
function quickAddRule(word, target) {
    const { type, value } = getQuickHideSettings();
    
    const newRule = {
        id: Date.now(),
        word: word,
        hideType: type,
        hideValue: value
    };
    
    if (target === 'global') {
        addGlobalRule(newRule);
        toastr.success(`"${word}"이(가) 글로벌 규칙에 추가되었습니다.`);
    } else {
        const chatId = getCurrentChatId();
        if (!chatId) {
            toastr.error("채팅방이 선택되지 않았습니다.");
            return;
        }
        addChatRule(newRule);
        toastr.success(`"${word}"이(가) 채팅방 규칙에 추가되었습니다.`);
    }
    
    applyWordHiding();
}

/**
 * 확장 메뉴에 버튼 추가
 * @param {number} retryCount 
 */
export function addExtensionMenuButton(retryCount = 0) {
    const MAX_RETRIES = 10;
    
    // 이미 추가된 경우 스킵
    if ($("#word-hider-menu-item").length > 0) {
        return;
    }
    
    const extensionsMenu = document.getElementById("extensionsMenu");
    if (!extensionsMenu) {
        if (retryCount < MAX_RETRIES) {
            log(`extensionsMenu not found, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
            setTimeout(() => addExtensionMenuButton(retryCount + 1), 1000);
        } else {
            console.error("[word-hider] extensionsMenu not found after max retries");
        }
        return;
    }
    
    const menuItem = document.createElement("div");
    menuItem.id = "word-hider-menu-item";
    menuItem.className = "list-group-item flex-container flexGap5 interactable";
    menuItem.tabIndex = 0;
    menuItem.innerHTML = `
        <div class="fa-solid fa-wand-magic-sparkles extensionsMenuExtensionButton"></div>
        텍스트 꾸미기
    `;
    
    menuItem.addEventListener("click", function() {
        openPopup();
        $("#extensionsMenu").hide();
    });
    
    extensionsMenu.appendChild(menuItem);
    log("Menu button added successfully!");
}

/**
 * UI 이벤트 바인딩
 */
export function bindUIEvents() {
    // 닫기 버튼
    $(document).on("click", "#hider-close-btn, #word-hider-popup-overlay", closePopup);
    
    // 활성화 토글
    $(document).on("change", "#hider-enabled", onEnabledChange);
    
    // 메인 탭 버튼 (단어가리기/글꾸미기)
    $(document).on("click", ".hider-main-tab", function() {
        switchMainTab($(this).data("maintab"));
    });
    
    // 서브 탭 버튼 (글로벌/채팅방)
    $(document).on("click", ".hider-tab-btn", function() {
        switchTab($(this).data("tab"));
    });
    
    // 가리기 방식 변경
    $(document).on("change", "#hider-hide-type", onHideTypeChange);
    
    // 글로벌 규칙 추가
    $(document).on("click", "#hider-add-global-btn", onAddGlobalRule);
    
    // 채팅방 규칙 추가
    $(document).on("click", "#hider-add-chat-btn", onAddChatRule);
    
    // 엔터키로 추가
    $(document).on("keypress", "#hider-word-input", function(e) {
        if (e.key === "Enter") {
            // 현재 탭에 따라 추가
            if (currentTab === 'chat') {
                onAddChatRule();
            } else {
                onAddGlobalRule();
            }
        }
    });
    
    // 규칙 수정 버튼
    $(document).on("click", ".hider-edit-btn", function() {
        const index = parseInt($(this).data("index"));
        const target = $(this).data("target");
        onEditRule(index, target);
    });
    
    // 규칙 삭제 버튼
    $(document).on("click", ".hider-delete-btn", function() {
        const index = parseInt($(this).data("index"));
        const target = $(this).data("target");
        onDeleteRule(index, target);
    });
    
    // 테마 선택 (select)
    $(document).on("change", "#hider-ui-theme", function() {
        const theme = $(this).val();
        onThemeChange(theme);
    });
    
    // 복사 버튼 (그대로 복사)
    $(document).on("click", "#hider-copy-btn", () => copyMessagesWithHiding(false));
    
    // 복사 버튼 (태그 제외 복사)
    $(document).on("click", "#hider-copy-clean-btn", () => copyMessagesWithHiding(true));
    
    // 빠른 가리기 토글
    $(document).on("change", "#hider-quick-enabled", function() {
        setQuickHideEnabled($(this).is(":checked"));
    });
    
    // 빠른 가리기 방식 변경
    $(document).on("change", "#hider-quick-type", onQuickHideTypeChange);
    
    // 빠른 가리기 값 변경
    $(document).on("change", "#hider-quick-color, #hider-quick-emoji, #hider-quick-ascii, #hider-quick-custom", saveQuickHideSettings);
    
    // ===== 글꾸미기 (HTML Generator) 이벤트 =====
    
    // 소스 선택 탭 클릭
    $(document).on("click", ".hider-source-tab", function() {
        const source = $(this).data('source');
        $(".hider-source-tab").removeClass('active');
        $(this).addClass('active');
        
        if (source === 'range') {
            $("#htmlgen-range-group").show();
            $("#htmlgen-hider-toggle-group").show();
            $("#htmlgen-custom-group").hide();
        } else {
            $("#htmlgen-range-group").hide();
            $("#htmlgen-hider-toggle-group").hide();
            $("#htmlgen-custom-group").show();
        }
    });
    
    // HTML 생성 버튼
    $(document).on("click", "#htmlgen-generate-btn", onHtmlGenerate);
    
    // 코드 복사
    $(document).on("click", "#htmlgen-copy-btn", function(e) {
        const code = $("#htmlgen-code").text();
        
        // Clipboard API 시도
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
                toastr.success("HTML 코드가 복사되었습니다!");
            }).catch(() => {
                // 폴백: execCommand 사용
                if (fallbackCopy(code)) {
                    toastr.success("HTML 코드가 복사되었습니다!");
                } else {
                    toastr.error("복사에 실패했습니다.");
                }
            });
        } else {
            // 폴백: execCommand 사용
            if (fallbackCopy(code)) {
                toastr.success("HTML 코드가 복사되었습니다!");
            } else {
                toastr.error("복사에 실패했습니다.");
            }
        }
    });
    
    // 미리보기 열기
    $(document).on("click", "#htmlgen-preview-btn", function() {
        const code = $("#htmlgen-code").text();
        const frame = document.getElementById("htmlgen-preview-frame");
        frame.srcdoc = code;
        $("#htmlgen-preview").show();
    });
    
    // 미리보기 닫기
    $(document).on("click", "#htmlgen-close-preview", function() {
        $("#htmlgen-preview").hide();
    });
    
    // 초기 타입 표시
    onHideTypeChange();
    
    log('UI 이벤트 바인딩 완료');
}
