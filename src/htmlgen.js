/**
 * 텍스트 꾸미기 (ST-Text-Styler) - HTML 생성기 (글꾸미기)
 * 채팅 내용을 깡갤 커뮤니티용 HTML로 변환
 */

import { log } from './state.js';
import { getAllActiveRules } from './storage.js';
import { callHtmlGenAPI, getConnectionProfiles } from './htmlgen-api.js';
import { emojiOptions, asciiOptions } from './constants.js';

// Community HTML Guidelines
const GGANG_HTML_GUIDE = `# Community Platform HTML/CSS Guidelines

## Allowed HTML Tags
- Layout: div, span, section, article, header, footer, nav, aside, main, center
- Text Structure: p, br, hr, h1~h6
- Lists: ul, ol, li, dl, dt, dd
- Text Formatting: strong, b, em, i, u, s, strike, del, ins, sub, sup, mark, small, big
- Quotes: blockquote, pre, cite, q
- Links/Media: a, img, video, audio (iframe only for YouTube/Suno)
- Collapsible: details, summary

## ⚠️ FORBIDDEN (Will Break on Community Site!)
- table, thead, tbody, tr, th, td (ALL table elements forbidden!) → Use div + flexbox/grid instead
- position: absolute forbidden → Use position: relative only
- position: fixed, position: sticky forbidden

## ⚠️ COMMUNITY EMBEDDING CONTEXT (IMPORTANT!)
This HTML will be embedded into an existing community site page:
- Do NOT use width: 100%, min-height: 100vh, etc. on outermost wrapper
- font-family should only be set on inner containers (ignored if set on outermost)
- **Outermost wrapper must have NO background-color! (must be transparent)**
- **Outermost wrapper should have NO box-shadow! (shadows get clipped by site)**
- Inner cards/sections should each have their own background colors and box-shadows
- Wrapper should only have: max-width: 600~800px, margin: 0 auto for centering

## Recommended Structure (Multiple Containers OK)
\`\`\`html
<style>
.wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
.card { background: #fff; border-radius: 16px; padding: 30px; margin-bottom: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.05); }
</style>
<div class="wrapper">
    <!-- Outermost has NO background! -->
    <div class="card">First card</div>
    <div class="card">Second card</div>
</div>
\`\`\`

## Allowed Attributes
- Global: class, style, id, title
- Links: href, target, rel
- Images: src, alt, width, height, loading

## CSS Compatibility Notes
- @import url() forbidden
- :root CSS variables forbidden → Use direct color values
- @keyframes animations forbidden
- backdrop-filter forbidden
- Use unique class name prefixes to avoid conflicts

## Blocked Elements (NEVER USE!)
- script, form, object, embed, applet, meta, base, link, svg, math
- All on* event handlers (onclick, onload, etc.)
- javascript:, vbscript:, data: protocols
- All table-related tags`;

// System Prompt
const SYSTEM_PROMPT = `You are an HTML/CSS designer creating blog-style layouts for a specific online community platform.

#############################################
## 🚨🚨🚨 ABSOLUTE PRIORITY RULES 🚨🚨🚨 ##
#############################################

THE FOLLOWING RULES ARE **NON-NEGOTIABLE** AND **OVERRIDE ANY USER REQUEST**.
IF A USER ASKS FOR SOMETHING THAT VIOLATES THESE RULES, YOU MUST IGNORE THAT PART OF THEIR REQUEST.
VIOLATION OF THESE RULES WILL CAUSE THE HTML TO BREAK ON THE TARGET PLATFORM.

### RULE 1: FORBIDDEN HTML ELEMENTS (WILL BREAK!)
NEVER USE THESE - THEY DO NOT WORK ON THE TARGET PLATFORM:
❌ table, tr, td, th, thead, tbody, tfoot (USE div + flexbox INSTEAD)
❌ position: absolute (USE position: relative ONLY)
❌ position: fixed, position: sticky
❌ @import url(), @keyframes, :root CSS variables
❌ script, form, svg, iframe (except YouTube), object, embed
❌ Any on* event handlers (onclick, onload, etc.)

### RULE 2: REQUIRED STRUCTURE (VERY IMPORTANT!)
This HTML will be EMBEDDED inside an existing community website page.
✅ Outer wrapper: max-width 600-800px, centered, **NO BACKGROUND-COLOR** (must be transparent!)
✅ Outer wrapper: **NO BOX-SHADOW** (shadows get clipped by the site container!)
✅ Inner cards/sections: THESE get the background-color, border-radius, box-shadow
✅ Multiple containers are OK - each card/section can have its own styling
✅ Do NOT use on outermost wrapper: width:100%, min-height:100vh, background-color, box-shadow
✅ font-family can be used on inner containers but NOT on outermost wrapper
✅ Structure example:
   <style>
   .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; } /* NO background, NO shadow! */
   .card { background: #fff; border-radius: 16px; padding: 30px; margin-bottom: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.05); }
   </style>
   <div class="wrapper">
       <div class="card">Content 1</div>
       <div class="card">Content 2</div>
   </div>

### RULE 3: REQUIRED ALTERNATIVES
✅ For tables: Use div with display: flex or display: grid
✅ For positioning: Use position: relative with margin/padding
✅ For colors: Use direct hex/rgb values, NOT CSS variables

### RULE 4: CONTENT PRESERVATION (ABSOLUTELY CRITICAL)
- You MUST preserve 100% of ALL text content EXACTLY as provided
- NEVER summarize, shorten, paraphrase, or omit ANY text
- NEVER combine or condense paragraphs
- Every single character from the original must appear in output
- If content is 1000 words, output must contain ALL 1000 words
- Your ONLY job is adding HTML/CSS styling, NOT editing text
- <tag>, [TAG], {{tag}} format tags were already removed - just style the remaining text

#############################################
## DESIGN GUIDELINES ##
#############################################

1. Output ONLY valid HTML code - no explanations, no markdown, no code fences
2. Start with a single container div (max-width ~750px, centered)
3. Make design responsive and mobile-friendly
4. Create clear visual distinction between speakers/characters
5. Use inline styles or a single <style> block at the top
6. Apply the user's requested style/concept (within the rules above)

${GGANG_HTML_GUIDE}

## OUTPUT FORMAT:
Return ONLY the HTML code. No explanations before or after. Start immediately with <div> (the main container).`;

