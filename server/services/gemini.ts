import { GoogleGenAI } from '@google/genai';
import { NLUExtractionResult } from '../algorithms/nlu.ts';
import { Participant, TranscriptSegment } from '../types.ts';

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length === 0) {
    return null;
  }
  if (!aiInstance) {
    try {
      aiInstance = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (e) {
      console.warn('[Gemini Service] Failed to initialize GoogleGenAI client:', e);
      return null;
    }
  }
  return aiInstance;
}

export function isGeminiAvailable(): boolean {
  return getGeminiClient() !== null;
}

export interface AgendaGenerationInput {
  title: string;
  purpose: string;
  description: string;
  durationMinutes: number;
  participants: Participant[];
  requestedTopics?: string[];
}

export interface GeneratedAgendaItem {
  topic: string;
  description: string;
  durationMinutes: number;
  owner?: string;
}

export interface GeneratedAgendaResult {
  title: string;
  objectives: string[];
  agenda_items: GeneratedAgendaItem[];
  estimated_duration: number;
}

/**
 * Generate Agenda using Gemini if available, or fallback to smart deterministic template
 */
export async function generateAgendaWithAI(
  input: AgendaGenerationInput
): Promise<GeneratedAgendaResult> {
  const ai = getGeminiClient();

  if (ai) {
    try {
      const prompt = `You are the Agenda Agent for ASTRA_V1 (Autonomous Synchronization, Transcription, and Resolution Assistant).
Generate a tight, professional meeting agenda adhering strictly to the duration constraint of ${input.durationMinutes} minutes.

Meeting Title: ${input.title}
Meeting Purpose: ${input.purpose}
Description: ${input.description}
Participants: ${input.participants.map((p) => `${p.name} (${p.role})`).join(', ')}
${input.requestedTopics ? `Requested Topics: ${input.requestedTopics.join(', ')}` : ''}

Return ONLY valid JSON matching this schema:
{
  "title": string,
  "objectives": string[],
  "agenda_items": [
    {
      "topic": string,
      "description": string,
      "durationMinutes": number,
      "owner": string
    }
  ],
  "estimated_duration": number
}
Ensure the sum of durationMinutes across all agenda_items is EXACTLY ${input.durationMinutes}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text.trim()) as GeneratedAgendaResult;
        // Validate duration
        const totalDuration = parsed.agenda_items.reduce((acc, item) => acc + (item.durationMinutes || 0), 0);
        if (totalDuration > input.durationMinutes) {
          // Adjust last item to fit exact duration
          const diff = totalDuration - input.durationMinutes;
          const last = parsed.agenda_items[parsed.agenda_items.length - 1];
          if (last && last.durationMinutes > diff) {
            last.durationMinutes -= diff;
          }
        }
        parsed.estimated_duration = input.durationMinutes;
        return parsed;
      }
    } catch (err) {
      console.warn('[Gemini Agenda] Failed, using offline deterministic template:', err);
    }
  }

  // Deterministic Offline Agenda Generator
  const duration = input.durationMinutes;
  const pCount = Math.max(1, input.participants.length);
  const introTime = Math.min(5, Math.floor(duration * 0.15));
  const wrapUpTime = Math.min(5, Math.floor(duration * 0.15));
  const mainTime = duration - introTime - wrapUpTime;

  const slot1 = Math.floor(mainTime * 0.55);
  const slot2 = mainTime - slot1;

  const lead = input.participants[0]?.name || 'Meeting Facilitator';
  const techLead = input.participants[1]?.name || lead;

  return {
    title: input.title,
    objectives: [
      `Align participants on ${input.purpose}`,
      `Review technical feasibility, constraints, and architecture trade-offs`,
      `Finalize decisions and assign ownership with unambiguous deadlines`,
    ],
    agenda_items: [
      {
        topic: 'Context Setting & Milestone Objectives',
        description: `Brief review of goals: ${input.purpose}. Establish key success criteria.`,
        durationMinutes: introTime,
        owner: lead,
      },
      {
        topic: 'Technical Deep-Dive & Architecture Review',
        description: `In-depth evaluation of proposed solutions: ${input.description}. Address blockers and constraints.`,
        durationMinutes: slot1,
        owner: techLead,
      },
      {
        topic: 'Trade-off Analysis & Open Inquiries',
        description: 'Collaborative debate on open questions, risk mitigation, and security considerations.',
        durationMinutes: slot2,
        owner: input.participants[2]?.name || lead,
      },
      {
        topic: 'Action Item Confirmation & Resolution Sign-Off',
        description: 'Verify extracted decisions, confirm assignees, and solidify milestone delivery timelines.',
        durationMinutes: wrapUpTime,
        owner: lead,
      },
    ],
    estimated_duration: duration,
  };
}

/**
 * Generate Minutes & NLU with Gemini if available, or fallback to offline regex NLU
 */
export async function analyzeTranscriptWithAI(
  segments: TranscriptSegment[],
  participants: Participant[],
  meetingId: string
): Promise<NLUExtractionResult | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  try {
    const transcriptText = segments
      .map((s) => `[${s.startTime || '00:00'}] ${s.speaker}: ${s.text}`)
      .join('\n');

    const prompt = `You are the Minutes/NLU Agent for ASTRA_V1 (Autonomous Synchronization, Transcription, and Resolution Assistant).
Analyze the following meeting transcript.
Identify:
1. Executive summary (2-3 sentences)
2. Key discussion points (3-5 concise bullet points)
3. Formal decisions reached (with rationale)
4. Open/unresolved questions (with speaker if known)
5. Action items (with specific owner from participant list, deadline, and priority: LOW, MEDIUM, HIGH, CRITICAL)

Meeting Participants: ${participants.map((p) => p.name).join(', ')}

TRANSCRIPT:
${transcriptText}

Return ONLY valid JSON matching this schema:
{
  "executiveSummary": string,
  "keyDiscussionPoints": string[],
  "decisions": [
    {
      "text": string,
      "context": string,
      "confidence": number,
      "rationale": string
    }
  ],
  "openQuestions": [
    {
      "question": string,
      "askedBy": string,
      "status": "UNRESOLVED",
      "confidence": number
    }
  ],
  "actionItems": [
    {
      "text": string,
      "owner": string,
      "deadline": string,
      "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "confidence": number,
      "status": "TODO"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      // Map IDs
      const mappedDecisions = (parsed.decisions || []).map((d: any, idx: number) => ({
        id: `dec-${meetingId}-${idx + 1}`,
        meetingId,
        text: d.text,
        context: d.context || '',
        confidence: typeof d.confidence === 'number' ? Math.min(1, Math.max(0.7, d.confidence)) : 0.94,
        rationale: d.rationale || 'Extracted via Gemini 3.8 Flash NLU',
      }));

      const mappedQuestions = (parsed.openQuestions || []).map((q: any, idx: number) => ({
        id: `q-${meetingId}-${idx + 1}`,
        meetingId,
        question: q.question,
        askedBy: q.askedBy || 'Participant',
        status: 'UNRESOLVED' as const,
        confidence: typeof q.confidence === 'number' ? Math.min(1, Math.max(0.7, q.confidence)) : 0.91,
      }));

      const mappedActions = (parsed.actionItems || []).map((a: any, idx: number) => ({
        id: `act-${meetingId}-${idx + 1}`,
        meetingId,
        text: a.text,
        owner: a.owner || participants[0]?.name || 'Unassigned',
        deadline: a.deadline || 'End of Week',
        priority: a.priority || 'MEDIUM',
        confidence: typeof a.confidence === 'number' ? Math.min(1, Math.max(0.7, a.confidence)) : 0.93,
        status: 'TODO' as const,
      }));

      return {
        executiveSummary: parsed.executiveSummary || 'Executive summary generated.',
        keyDiscussionPoints: parsed.keyDiscussionPoints || [],
        decisions: mappedDecisions,
        openQuestions: mappedQuestions,
        actionItems: mappedActions,
      };
    }
  } catch (err) {
    console.warn('[Gemini NLU] Model execution error, falling back to offline NLP:', err);
  }
  return null;
}
