/**
 * Interview Room JS
 * Handles speech recognition, AI questions, eye tracking (MediaPipe), and interval management
 */
'use strict';

const session = window.__session || {};
const { sessionId, targetCountry, visaType, isDemo, questionLimit } = session;

// ── DOM refs ──────────────────────────────────────────────────
const startOverlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startInterviewBtn');
const questionBox = document.getElementById('questionBox');

const questionText = document.getElementById('questionText');
const questionLoading = document.getElementById('questionLoading');
const qCounter = document.getElementById('qCounter');
const answerTextarea = document.getElementById('answerTextarea');
const submitBtn = document.getElementById('submitAnswerBtn');
const micBtn = document.getElementById('micBtn');
const micText = document.getElementById('micText');
const endBtn = document.getElementById('endInterviewBtn');

const timerDisplay = document.getElementById('timerDisplay');
const timerCircle = document.getElementById('timerCircle');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const speechStatus = document.getElementById('speechStatus');
const wordCount = document.getElementById('wordCount');
const sessionInfo = document.getElementById('sessionInfo');
const officerCountry = document.getElementById('officerCountry');
const officerSpeaking = document.getElementById('officerSpeaking');
const userVideo = document.getElementById('userVideo');
const eyeFill = document.getElementById('eyeFill');
const eyeVal = document.getElementById('eyeVal');
const nervFill = document.getElementById('nervFill');
const nervVal = document.getElementById('nervVal');
const recIndicator = document.getElementById('recIndicator');

// ── State ─────────────────────────────────────────────────────
let currentQIndex = 0;
let totalQuestions = questionLimit || 10;
let timerSeconds = 300; // 5 min
let timerInterval = null;
let isEnding = false; 
let isSubmitting = false; // Guard for double-submission

let mediaRecorder = null;
let recordedChunks = [];
let recognition = null;
let isRecognizing = false;
let stream = null;
let eyeScoreAvg = 0;
let nervScore = 100;
let blinkCount = 0;
let lastBlinkTime = 0;
let pauseCount = 0;
let speechStartTime = 0;

// Behavioral data aggregated per answer
let behavioralData = {
    eyeContact: 0, nervousness: 0, blinkRate: 0,
    pauses: 0, duration: 0,
};

// Global audio voices
let availableVoices = [];
function updateVoices() {
    availableVoices = window.speechSynthesis.getVoices();
}
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = updateVoices;
}
updateVoices();


// ── Init ──────────────────────────────────────────────────────
async function init() {
    if (sessionInfo) sessionInfo.textContent = `${targetCountry || 'Demo'} · ${visaType || 'Visa'}`;
    if (officerCountry) officerCountry.textContent = `${targetCountry || 'Demo'} Embassy`;

    // Start camera
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        userVideo.srcObject = stream;
        initMediaRecorder(stream);
        initEyeTracking();
    } catch (err) {
        showNotification('Camera not available — eye tracking disabled', 'warning');
    }

    // Start interview
    try {
        const res = await apiFetch(`/api/interview/${sessionId}/start`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            displayQuestion(data.data.question, 0);
            startTimer();
            enableControls();
        } else {
            // If already completed (e.g. on refresh), redirect to results
            if (data.message && data.message.includes('already completed')) {
                isEnding = true;
                window.location.href = isDemo ? `/demo/results/${sessionId}` : `/interview/${sessionId}/results`;
                return;
            }

            throw new Error(data.message);
        }
    } catch (err) {
        if (!err.message.includes('already completed')) {
            showNotification('Failed to start interview: ' + err.message, 'error');
        }
    }

}

// ── Timer ─────────────────────────────────────────────────────
function startTimer() {
    const circumference = 2 * Math.PI * 26; // r=26
    timerInterval = setInterval(() => {
        timerSeconds--;
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            endInterview();
            return;
        }
        const mins = Math.floor(timerSeconds / 60);
        const secs = timerSeconds % 60;
        timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        // Update ring
        const progress = timerSeconds / 300;
        const dashOffset = circumference * (1 - progress);
        timerCircle.style.strokeDasharray = `${circumference}`;
        timerCircle.style.strokeDashoffset = dashOffset;

        // Color warning
        if (timerSeconds < 60) timerCircle.style.stroke = '#ef4444';
        else if (timerSeconds < 120) timerCircle.style.stroke = '#f59e0b';
    }, 1000);
}

// ── Questions ─────────────────────────────────────────────────
function displayQuestion(text, index) {
    questionLoading.style.display = 'none';
    questionText.style.display = 'block';
    questionText.textContent = text;
    // qCounter.textContent = Math.min(index + 1, totalQuestions);
    // progressLabel.textContent = `${Math.min(index + 1, totalQuestions)} / ${totalQuestions} questions`;
    // progressBar.style.width = `${(Math.min(index + 1, totalQuestions) / totalQuestions) * 100}%`;

    // Speak question
    speakText(text);
}

