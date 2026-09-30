import { ActionItem, Decision, OpenQuestion, Participant, TaskPriority, TranscriptSegment } from '../types.ts';

export interface NLUExtractionResult {
  decisions: Decision[];
  openQuestions: OpenQuestion[];
  actionItems: ActionItem[];
  executiveSummary: string;
  keyDiscussionPoints: string[];
}

// Regex patterns for decision extraction
const DECISION_PATTERNS = [
  /(?:we|team|everyone)\s+(?:decided|agreed|concluded|resolved)\s+(?:to|that)?\s+([^.]+)/i,
  /(?:it\s+was\s+(?:agreed|decided|finalized)\s+(?:that|to))\s+([^.]+)/i,
  /(?:the\s+final\s+decision\s+is\s+to|our\s+decision\s+is)\s+([^.]+)/i,
  /(?:let's\s+proceed\s+with|we\s+will\s+adopt|moving\s+forward\s+with)\s+([^.]+)/i,
  /(?:consensus\s+reached\s+on)\s+([^.]+)/i,
];

// Regex patterns for action item extraction
const ACTION_PATTERNS = [
  /([A-Z][a-z]+)\s+(?:will|shall|needs\s+to|is\s+going\s+to|must|should|is\s+responsible\s+for|to)\s+(?:take\s+over|implement|create|build|review|prepare|finish|complete|write|deploy|investigate|schedule|verify|test)\s+([^.]+)/i,
  /(?:action\s+item:?|ai:?)\s*(?:assign(?:ed)?\s+to\s+)?([A-Z][a-z]+)?\s*[:\-]?\s*([^.]+)/i,
  /(?:please|can\s+you)\s+([A-Z][a-z]+)?\s*(?:ensure|handle|complete|submit|look\s+into)\s+([^.]+)/i,
  /([A-Z][a-z]+)\s+owns\s+(?:the\s+)?([^.]+)/i,
];

// Regex patterns for deadline detection
const DEADLINE_PATTERNS = [
  /(?:by|before|due|deadline)\s+((?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|end\s+of\s+day|eod|end\s+of\s+week|eow|sprint\s+end|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+|\d{4}-\d{2}-\d{2}))/i,
  /(?:within\s+)(\d+\s+(?:days|hours|weeks))/i,
  /(?:by\s+the\s+end\s+of\s+)(?:the\s+)?(day|week|month|sprint)/i,
];

// Regex patterns for questions
const QUESTION_PATTERNS = [
  /(?:^|\.\s+)(what|how|why|when|who|where|can\s+we|should\s+we|could\s+we|is\s+it\s+possible|do\s+we\s+need|are\s+we)\s+([^?]+\?)/i,
  /(?:unresolved\s+question:?|open\s+question:?|question:?)\s*([^.]+)/i,
  /(?:we\s+need\s+to\s+clarify|still\s+unclear\s+whether|remains\s+to\s+be\s+decided)\s+([^.]+)/i,
];

/**
 * Match a raw owner string to the closest meeting participant.
 * If cannot be confidently determined, return "Unassigned" (DO NOT randomly assign).
 */
export function resolveOwner(rawOwner: string | undefined, participants: Participant[], defaultSpeaker: string): string {
  if (!rawOwner || rawOwner.trim().length === 0) {
    // Check if the speaker themselves is in participants
    const speakerMatch = participants.find(
      (p) => p.name.toLowerCase().includes(defaultSpeaker.toLowerCase()) || defaultSpeaker.toLowerCase().includes(p.name.toLowerCase())
    );
    return speakerMatch ? speakerMatch.name : 'Unassigned';
  }

  const cleaned = rawOwner.trim().toLowerCase();

  const matched = participants.find((p) => {
    const pFirst = p.name.split(' ')[0].toLowerCase();
    const pFull = p.name.toLowerCase();
    return pFull === cleaned || pFirst === cleaned || pFull.includes(cleaned) || cleaned.includes(pFirst);
  });

  if (matched) return matched.name;
  return 'Unassigned';
}

/**
 * Extract deadline string from a sentence.
 * If unclear, return "Not specified" (DO NOT invent dates).
 */
export function extractDeadline(sentence: string): string {
  for (const pattern of DEADLINE_PATTERNS) {
    const match = sentence.match(pattern);
    if (match && match[1]) {
      const val = match[1].trim();
      return val.charAt(0).toUpperCase() + val.slice(1);
    }
  }
  return 'Not specified';
}

export function inferPriority(text: string): TaskPriority {
  const lower = text.toLowerCase();
  if (lower.includes('urgent') || lower.includes('critical') || lower.includes('blocker') || lower.includes('immediately')) {
    return 'CRITICAL';
  }
  if (lower.includes('high priority') || lower.includes('asap') || lower.includes('important') || lower.includes('blocking')) {
    return 'HIGH';
  }
  if (lower.includes('low priority') || lower.includes('nice to have') || lower.includes('later')) {
    return 'LOW';
  }
  return 'MEDIUM';
}

/**
 * Deterministic Rule-Based NLU Processor with Source Evidence Citing
 */
export function extractMinutesOffline(
  segments: TranscriptSegment[],
  participants: Participant[],
  meetingId: string
): NLUExtractionResult {
  const decisions: Decision[] = [];
  const openQuestions: OpenQuestion[] = [];
  const actionItems: ActionItem[] = [];
  const discussionPoints: string[] = [];

  let decCount = 0;
  let qCount = 0;
  let actCount = 0;

  for (const segment of segments) {
    const text = segment.text.trim();
    const speaker = segment.speaker;
    const time = segment.startTime || '00:00';

    const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (sentence.length < 8) continue;

      // 1. Decisions
      for (const pattern of DECISION_PATTERNS) {
        const match = sentence.match(pattern);
        if (match) {
          decCount++;
          const decisionText = (match[1] || match[0]).trim();
          decisions.push({
            id: `dec-${meetingId}-${decCount}`,
            meetingId,
            text: decisionText.charAt(0).toUpperCase() + decisionText.slice(1),
            context: `Stated by ${speaker}: "${sentence}"`,
            confidence: 0.92,
            rationale: 'Extracted via consensus pattern and modal resolution statement.',
            sourceTimestamp: time,
            sourceExcerpt: `${speaker}: ${sentence}`,
          });
          break;
        }
      }

      // 2. Open Questions
      if (sentence.endsWith('?') || /unresolved|unclear|open question/i.test(sentence)) {
        for (const pattern of QUESTION_PATTERNS) {
          const match = sentence.match(pattern);
          if (match || sentence.endsWith('?')) {
            qCount++;
            const questionText = match ? (match[2] ? `${match[1]} ${match[2]}` : match[1] || sentence) : sentence;
            openQuestions.push({
              id: `q-${meetingId}-${qCount}`,
              meetingId,
              question: questionText.trim(),
              askedBy: speaker,
              status: 'UNRESOLVED',
              confidence: 0.88,
              sourceTimestamp: time,
              sourceExcerpt: `${speaker}: ${sentence}`,
            });
            break;
          }
        }
      }

      // 3. Action Items
      let matchedAction = false;
      for (const pattern of ACTION_PATTERNS) {
        const match = sentence.match(pattern);
        if (match) {
          actCount++;
          matchedAction = true;
          const rawAssignee = match[1];
          const taskDescription = match[2] || match[0];
          const owner = resolveOwner(rawAssignee, participants, speaker);
          const deadline = extractDeadline(sentence);
          const priority = inferPriority(sentence);

          actionItems.push({
            id: `act-${meetingId}-${actCount}`,
            meetingId,
            text: taskDescription.trim().charAt(0).toUpperCase() + taskDescription.trim().slice(1),
            owner,
            deadline,
            priority,
            confidence: 0.89,
            status: 'TODO',
            sourceTimestamp: time,
            sourceExcerpt: `${speaker}: ${sentence}`,
          });
          break;
        }
      }

      // 4. Discussion points
      if (!matchedAction && sentence.length > 30 && !sentence.endsWith('?')) {
        if (/architecture|security|database|frontend|performance|integration|deadline|release|review|evaluation|scheduler/i.test(sentence)) {
          discussionPoints.push(`${speaker}: ${sentence}`);
        }
      }
    }
  }

  const uniqueDecisions = decisions.filter((d, i, arr) => arr.findIndex((x) => x.text.toLowerCase() === d.text.toLowerCase()) === i);
  const uniqueQuestions = openQuestions.filter((q, i, arr) => arr.findIndex((x) => x.question.toLowerCase() === q.question.toLowerCase()) === i);
  const uniqueActions = actionItems.filter((a, i, arr) => arr.findIndex((x) => x.text.toLowerCase() === a.text.toLowerCase()) === i);

  const executiveSummary =
    `The meeting brought together ${participants.length} participants to coordinate objectives and technical architecture. ` +
    `Key discussions focused on system reliability, task ownership, and delivery milestones. ` +
    `The team reached ${uniqueDecisions.length} decision(s), identified ${uniqueQuestions.length} open question(s), and created ${uniqueActions.length} action item(s).`;

  return {
    decisions: uniqueDecisions,
    openQuestions: uniqueQuestions,
    actionItems: uniqueActions,
    executiveSummary,
    keyDiscussionPoints: discussionPoints.slice(0, 6),
  };
}
