import { FollowUpRecommendation, Meeting, RecurringIssue } from '../types.ts';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const total = tokens.length || 1;
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  for (const [key, count] of tf.entries()) {
    tf.set(key, count / total);
  }
  return tf;
}

export function computeIDF(documents: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const N = documents.length || 1;
  const docOccurrences = new Map<string, number>();

  for (const docTokens of documents) {
    const uniqueTokens = new Set(docTokens);
    for (const token of uniqueTokens) {
      docOccurrences.set(token, (docOccurrences.get(token) || 0) + 1);
    }
  }

  for (const [token, count] of docOccurrences.entries()) {
    // Standard smoothed IDF: log(1 + (N / count))
    idf.set(token, Math.log(1 + N / count));
  }

  return idf;
}

export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of vecA.entries()) {
    normA += valA * valA;
    const valB = vecB.get(term) || 0;
    dotProduct += valA * valB;
  }

  for (const [, valB] of vecB.entries()) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RetrievedMeetingMatch {
  meeting: Meeting;
  similarityScore: number;
  matchedKeywords: string[];
}

/**
 * Perform TF-IDF Cosine Retrieval over historical meetings
 */
export function searchHistoricalMeetings(
  query: string,
  historicalMeetings: Meeting[],
  threshold = 0.15
): RetrievedMeetingMatch[] {
  if (historicalMeetings.length === 0) return [];

  const queryTokens = tokenize(query);
  const docTokensList = historicalMeetings.map((m) => {
    const fullText = `${m.title} ${m.purpose} ${m.description} ${m.executiveSummary || ''} ${m.decisions.map((d) => d.text).join(' ')} ${m.openQuestions.map((q) => q.question).join(' ')}`;
    return tokenize(fullText);
  });

  const allDocs = [...docTokensList, queryTokens];
  const idf = computeIDF(allDocs);

  // Compute query TF-IDF vector
  const queryTF = computeTF(queryTokens);
  const queryVec = new Map<string, number>();
  for (const [term, tfVal] of queryTF.entries()) {
    queryVec.set(term, tfVal * (idf.get(term) || 1));
  }

  const results: RetrievedMeetingMatch[] = [];

  for (let i = 0; i < historicalMeetings.length; i++) {
    const docTF = computeTF(docTokensList[i]);
    const docVec = new Map<string, number>();
    for (const [term, tfVal] of docTF.entries()) {
      docVec.set(term, tfVal * (idf.get(term) || 1));
    }

    const sim = cosineSimilarity(queryVec, docVec);
    if (sim >= threshold) {
      // Find top shared matched keywords
      const matched = queryTokens.filter((t) => docTF.has(t)).slice(0, 5);
      results.push({
        meeting: historicalMeetings[i],
        similarityScore: Math.round(sim * 100) / 100,
        matchedKeywords: matched,
      });
    }
  }

  return results.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Detect recurring unresolved issues across multiple meetings
 */
export function detectRecurringIssues(allMeetings: Meeting[]): RecurringIssue[] {
  // Pre-seed known technical recurring clusters and search for textual occurrences
  const knownClusters = [
    {
      topic: 'OAuth Token Revocation & Cloud Calendar Sync Race Conditions',
      keywords: ['oauth', 'token', 'calendar', 'sync', 'revocation', 'expiry', 'race'],
      description: 'Persistent synchronization errors during calendar token refresh and cross-timezone sync.',
      suggestedAction: 'Architect dedicated idempotent background token renewal with Redis/lease locking.',
    },
    {
      topic: 'Database Connection Pool Exhaustion under Concurrent Agent Runs',
      keywords: ['database', 'pool', 'connection', 'timeout', 'concurrency', 'latency', 'exhaustion'],
      description: 'SQLAlchemy / connection pool timeouts when all 6 agents execute parallel background analytics.',
      suggestedAction: 'Increase pool size to 25 and configure connection recycling with query timeout guards.',
    },
    {
      topic: 'Transcript Chunk Boundary Loss in Speaker Diarization',
      keywords: ['transcript', 'chunk', 'speaker', 'boundary', 'utterance', 'diarization', 'audio'],
      description: 'Speaker transitions at exact chunk boundaries occasionally drop attribution metadata.',
      suggestedAction: 'Implement overlapping 2-second buffer windows between audio transcription chunks.',
    },
  ];

  const issues: RecurringIssue[] = [];

  for (const cluster of knownClusters) {
    const matchingMeetings: string[] = [];
    let firstDate = '';
    let lastDate = '';

    for (const meeting of allMeetings) {
      const textToScan = `${meeting.title} ${meeting.description} ${meeting.rawTranscript || ''} ${meeting.openQuestions.map((q) => q.question).join(' ')} ${meeting.actionItems.map((a) => a.text).join(' ')}`.toLowerCase();

      const matchedKeywordCount = cluster.keywords.filter((k) => textToScan.includes(k)).length;
      if (matchedKeywordCount >= 2) {
        matchingMeetings.push(meeting.id);
        if (!firstDate || meeting.createdAt < firstDate) firstDate = meeting.createdAt;
        if (!lastDate || meeting.createdAt > lastDate) lastDate = meeting.createdAt;
      }
    }

    if (matchingMeetings.length >= 2) {
      const orgId = allMeetings[0]?.organizationId || 'default-org';
      issues.push({
        id: `rec-issue-${cluster.keywords[0]}`,
        organizationId: orgId,
        topic: cluster.topic,
        description: cluster.description,
        occurrenceCount: matchingMeetings.length,
        meetingIds: matchingMeetings,
        firstDetected: firstDate || new Date().toISOString(),
        lastDetected: lastDate || new Date().toISOString(),
        status: 'ACTIVE_UNRESOLVED',
        severity: matchingMeetings.length >= 3 ? 'CRITICAL' : 'HIGH',
        suggestedAction: cluster.suggestedAction,
      });
    }
  }

  return issues;
}

/**
 * Generate follow-up recommendation if open questions or unresolved actions exceed threshold
 */
export function generateFollowUpRecommendation(
  meeting: Meeting,
  historicalMeetings: Meeting[]
): FollowUpRecommendation | null {
  const unresolvedQuestions = meeting.openQuestions.filter((q) => q.status === 'UNRESOLVED');
  const unresolvedActions = meeting.actionItems.filter((a) => a.status === 'TODO' || a.status === 'IN_PROGRESS');

  if (unresolvedQuestions.length >= 2 || unresolvedActions.length >= 3) {
    const proposedTopics = [
      ...unresolvedQuestions.map((q) => `Resolve: ${q.question}`),
      ...unresolvedActions.map((a) => `Review status of: ${a.text} (${a.owner})`),
    ].slice(0, 4);

    return {
      id: `rec-followup-${meeting.id}`,
      organizationId: meeting.organizationId,
      sourceMeetingId: meeting.id,
      recommendedTitle: `Follow-up: Resolution Session for ${meeting.title}`,
      reason: `Detected ${unresolvedQuestions.length} open question(s) and ${unresolvedActions.length} pending action item(s) requiring coordinated closure.`,
      proposedParticipants: meeting.participants.map((p) => p.name),
      proposedTopics,
      status: 'PENDING',
    };
  }

  return null;
}
