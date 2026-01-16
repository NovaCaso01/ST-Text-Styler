/**
 * 텍스트 꾸미기 (ST-Text-Styler) - HTML 생성기 API
 * Scenario-Summarizer의 API 연결 방식 참고
 */

import { extension_settings } from "../../../../extensions.js";
import { log } from './state.js';

// ConnectionManagerRequestService (SillyTavern 1.13.0+)
let ConnectionManagerRequestService = null;

/**
 * ConnectionManagerRequestService 로드 시도
 */
async function loadConnectionManager() {
    if (ConnectionManagerRequestService) return true;
    
    try {
        const shared = await import("../../../shared.js");
        ConnectionManagerRequestService = shared.ConnectionManagerRequestService;
        log('[htmlgen] ConnectionManagerRequestService loaded');
        return true;
    } catch (error) {
        log(`[htmlgen] ConnectionManagerRequestService not available: ${error.message}`);
        return false;
    }
}

/**
 * Connection Profile 목록 가져오기
 * @returns {Array} 프로필 목록
 */
export function getConnectionProfiles() {
    try {
        const profiles = extension_settings?.connectionManager?.profiles || [];
        return profiles.map(p => ({
            id: p.id,
            name: p.name
        }));
    } catch (e) {
        log('[htmlgen] Failed to get connection profiles:', e);
        return [];
    }
}

/**
 * HTML 생성 API 호출 (메인 진입점)
 * @param {string} systemPrompt - 시스템 프롬프트
 * @param {string} userPrompt - 유저 프롬프트 (컨셉 + 컨텐츠)
 * @param {string} profileId - Connection Profile ID
 * @returns {Promise<string>} 생성된 HTML
 */
export async function callHtmlGenAPI(systemPrompt, userPrompt, profileId) {
    if (profileId) {
        return await callConnectionManagerAPI(systemPrompt, userPrompt, profileId);
    } else {
        return await callSillyTavernAPI(systemPrompt, userPrompt);
    }
}

/**
 * Connection Manager API 호출
 */
async function callConnectionManagerAPI(systemPrompt, userPrompt, profileId) {
    const loaded = await loadConnectionManager();
    if (!loaded || !ConnectionManagerRequestService) {
        log('[htmlgen] ConnectionManager not available, falling back to default API');
        return await callSillyTavernAPI(systemPrompt, userPrompt);
    }
    
    // 프로필이 존재하는지 확인
    const profiles = extension_settings?.connectionManager?.profiles || [];
    const profile = profiles.find(p => p.id === profileId);
    
    if (!profile) {
        log(`[htmlgen] Profile ${profileId} not found, falling back to default API`);
        return await callSillyTavernAPI(systemPrompt, userPrompt);
    }
    
    try {
        log(`[htmlgen] Using ConnectionManager profile: ${profile.name}`);
        
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        
        const result = await ConnectionManagerRequestService.sendRequest(
            profileId,
            messages,
            null, // maxTokens - 프리셋 설정 사용
            {
                includePreset: true,
                includeInstruct: true,
                stream: false
            },
            {}
        );
        
        const content = result?.content || result || '';
        
        if (!content) {
            throw new Error('Empty response from ConnectionManager');
        }
        
        return content;
    } catch (error) {
        log(`[htmlgen] ConnectionManager API error: ${error.message}`);
        throw error;
    }
}

/**
 * SillyTavern 기본 API 호출 (폴백)
 */
async function callSillyTavernAPI(systemPrompt, userPrompt) {
    try {
        // generateQuietPrompt 또는 generateRaw 사용
        const { generateQuietPrompt, generateRaw } = await import("../../../../../script.js");
        
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
        
        if (typeof generateRaw === 'function') {
            const result = await generateRaw({
                prompt: fullPrompt,
                maxContext: null,
                quietToLoud: false,
                skipWIAN: true,
                skipAN: true
            });
            return result || '';
        } else if (typeof generateQuietPrompt === 'function') {
            const result = await generateQuietPrompt(fullPrompt, false, false);
            return result || '';
        } else {
            throw new Error("SillyTavern API 함수를 찾을 수 없습니다");
        }
    } catch (error) {
        log(`[htmlgen] SillyTavern API error: ${error.message}`);
        throw error;
    }
}
