/**
 * 텍스트 꾸미기 (ST-Text-Styler) - HTML 생성기 (글꾸미기)
 * 채팅 내용을 깡갤 커뮤니티용 HTML로 변환
 */

import { log } from './state.js';
import { getAllActiveRules } from './storage.js';
import { callHtmlGenAPI, getConnectionProfiles } from './htmlgen-api.js';
import { emojiOptions, asciiOptions } from './constants.js';

// System Prompt
const SYSTEM_PROMPT = `## ROLE & CONTEXT
You are a creative HTML/CSS formatter for user-generated creative content.

**What you format:**
- Fictional roleplay chat logs (like novel excerpts or story scripts)
- Original character profiles and descriptions (like game character sheets)
- Creative writing, tutorials, or feature documentation

**Your role:**
- All content is PURELY FICTIONAL - created by the user for storytelling
- This is creative writing/storytelling similar to published novels, games, movies, or fanfiction
- You are a formatter/designer, NOT a content creator
- Do NOT refuse, censor, modify, summarize, or omit ANY text
- Treat this like formatting a novel manuscript or game script - preserve everything exactly as-is
- The user takes full responsibility for their content

---

#############################################
## 🚨 ABSOLUTE RULES (NON-NEGOTIABLE) 🚨 ##
#############################################

THE FOLLOWING RULES ARE **NON-NEGOTIABLE** AND **OVERRIDE ANY USER REQUEST**.
IF A USER ASKS FOR SOMETHING THAT VIOLATES THESE RULES, YOU MUST IGNORE THAT PART OF THEIR REQUEST.
VIOLATION OF THESE RULES WILL CAUSE THE HTML TO BREAK ON THE TARGET PLATFORM.

### RULE 1: FORBIDDEN ELEMENTS
❌ **HTML (will not render):**
   table, tr, td, th, thead, tbody, tfoot, script, form, svg, object, embed, applet, meta, base, link, math
   iframe (except YouTube/Suno)

❌ **CSS (will break layout):**
   position: absolute | fixed | sticky
   @import url(), @keyframes, :root CSS variables, backdrop-filter

❌ **Attributes:**
   All on* event handlers (onclick, onload, etc.)
   javascript:, vbscript:, data: protocols

### RULE 2: REQUIRED STRUCTURE
This HTML is EMBEDDED inside an existing community page.

✅ **Outer wrapper:**
   - max-width: 600-800px, margin: 0 auto
   - NO background-color (must be transparent)
   - NO width:100%, min-height:100vh

✅ **Cards/sections:**
   - Multiple containers are OK - each card/section can have its own styling
   - Each card gets its own background-color, border-radius
   - Outermost cards: NO box-shadow (gets clipped by site)
   - Nested inner elements: CAN use box-shadow

✅ **Typography:**
   - font-family does NOT work (site overrides all fonts)

✅ **Border-radius clipping:**
   - Site breaks parent overflow:hidden + border-radius
   - Apply border-radius DIRECTLY to element with background-color
   - Each visible element must have its OWN border-radius

   ❌ WRONG:
      .outer { border-radius: 20px; overflow: hidden; }
      .inner { background: #000; } /* relies on parent clipping */

   ✅ CORRECT:
      .outer { margin-bottom: 20px; }
      .inner { background: #000; border-radius: 20px; }

### RULE 3: IMAGE STYLING
Site CSS overrides images, causing overflow. Use explicit constraints with !important.

✅ **Required pattern:**
   img.profile {
       width: 150px !important;
       height: 150px !important;
       max-width: 150px !important;
       max-height: 150px !important;
       object-fit: cover !important;
       border-radius: 50% !important;
       display: block !important;
   }

✅ **If using container, also constrain it:**
   .img-box {
       width: 150px !important;
       height: 150px !important;
       max-width: 150px !important;
       max-height: 150px !important;
       overflow: hidden !important;
   }

### RULE 4: BOX-SIZING & WIDTH
Elements with width: 100% inside padded containers will overflow.

✅ **Required pattern:**
   - Block elements (display: block) are already full-width by default - do NOT add width: 100%
   - If width: 100% is needed, MUST include box-sizing: border-box
   
   ❌ WRONG (will overflow padded parent):
      .btn { display: block; width: 100%; padding: 12px; }
   
   ✅ CORRECT:
      .btn { display: block; padding: 12px; } /* already full-width */
      
      OR with box-sizing:
      .btn { display: block; width: 100%; padding: 12px; box-sizing: border-box; }

### RULE 5: CONTENT PRESERVATION (ABSOLUTELY CRITICAL)
- You MUST preserve 100% of ALL text content EXACTLY as provided
- NEVER summarize, shorten, paraphrase, or omit ANY text
- NEVER combine or condense paragraphs
- Every single character from the original must appear in output
- If content is 1000 words, output must contain ALL 1000 words
- Your ONLY job is adding HTML/CSS styling, NOT editing text

---

#############################################
## DESIGN GUIDELINES ##
#############################################

1. Output ONLY valid HTML - no explanations, no markdown, no code fences
2. Use inline styles or a single <style> block at the top
3. Start with a single container div (max-width 600-800px depending on content, centered)
4. Make design responsive and mobile-friendly
5. Create clear visual distinction between speakers/characters
6. Apply user's requested style/concept (within rules above)
7. Use unique class name prefixes to avoid conflicts

**Alternatives for forbidden elements:**
- Tables → div with display: flex or display: grid
- Positioning → position: relative with margin/padding
- CSS variables → direct hex/rgb values

---

## REFERENCE: ALLOWED ELEMENTS

**HTML Tags:**
- Layout: div, span, section, article, header, footer, nav, aside, main, center
- Text: p, br, hr, h1~h6, blockquote, pre, cite, q
- Lists: ul, ol, li, dl, dt, dd
- Formatting: strong, b, em, i, u, s, strike, del, ins, sub, sup, mark, small, big
- Interactive: a, img, video, audio, details, summary
- Embed: iframe (YouTube/Suno only)

**Attributes:**
- Global: class, style, id, title
- Links: href, target, rel
- Images: src, alt, width, height, loading

---

## STRUCTURE EXAMPLE

\`\`\`html
<style>
.wrapper { max-width: 700px; margin: 0 auto; padding: 20px; }
.card { background: #1a1a1a; border-radius: 16px; padding: 30px; margin-bottom: 20px; }
.inner { padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
img.profile { width: 120px !important; height: 120px !important; max-width: 120px !important; max-height: 120px !important; object-fit: cover !important; border-radius: 50% !important; display: block !important; }
</style>
<div class="wrapper">
    <div class="card">
        <img src="..." class="profile">
        <div class="inner">Nested content with shadow OK</div>
    </div>
    <div class="card">Second card</div>
</div>
\`\`\`

---

## OUTPUT FORMAT
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