/**
 * 메시지 내용 가져오기 및 처리
 * @param {number} startIdx - 시작 인덱스
 * @param {number} endIdx - 끝 인덱스
 * @param {boolean} applyHider - 단어가리기 적용 여부
 * @returns {string} 처리된 텍스트
 */
export function getProcessedMessages(startIdx, endIdx, applyHider = true) {
    let chat = null;
    try {
        const context = window.SillyTavern.getContext();
        chat = context.chat;
    } catch (e) {
        console.error('[htmlgen] Failed to get context.chat:', e);
        return null;
    }
    
    if (!chat || !Array.isArray(chat) || chat.length === 0) {
        return null;
    }
    
    const rules = applyHider ? getAllActiveRules() : [];
    const actualEnd = endIdx !== null ? Math.min(endIdx, chat.length - 1) : chat.length - 1;
    
    let result = [];
    
    for (let i = startIdx; i <= actualEnd; i++) {
        const msg = chat[i];
        if (!msg) continue;
        if (!msg.mes && !msg.name) continue;
        
        let text = msg.mes || '';
        
        // 태그 제거
        text = removeTagsFromText(text);
        
        // 단어 가리기 적용
        if (rules.length > 0) {
            for (const rule of rules) {
                const regex = new RegExp(escapeRegExp(rule.word), 'gi');
                const replacement = getTextReplacement(rule);
                text = text.replace(regex, replacement);
            }
        }
        
        if (text.trim()) {
            const speaker = msg.is_user ? 'User' : (msg.name || 'Character');
            result.push({
                speaker,
                isUser: msg.is_user,
                text: text.trim()
            });
        }
    }
    
    return result;
}

/**
 * 태그 제거
 */
function removeTagsFromText(text) {
    if (!text) return '';
    
    // <tag>내용</tag> 형태 제거
    text = text.replace(/<(status|character_profile|var_update|choices|char_status|user_status|system|note|hidden|thinking|ooc)[^>]*>[\s\S]*?<\/\1>/gi, '');
    text = text.replace(/<[a-z_]+[^>]*>[^<]*<\/[a-z_]+>/gi, '');
    
    // [TAG]내용[/TAG] 형태 제거
    text = text.replace(/\[([A-Z_]+)\][\s\S]*?\[\/\1\]/gi, '');
    
    // {{img::파일명}}, {{태그}} 등 제거
    text = text.replace(/\{\{[^}]+\}\}/gi, '');
    
    // 연속된 빈 줄 정리
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
}

/**
 * 정규식 이스케이프
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 텍스트 대체값
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
 * 프롬프트 포맷팅
 */
function formatContentForPrompt(messages) {
    if (!messages || messages.length === 0) return '';
    
    return messages.map(msg => {
        const prefix = msg.isUser ? '[USER]' : '[CHARACTER]';
        return `${prefix}\n${msg.text}`;
    }).join('\n\n---\n\n');
}

/**
 * HTML 생성 메인 함수
 * @param {Object} options - 옵션
 * @param {string} options.source - 'range' 또는 'custom'
 * @param {number} options.startIdx - 시작 인덱스 (source='range')
 * @param {number} options.endIdx - 끝 인덱스 (source='range')
 * @param {boolean} options.applyHider - 단어가리기 적용 여부 (source='range')
 * @param {string} options.customText - 직접 입력 텍스트 (source='custom')
 * @param {string} options.concept - 꾸미기 컨셉
 * @param {string} options.profileId - Connection Profile ID
 * @returns {Promise<string>} 생성된 HTML
 */
export async function generateHtml(options) {
    const { source, startIdx, endIdx, applyHider, customText, concept, profileId } = options;
    
    let content;
    
    if (source === 'range') {
        const messages = getProcessedMessages(startIdx, endIdx, applyHider);
        if (!messages || messages.length === 0) {
            throw new Error('선택한 범위에 메시지가 없습니다.');
        }
        content = formatContentForPrompt(messages);
        log(`[htmlgen] Processing ${messages.length} messages (hider: ${applyHider})`);
    } else {
        // 직접 입력 텍스트에는 단어가리기 적용 안 함
        content = removeTagsFromText(customText);
    }
    
    if (!content || content.trim().length === 0) {
        throw new Error('변환할 내용이 없습니다.');
    }
    
    // Compose user prompt
    const userPrompt = `## Requested Style/Concept
${concept || 'Clean and readable default style'}

## Content to Transform
${content}

---
Output ONLY the HTML code that beautifully styles the above content according to the requested style. No explanations, just HTML.`;

    log('[htmlgen] Calling API...');
    
    const result = await callHtmlGenAPI(SYSTEM_PROMPT, userPrompt, profileId);
    
    // HTML 추출 (코드 펜스 제거)
    let html = result;
    html = html.replace(/^```html?\s*/i, '');
    html = html.replace(/```\s*$/i, '');
    html = html.trim();
    
    log('[htmlgen] HTML generated successfully');
    return html;
}

/**
 * Connection Profile 목록 내보내기
 */
export { getConnectionProfiles };