function showQuestionLoading() {
    questionText.style.display = 'none';
    questionLoading.style.display = 'flex';
}

// ── Speech Synthesis ──────────────────────────────────────────
function speakText(text) {
    if (!window.speechSynthesis) return;
    
    // Voices are loaded asynchronously
    const speak = (isRetry = false) => {
        // Only cancel if already speaking to avoid unnecessary engine resets
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        
        // Wait for the cancel to settle
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0; // Reset to default for better stability
            utterance.pitch = 1.0;
            
            const voices = availableVoices.length ? availableVoices : window.speechSynthesis.getVoices();
            
            let voice;
            if (isRetry) {
                // On retry, try to find a local (offline) voice first as they are more stable
                voice = voices.find(v => v.lang.startsWith('en') && v.localService === true) || 
                        voices.find(v => v.lang.startsWith('en')) || 
                        voices[0];
            } else {
                // Standard selection: Prefer high quality but local if possible
                // Filter out "Natural" online voices if they have a history of failing in this session
                const stableVoices = voices.filter(v => !v.name.includes('Natural') || v.localService === true);
                const source = stableVoices.length ? stableVoices : voices;

                voice = source.find(v => (v.lang === 'en-IN' || v.lang === 'en-GB') && v.name.toLowerCase().includes('male')) ||
                        source.find(v => v.lang === 'en-IN') || 
                        source.find(v => v.lang.startsWith('en')) ||
                        source[0];
            }

            
            if (voice) utterance.voice = voice;

            officerSpeaking.style.display = 'flex';
            utterance.onend = () => { officerSpeaking.style.display = 'none'; };
            utterance.onerror = (e) => { 
                console.error('Speech synthesis error:', e);
                officerSpeaking.style.display = 'none';
                
                // If it failed and it's not a permission issue, try one more time with default voice
                if (e.error === 'synthesis-failed' && !isRetry) {
                    console.log('Retrying speech with fallback voice...');
                    speak(true);
                    return;
                }

                if (e.error === 'not-allowed') {
                    showNotification('Audio blocked. Click to enable.', 'info');
                    const resume = () => { speak(); window.removeEventListener('click', resume); };
                    window.addEventListener('click', resume);
                }
            };
            
            window.speechSynthesis.speak(utterance);
        }, isRetry ? 50 : 250); // Shorter wait for retry, longer for first attempt
    };


    if (window.speechSynthesis.getVoices().length === 0 && availableVoices.length === 0) {
        window.speechSynthesis.onvoiceschanged = speak;
    } else {
        speak();
    }
}



// ── Speech Recognition ─────────────────────────────────────────
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { speechStatus.textContent = 'Speech recognition not supported in this browser'; return; }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
        isRecognizing = true;
        micBtn.classList.add('recording');
        micText.textContent = 'Stop Telling';
        speechStatus.textContent = '🎙️ Listening...';
        speechStartTime = Date.now();
    };

    recognition.onend = () => {
        isRecognizing = false;
        micBtn.classList.remove('recording');
        micText.textContent = 'Start Telling';
        speechStatus.textContent = '';
        if (Date.now() - speechStartTime > 2000) behavioralData.duration = (Date.now() - speechStartTime) / 1000;
        
        // If they stopped telling, and there's content, let's auto-submit (as requested by user)
        if (answerTextarea.value.trim().length > 5) {
            submitAnswer();
        }
    };

    recognition.onresult = (e) => {
        let final = '', interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
            else interim += e.results[i][0].transcript;
        }
        if (final) {
            answerTextarea.value += final;
            updateWordCount();
        }
        window._lastInterim = interim; // Save interim to capture it if user stops/submits
        if (interim) speechStatus.textContent = '🎙️ ' + interim;
    };
    recognition.onerror = (e) => {
        isRecognizing = false;
        micBtn.classList.remove('recording');
        if (e.error !== 'no-speech') speechStatus.textContent = `Error: ${e.error}`;
    };
}

function toggleMic() {
    if (!recognition) initSpeechRecognition();
    if (!recognition) return;
    isRecognizing ? recognition.stop() : recognition.start();
}

function updateWordCount() {
    const count = answerTextarea.value.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount) wordCount.textContent = `${count} words`;
}

// ── Speech Transcript Cleaner ─────────────────────────────────
/**
 * Lightly normalizes speech-to-text output:
 * - Collapses multiple spaces
 * - Removes common filler words (um, uh, hmm, etc.)
 * - Fixes common prefix artifacts like repeated phrases
 */
