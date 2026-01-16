/**
 * 텍스트 꾸미기 (ST-Text-Styler) - 상수 및 기본 설정
 */

// 확장 기본 정보
export const extensionName = "ST-Text-Styler";

// 확장 폴더 경로 - 동적으로 감지
// SillyTavern은 third-party 또는 data/user/extensions 경로를 사용할 수 있음
function detectExtensionPath() {
    // 현재 스크립트의 경로에서 추출 시도
    try {
        const scripts = document.querySelectorAll('script[src*="text-styler"], script[src*="Text-Styler"], script[src*="ST-Text-Styler"]');
        for (const script of scripts) {
            const src = script.src;
            const match = src.match(/(.+?(?:st-text-styler|ST-Text-Styler|text-styler|Text-Styler))/i);
            if (match) {
                // URL에서 상대 경로 추출
                const url = new URL(match[1]);
                return url.pathname.replace(/^\//, '');
            }
        }
    } catch (e) {
        console.warn('[ST-Text-Styler] Script path detection failed:', e);
    }
    
    // import.meta.url 사용 시도 (ES modules)
    try {
        if (typeof import.meta !== 'undefined' && import.meta.url) {
            const url = new URL(import.meta.url);
            const pathParts = url.pathname.split('/');
            // constants.js는 src/ 폴더 안에 있으므로 상위 폴더 경로 추출
            const extIndex = pathParts.findIndex(p => 
                p.toLowerCase() === 'st-text-styler' || 
                p.toLowerCase() === 'text-styler'
            );
            if (extIndex !== -1) {
                return pathParts.slice(1, extIndex + 1).join('/');
            }
        }
    } catch (e) {
        console.warn('[ST-Text-Styler] import.meta.url detection failed:', e);
    }
    
    // 폴백: 여러 가능한 경로 시도
    return `scripts/extensions/third-party/${extensionName}`;
}

export const extensionFolderPath = detectExtensionPath();

// 기본 설정값
export const defaultSettings = {
    enabled: true,
    globalRules: [],       // 글로벌 규칙 (모든 채팅방에 적용)
    chatRules: {},         // 채팅방별 규칙 { chatId: rules[] }
    theme: 'mono-gray',
    quickHideEnabled: true,    // 빠른 가리기 활성화 여부
    quickHideType: 'color',    // 빠른 가리기 기본 방식
    quickHideValue: '#000000'  // 빠른 가리기 기본 값
};

// 이모지 옵션
export const emojiOptions = [
    { name: "빨간 하트", value: "❤️" },
    { name: "주황 하트", value: "🧡" },
    { name: "노란 하트", value: "💛" },
    { name: "초록 하트", value: "💚" },
    { name: "파란 하트", value: "💙" },
    { name: "보라 하트", value: "💜" },
    { name: "검정 하트", value: "🖤" },
    { name: "흰 하트", value: "🤍" },
    { name: "펭귄", value: "🐧" },
    { name: "로봇", value: "🤖" },
    { name: "눈송이", value: "❄️" },
    { name: "별", value: "⭐" },
    { name: "달", value: "🌙" },
    { name: "토성", value: "🪐" },
    { name: "해바라기", value: "🌻" },
    { name: "벚꽃", value: "🌸" },
    { name: "네잎클로버", value: "🍀" },
    { name: "곰", value: "🐻" },
    { name: "판다", value: "🐼" },
    { name: "발자국", value: "🐾" },
    { name: "병아리", value: "🐤" },
    { name: "토끼", value: "🐰" },
    { name: "햄스터", value: "🐹" },
    { name: "강아지", value: "🐶" },
    { name: "늑대", value: "🐺" },
    { name: "여우", value: "🦊" },
    { name: "라쿤", value: "🦝" },
    { name: "고양이", value: "🐱" },
    { name: "사자", value: "🦁" },
    { name: "호랑이", value: "🐯" }
];

// 아스키아트 옵션
export const asciiOptions = [
    { name: "하트", value: "꒰১♥໒꒱" },
    { name: "구름", value: "⋆°•☁︎⋆" },
    { name: "꽃", value: "°•. ✿ .•°" },
    { name: "달", value: "∘*┈🌙┈*∘" },
    { name: "나비", value: "˚∘⊹🦋⊹∘˚" },
    { name: "리본", value: "⊹˟༝🎀˖˟⊹" },
    { name: "토끼", value: "₍ᐢ..ᐢ₎" },
    { name: "곰", value: "ʕ•ᴥ•ʔ" },
    { name: "무지개", value: "⁺˚⋆🌈⋆˚⁺" },
    { name: "물방울", value: "｡ﾟ･💧･ﾟ｡" }
];

// 테마 옵션
export const themeOptions = [
    { id: 'mono-gray', name: 'Mono Gray' },
    { id: 'dusty-rose', name: 'Dusty Rose' },
    { id: 'ocean-breeze', name: 'Ocean Breeze' },
    { id: 'matcha-garden', name: 'Matcha Garden' },
    { id: 'dark-mono', name: 'Dark Mono' },
    { id: 'strawberry-milk', name: 'Strawberry Milk' },
    { id: 'butter-cream', name: 'Butter Cream' }
];
