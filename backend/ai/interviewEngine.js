/**
 * Interview Engine — AI Visa Officer
 * Handles question generation, follow-up logic, and final evaluation
 */
'use strict';

const { generateJSON, generateText } = require('./geminiService');
const logger = require('../utils/logger');

// ─── Country-specific question banks (seed questions) ─────────────────────────
const QUESTION_BANKS = {
    USA: {
        Student: [
            'Which university have you been accepted to in the United States?',
            'What program will you be studying, and what is the duration?',
            'Who is funding your education in the US?',
            'What are your plans after completing your studies?',
            'Do you have any relatives currently living in the United States?',
            'Have you ever been denied a US visa before?',
            'What is your current CGPA or academic standing?',
        ],
        Tourist: [
            'What is the purpose of your visit to the United States?',
            'How long do you plan to stay?',
            'Who will be funding your trip?',
            'Do you have any family members in the US?',
            'What ties do you have to your home country?',
            'Where will you be staying in the US?',
            'Have you travelled internationally before?',
        ],
        Work: [
            'What company is sponsoring your work visa?',
            'What will be your role and responsibilities?',
            'What is your current employment history?',
            'What salary have you been offered?',
            'Will your family be accompanying you?',
        ],
    },
    Canada: {
        Student: [
            'Which Canadian institution have you been admitted to?',
            'How will you fund your studies and living expenses?',
            'What is your plan after graduation — return home or apply for PR?',
            'Have you studied abroad before?',
            'What ties bind you to your home country?',
        ],
        Tourist: [
            'What brings you to Canada?',
            'How long do you plan to stay?',
            'Who is paying for your trip?',
            'Do you have any relatives in Canada?',
            'What property or business do you own back home?',
        ],
    },
    UK: {
        Student: [
            'Which UK university have you received an offer from?',
            'What is your CAS number?',
            'How are you financing your studies?',
            'What are your career goals after your UK degree?',
            'Have you studied in another country before?',
        ],
        Tourist: [
            'What is the main purpose of your visit to the UK?',
            'Where will you be staying?',
            'Who is sponsoring your visit?',
            'What is your immigration history?',
        ],
    },
    Australia: {
        Student: [
            'Which Australian institution accepted you?',
            'What IELTS or English test score did you achieve?',
            'How are you funding your tuition and living?',
            'Do you have genuine temporary entrant intentions?',
            'What career do you plan after graduation?',
        ],
    },
    Germany: {
        Student: [
            'Which German university or institution admitted you?',
            'Do you speak German, and at what level?',
            'How will you support yourself financially in Germany?',
            'Have you been blocked by any Studienkolleg requirements?',
            'What is your plan after completing your German education?',
        ],
        Work: [
            'Which German company has offered you employment?',
            'What is your qualification recognized as in Germany?',
            'Do you have a work permit or Blue Card approval?',
        ],
    },
};

/**
 * Build officer system prompt
 */
const buildOfficerSystemPrompt = (country, visaType, profile, resumeText) => {
    const profileContext = profile ? `
Applicant Profile:
- Name: ${profile.firstName || 'Unknown'} ${profile.lastName || ''}
- Nationality: ${profile.nationality || 'Unknown'}
- Passport Expiry: ${profile.passportExpiry ? new Date(profile.passportExpiry).toLocaleDateString() : 'Unknown'}
- Target Visa: ${visaType} visa for ${country}
${resumeText ? `\nApplicant Resume Summary:\n${resumeText.substring(0, 800)}` : ''}
` : '';

    return `You are a STRICT ${country} embassy visa officer conducting an official visa interview for a ${visaType} visa.

${profileContext}

Your behavior rules:
1. Be professional, authoritative, and skeptical — you are trained to detect fraud and inconsistencies.
2. Ask ONE question at a time. Keep questions concise and direct.
3. If an answer is vague or suspicious, ask a sharp follow-up immediately.
4. Note inconsistencies in the applicant's answers for your final report.
5. Do NOT be friendly or reassuring — maintain embassy professionalism.
6. After 8-12 questions, conclude the interview.
7. Cover these areas: purpose of visit, finances, ties to home country, travel history, education/employment.
8. If the applicant gives contradictory answers, call them out professionally.
9. Never reveal your internal evaluation during the interview.
10. Format: Respond with ONLY the question or statement — no introductions, no commentary.
11. NO REPETITION: Do not ask the same question twice, even if the applicant didn't answer it. If they are silent, MOVE TO A NEW TOPIC (e.g., from finances to family, or employment to travel).
12. IMPORTANT — Speech-to-text tolerance: The applicant's answers are captured via voice recognition and may contain transcription errors. Always infer meaning.`;
};

/**
 * Generate opening question
 */
const generateOpeningQuestion = async (country, visaType) => {
    const questions = {
        USA: 'Good morning. What is the purpose of your visit to the United States?',
        Canada: 'Good morning. Please state your reason for applying for a Canadian visa.',
        UK: 'Good morning. What is the purpose of your intended travel to the United Kingdom?',
        Australia: 'Good morning. Can you explain why you wish to travel to Australia?',
        Germany: 'Good morning. What is the reason for your visa application to Germany?',
    };
    return questions[country] || 'Good morning. What is the purpose of your visit?';
};

/**
 * Generate next question based on conversation context
 */
