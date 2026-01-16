/**
 * 텍스트 꾸미기 (ST-Text-Styler) Extension v2.1
 * SillyTavern 네이티브 확장
 * 
 * 주요 기능:
 * - 메시지에서 특정 단어/문장 가리기
 * - 글로벌 규칙 (모든 채팅방 적용)
 * - 채팅방별 규칙 (해당 채팅방에서만 적용)
 * - 색상, 이모지, 아스키아트, 직접입력으로 가리기
 * - 7가지 테마 지원
 * - 플로팅 버튼 빠른 가리기
 * - mesid 기준 메시지 복사
 * - 글꾸미기 (HTML 생성)
 */

// 모듈 import
import { extensionName } from './src/constants.js';
import { log } from './src/state.js';
import { loadSettings, getSettings } from './src/storage.js';
import { applyWordHiding, registerEventListeners, initMutationObserver } from './src/hider.js';
import { 
    loadPopupHtml, 
    initSelectOptions, 
    bindUIEvents, 
    addExtensionMenuButton,
    applyTheme,
    initContextMenu
} from './src/ui.js';

/**
 * 초기화
 */
jQuery(async () => {
    console.log(`[${extensionName}] Extension loading...`);
    
    // 팝업 HTML 로드
    const htmlLoaded = await loadPopupHtml();
    if (!htmlLoaded) {
        console.error(`[${extensionName}] Failed to initialize - popup HTML not loaded`);
        return;
    }
    
    // 셀렉트 옵션 초기화
    initSelectOptions();
    
    // 설정 로드
    await loadSettings();
    
    // UI 이벤트 바인딩
    bindUIEvents();
    
    // 초기 테마 적용
    const settings = getSettings();
    applyTheme(settings.theme || 'mono-gray');
    
    // 확장 메뉴에 버튼 추가 (딜레이 후)
    setTimeout(addExtensionMenuButton, 2000);
    
    // 이벤트 리스너 등록
    registerEventListeners();
    
    // 우클릭 컨텍스트 메뉴 초기화
    initContextMenu();
    
    // 초기 가리기 적용
    setTimeout(applyWordHiding, 1000);
    
    // MutationObserver 초기화
    setTimeout(initMutationObserver, 1500);
    
    console.log(`[${extensionName}] Extension loaded successfully!`);
});
