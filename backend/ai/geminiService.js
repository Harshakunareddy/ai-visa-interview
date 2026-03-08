/**
 * AI Service — Dual Provider (OpenAI + Groq)
 * Provider is selected via AI_PROVIDER env var (set from /setup page).
 * Falls back automatically if the selected provider key is missing.
 *
 * Supported providers:
 *   - openai  → gpt-4o-mini  (OpenAI API)
 *   - groq    → llama-3.1-8b-instant  (Groq)
 */
'use strict';

const logger = require('../utils/logger');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

// ── Provider detection ─────────────────────────────────────────────────────────
const getProvider = () => {
    const preferred = process.env.AI_PROVIDER;     // 'openai' | 'groq'
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGroq = !!process.env.GROQ_API_KEY;

    if (preferred === 'groq' && hasGroq) return 'groq';
    if (preferred === 'openai' && hasOpenAI) return 'openai';

    // Auto-fallback if preferred key is missing
    if (hasGroq) return 'groq';
    if (hasOpenAI) return 'openai';

    return null; // neither configured
};

// ── OpenAI call ────────────────────────────────────────────────────────────────
const callOpenAI = async (messages, maxTokens = 1024) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set. Configure it in /setup → AI Provider.');

    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages,
            max_tokens: maxTokens,
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`OpenAI error ${response.status}: ${err.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
};

// ── Groq call ──────────────────────────────────────────────────────────────────
const callGroq = async (messages, maxTokens = 1024) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set. Configure it in /setup → AI Provider.');

    const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages,
            max_tokens: maxTokens,
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Groq error ${response.status}: ${err.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
};

// ── Dispatch to selected provider ──────────────────────────────────────────────
const dispatch = async (messages, maxTokens = 1024) => {
    const provider = getProvider();

    if (!provider) {
        throw new Error('No AI provider configured. Go to /setup → AI Provider and add an OpenAI or Groq key.');
    }

    if (provider === 'groq') {
        logger.info(`🤖 Using Groq (${GROQ_MODEL})`);
        return callGroq(messages, maxTokens);
    }

    logger.info(`🤖 Using OpenAI (${OPENAI_MODEL})`);
    return callOpenAI(messages, maxTokens);
};

/**
 * Generate text with retry on rate limit
 */
const generateText = async (prompt, options = {}, _attempt = 0) => {
    try {
        const messages = [{ role: 'user', content: prompt }];
        return await dispatch(messages, options.maxTokens || 1024);
    } catch (error) {
        const isRateLimit =
            error.message?.includes('429') ||
            error.message?.includes('quota') ||
            error.message?.includes('rate_limit') ||
            error.message?.includes('Rate limit');

        if (isRateLimit && _attempt < 3) {
            const delayMs = (2 ** _attempt) * 5000; // 5s → 10s → 20s
            logger.warn(`⏳ AI rate limited. Retrying in ${delayMs / 1000}s (attempt ${_attempt + 1}/3)...`);
            await new Promise(r => setTimeout(r, delayMs));
            return generateText(prompt, options, _attempt + 1);
        }

        logger.error(`AI generateText error: ${error.message}`);
        throw error;
    }
};

/**
 * Generate JSON response
 */
const generateJSON = async (prompt) => {
    try {
        const fullPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, no code blocks.`;
        const text = await generateText(fullPrompt);
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch (error) {
        logger.error(`AI generateJSON error: ${error.message}`);
        throw error;
    }
};

/**
 * Streamed generation (OpenAI SSE)
 * Groq also supports OpenAI-compatible streaming, so this works for both.
 */
const generateStream = async (prompt, onChunk) => {
    try {
        const provider = getProvider();
        if (!provider) throw new Error('No AI provider configured.');

        const url = provider === 'groq' ? GROQ_URL : OPENAI_URL;
        const model = provider === 'groq' ? GROQ_MODEL : OPENAI_MODEL;
        const apiKey = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1024,
                temperature: 0.7,
                stream: true,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Stream error ${response.status}: ${err.error?.message || 'Unknown'}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // retain incomplete line

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (trimmed.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const text = json.choices?.[0]?.delta?.content;
                        if (text) onChunk(text);
                    } catch (_) { /* skip malformed chunks */ }
                }
            }
        }
    } catch (error) {
        logger.error(`AI stream error: ${error.message}`);
        throw error;
    }
};

/**
 * Chat session — stateful multi-turn conversation
 * Works identically for both OpenAI and Groq (same API shape).
 */
const createChatSession = (history = []) => {
    const sessionHistory = history.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.content || h.parts?.[0]?.text || '',
    }));

    return {
        sendMessage: async (userMessage) => {
            sessionHistory.push({ role: 'user', content: userMessage });

            const provider = getProvider();
            if (!provider) throw new Error('No AI provider configured.');

            const url = provider === 'groq' ? GROQ_URL : OPENAI_URL;
            const model = provider === 'groq' ? GROQ_MODEL : OPENAI_MODEL;
            const apiKey = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: sessionHistory,
                    max_tokens: 512,
                    temperature: 0.6,
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(`Chat error ${response.status}: ${err.error?.message || 'Unknown'}`);
            }

            const data = await response.json();
            const assistantMsg = data.choices?.[0]?.message?.content || '';
            sessionHistory.push({ role: 'assistant', content: assistantMsg });

            return {
                response: {
                    text: () => assistantMsg,
                },
            };
        },
    };
};

module.exports = { generateText, generateJSON, generateStream, createChatSession, getProvider };