const generateNextQuestion = async (country, visaType, conversationHistory, profile, resumeText) => {
    try {
        const systemPrompt = buildOfficerSystemPrompt(country, visaType, profile, resumeText);

        const historyText = conversationHistory
            .slice(-30) // last 30 exchanges (enough for a full 15-question interview)

            .map(h => `${h.role === 'model' ? 'Officer' : 'Applicant'}: ${h.content}`)
            .join('\n');

        const prompt = `${systemPrompt}
        
INTERVIEW HISTORY:
${historyText}

CRITICAL INSTRUCTION: Review the INTERVIEW HISTORY carefully. 
- DO NOT repeat any questions already asked.
- If the applicant was silent or provided no information for the last question, DO NOT ask it again. Move to a completely different subject.
- Cover all topics: purpose, finances, home ties, travel history. 
- You have a maximum of ${parseInt(process.env.INTERVIEW_QUESTION_LIMIT) || 10} questions.
- If the interview has been going for a long time without meaningful answers, conclude it professionally.

As the visa officer, what is your next question? Respond with ONLY the question text.`;


        const response = await generateText(prompt);
        return response.trim().replace(/^(Officer:|Question:)\s*/i, '');
    } catch (error) {
        logger.error(`generateNextQuestion error: ${error.message}`);
        // Fallback to question bank
        const bank = QUESTION_BANKS[country]?.[visaType] || QUESTION_BANKS[country]?.Tourist || [];
        const usedQuestions = conversationHistory.filter(h => h.role === 'model').map(h => h.content);
        const remaining = bank.filter(q => !usedQuestions.some(u => u.includes(q.substring(0, 20))));
        return remaining[0] || 'Is there anything else you would like to add to support your application?';
    }
};

/**
 * Evaluate a single answer
 */
const evaluateAnswer = async (question, answer, country, visaType, conversationHistory) => {
    try {
        const historyText = conversationHistory
            .slice(-6)
            .map(h => `${h.role === 'model' ? 'Officer' : 'Applicant'}: ${h.content}`)
            .join('\n');

        const prompt = `You are an expert ${country} visa officer evaluating answers.

Context:
Country: ${country}
Visa Type: ${visaType}
Interview History: ${historyText}

Current Question: ${question}
Applicant's Answer: ${answer}

NOTE: The applicant's answer was captured via voice/speech recognition, so it may contain minor transcription errors (e.g. mishearing "sanctioned" as "shanks and", "sponsor" as "spawner"). Evaluate based on the INTENDED meaning — do not penalise for phonetic transcription artifacts.

Evaluate this answer and return JSON with:
{
  "relevance": <0-10 score>,
  "credibility": <0-10 score>,
  "clarity": <0-10 score>,
  "consistency": <0-10, check against previous answers>,
  "flags": [<list of suspicious patterns or red flags, empty array if none>],
  "aiComment": "<brief officer-style evaluation note>"
}`;

        return await generateJSON(prompt);
    } catch (error) {
        logger.error(`evaluateAnswer error: ${error.message}`);
        return {
            relevance: 5, credibility: 5, clarity: 5, consistency: 5,
            flags: [], aiComment: 'Evaluation unavailable.',
        };
    }
};

/**
 * Generate comprehensive final evaluation
 */
const generateFinalEvaluation = async (session, answers, profile) => {
    try {
        const answersText = answers.map((a, i) =>
            `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer || '[No answer provided]'}`
        ).join('\n\n');

        const avgEval = answers.reduce((acc, a) => {
            acc.relevance += (a.evaluation?.relevance || 5);
            acc.credibility += (a.evaluation?.credibility || 5);
            acc.clarity += (a.evaluation?.clarity || 5);
            acc.consistency += (a.evaluation?.consistency || 5);
            return acc;
        }, { relevance: 0, credibility: 0, clarity: 0, consistency: 0 });

        const n = Math.max(answers.length, 1);
        Object.keys(avgEval).forEach(k => avgEval[k] = Math.round(avgEval[k] / n));

        const prompt = `You are a highly experienced ${session.targetCountry} embassy senior visa officer making a final determination.

Visa Application: ${session.visaType} visa to ${session.targetCountry}
${profile ? `Applicant: ${profile.firstName || ''} ${profile.lastName || ''}, ${profile.nationality || 'Unknown nationality'}` : ''}
Interview Duration: ${Math.round((session.duration || 300) / 60)} minutes
Questions Asked: ${session.questionCount}

Full Interview Transcript:
${answersText}

Preliminary evaluation scores: ${JSON.stringify(avgEval)}

Based on ALL answers, provide your final embassy determination as JSON:
{
  "approvalProbability": <0-100, realistic embassy probability>,
  "verdict": "<one of: Strong Approval, Likely Approved, Borderline, Likely Rejected, Strong Rejection>",
  "overallScore": <0-100>,
  "confidenceScore": <0-100, how confident the applicant appeared>,
  "communicationScore": <0-100, clarity and articulation>,
  "consistencyScore": <0-100, lack of contradictions>,
  "riskFlags": [<list of specific red flags observed>],
  "suspicionIndicators": [<behavioral or answer-based suspicion points>],
  "strengths": [<3-5 positive points from the interview>],
  "improvements": [<3-5 specific areas to improve>],
  "officerNotes": "<2-3 sentence official-style summary note as the visa officer>"
}`;

        return await generateJSON(prompt);
    } catch (error) {
        logger.error(`generateFinalEvaluation error: ${error.message}`);
        return {
            approvalProbability: 50,
            verdict: 'Borderline',
            overallScore: 50,
            confidenceScore: 50,
            communicationScore: 50,
            consistencyScore: 50,
            riskFlags: [],
            suspicionIndicators: [],
            strengths: ['Completed the interview'],
            improvements: ['Provide more detailed answers'],
            officerNotes: 'Evaluation could not be fully completed.',
        };
    }
};

module.exports = {
    generateOpeningQuestion,
    generateNextQuestion,
    evaluateAnswer,
    generateFinalEvaluation,
    QUESTION_BANKS,
};