function normalizeTranscript(text) {
    return text
        .replace(/\b(um+|uh+|hmm+|err+|ah+)\b/gi, '') // removed "like" and "you know" as they could be part of actual answers
        .replace(/\s{2,}/g, ' ')  
        .replace(/^[\s,]+|[\s,]+$/g, '') 
        .trim();
}

// ── Submit Answer ─────────────────────────────────────────────
async function submitAnswer() {
    if (isSubmitting) return; 

    // Capture any pending interim speech results before finishing
    if (window._lastInterim) {
        answerTextarea.value += window._lastInterim + ' ';
        window._lastInterim = '';
        updateWordCount();
    }
    
    const answer = normalizeTranscript(answerTextarea.value.trim());
    if (!answer) { 
        speechStatus.textContent = '⚠️ Please provide an answer'; 
        isSubmitting = false;
        return; 
    }

    isSubmitting = true;

    // Collect behavioral data
    behavioralData.eyeContact = eyeScoreAvg;
    behavioralData.nervousness = 100 - nervScore;
    behavioralData.blinkRate = blinkCount;
    behavioralData.pauses = pauseCount;

    // Disable controls
    disableControls();
    showQuestionLoading();
    speechStatus.textContent = '⏳ AI is evaluating your answer...';

    try {
        const res = await apiFetch(`/api/interview/${sessionId}/answer`, {
            method: 'POST',
            body: JSON.stringify({ answer, questionIndex: currentQIndex, behavioralData }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        const result = data.data;

        if (result.isComplete) {
            // Interview complete — redirect to results
            isEnding = true; // Set flag before redirect
            clearInterval(timerInterval);
            window.location.href = isDemo ? `/demo/results/${sessionId}` : `/interview/${sessionId}/results`;
        } else {


            currentQIndex = result.questionIndex; // Sync exactly with backend
            answerTextarea.value = '';
            updateWordCount();
            blinkCount = 0; pauseCount = 0;
            behavioralData = { eyeContact: 0, nervousness: 0, blinkRate: 0, pauses: 0, duration: 0 };
            displayQuestion(result.question, currentQIndex);
            enableControls();
            speechStatus.textContent = '';
        }
    } catch (err) {
        speechStatus.textContent = '⚠️ ' + err.message;
        enableControls();
        questionText.style.display = 'block';
        questionLoading.style.display = 'none';
    } finally {
        isSubmitting = false; // Always release guard
    }
}

// ── End Interview ─────────────────────────────────────────────
async function endInterview() {
    isEnding = true; // Set flag before redirect
    clearInterval(timerInterval);
    disableControls();
    showNotification('Ending interview and generating your report...', 'info');

    try {
        const res = await apiFetch(`/api/interview/${sessionId}/end`, { method: 'POST' });
        const data = await res.json();
        setTimeout(() => {
            window.location.href = isDemo ? `/demo/results/${sessionId}` : `/interview/${sessionId}/results`;
        }, 1500);
    } catch (err) {
        window.location.href = isDemo ? `/demo/results/${sessionId}` : `/interview/${sessionId}/results`;
    }
}


// ── MediaRecorder (video) ─────────────────────────────────────
function initMediaRecorder(stream) {
    try {
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.start(1000);
        recIndicator.style.display = 'flex';
    } catch (_) { }
}

// ── Eye Tracking — Canvas-based reliable fallback ─────────────
/**
 * Uses requestAnimationFrame + canvas pixel sampling to actually work.
 * MediaPipe approach was silently failing because @mediapipe/camera_utils
 * (which provides the `Camera` class) was never loaded from CDN.
 *
 * This simpler approach:
 *  - Samples the video frame every 200ms
 *  - Uses face-center brightness deviation to estimate gaze direction
 *  - Tracks frame-to-frame brightness delta as a nervousness proxy
 */
let _prevBrightness = null;
let _eyeTrackInterval = null;

function initEyeTracking() {
    if (!userVideo) return;
    
    // Check if behavioral features are enabled for this session
    if (session.behavioralFeaturesEnabled === false) {
        return;
    }


    // Wait until video is actually playing before starting

    userVideo.addEventListener('playing', startCanvasEyeTracking, { once: true });

    // Also try immediately in case it's already playing
    if (userVideo.readyState >= 3) startCanvasEyeTracking();
}

function startCanvasEyeTracking() {
    const offscreen = document.createElement('canvas');
    offscreen.width = 64;
    offscreen.height = 48;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });

    if (_eyeTrackInterval) clearInterval(_eyeTrackInterval);

    _eyeTrackInterval = setInterval(() => {
        if (!userVideo || userVideo.paused || userVideo.ended) return;
        if (userVideo.videoWidth === 0) return;

        try {
            // Draw scaled-down frame for fast pixel sampling
            ctx.drawImage(userVideo, 0, 0, 64, 48);
            const data = ctx.getImageData(0, 0, 64, 48).data;

            // Sample center 16x12 region (face/eyes area)
            let centerBrightness = 0, centerCount = 0;
            let edgeBrightness = 0, edgeCount = 0;

            for (let py = 0; py < 48; py++) {
                for (let px = 0; px < 64; px++) {
                    const i = (py * 64 + px) * 4;
                    const b = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
                    const inCenter = (px >= 20 && px <= 44 && py >= 12 && py <= 36);
                    if (inCenter) { centerBrightness += b; centerCount++; }
                    else { edgeBrightness += b; edgeCount++; }
                }
            }

            const avgCenter = centerBrightness / centerCount;
            const avgEdge = edgeBrightness / edgeCount;

            // Eye contact heuristic: face centered → center brighter than edges
            const centeredness = Math.max(0, Math.min(1, (avgCenter - avgEdge + 30) / 60));
            // Smooth the eye score (don't jump)
            eyeScoreAvg = Math.round(eyeScoreAvg * 0.7 + centeredness * 100 * 0.3);
            eyeScoreAvg = Math.max(0, Math.min(100, eyeScoreAvg));

            if (eyeFill) eyeFill.style.width = eyeScoreAvg + '%';
            if (eyeVal) eyeVal.textContent = eyeScoreAvg + '%';

            // Nervousness: frame-to-frame brightness delta (movement detection)
            const totalBrightness = (centerBrightness + edgeBrightness) / (centerCount + edgeCount);
            if (_prevBrightness !== null) {
                const delta = Math.abs(totalBrightness - _prevBrightness);
                // High delta = lots of head movement = less calm
                const calmTarget = Math.max(0, Math.min(100, 100 - delta * 4));
                nervScore = Math.round(nervScore * 0.85 + calmTarget * 0.15);
                nervScore = Math.max(0, Math.min(100, nervScore));
                if (nervFill) nervFill.style.width = nervScore + '%';
                if (nervVal) nervVal.textContent = Math.round(nervScore) + '%';
            }
            _prevBrightness = totalBrightness;

            // Simple blink proxy: sudden drop in center brightness
            if (_prevBrightness && (avgCenter < _prevBrightness * 0.85)) {
                const now = Date.now();
                if (now - lastBlinkTime > 300) { blinkCount++; lastBlinkTime = now; }
            }

        } catch (_) { /* cross-origin or frame not ready */ }
    }, 200);
}

// Clean up on page hide
document.addEventListener('visibilitychange', () => {
    if (document.hidden && _eyeTrackInterval) clearInterval(_eyeTrackInterval);
    else if (!document.hidden && userVideo?.srcObject) startCanvasEyeTracking();
});

// ── Controls helpers ──────────────────────────────────────────
function enableControls() {
    answerTextarea.disabled = false;
    submitBtn.disabled = false;
    micBtn.disabled = false;
    micText.textContent = 'Start Telling';
    answerTextarea.focus();
}

function disableControls() {
    answerTextarea.disabled = true;
    submitBtn.disabled = true;
    micBtn.disabled = true;
    if (isRecognizing) recognition?.stop();
}

function showNotification(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `alert alert-${type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success'}`;
    el.style.cssText = 'position:fixed;top:80px;right:24px;z-index:9999;max-width:360px';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

async function apiFetch(url, opts = {}) {
    return fetch(url, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        credentials: 'include',
    });
}

// ── Event Listeners ───────────────────────────────────────────
micBtn?.addEventListener('click', toggleMic);
submitBtn?.addEventListener('click', submitAnswer);
endBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to end the interview? Your progress will be saved.')) {
        endInterview();
    }
});
answerTextarea?.addEventListener('input', updateWordCount);
answerTextarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) submitAnswer();
    // Detect pauses in typing
    if (e.key === ' ') pauseCount++;
});

// ── Refresh/Exit Handling ─────────────────────────────────────
window.addEventListener('beforeunload', (e) => {
    // Only show alert if interview is in progress and NOT deliberately ending
    if (!isEnding) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to end the interview?';
        return e.returnValue;
    }
});



// Handle the actual completion if they refresh (best effort)
window.addEventListener('unload', () => {
    if (currentQIndex < totalQuestions && timerSeconds > 0) {
        // Send a beacon to end the interview on server
        navigator.sendBeacon(`/api/interview/${sessionId}/end`);
    }
});

// ── Start ─────────────────────────────────────────────────────
startBtn?.addEventListener('click', async () => {
    // Unlock audio with a silent utterance
    const unlock = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(unlock);
    
    startOverlay.classList.add('fade-out');
    setTimeout(() => startOverlay.style.display = 'none', 500);
    
    init();
});

// window.addEventListener('load', init); // Removed automatic init


