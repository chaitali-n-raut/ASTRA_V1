import { MeetingSlot, ParticipantAvailability, TaskPriority, TimeInterval } from '../types.ts';

/**
 * Robust parser converting any time string into minutes from midnight (0 - 1440).
 * Handles:
 * - 24-hour formats: "10:15", "14:15", "09:00", "12:45"
 * - 12-hour AM/PM formats: "10:15 AM", "12:45 PM", "2:15 PM", "11:30 am", "12:00 pm", "12:00 am"
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const modifier = ampmMatch[3] ? ampmMatch[3].toLowerCase() : null;

    if (modifier === 'pm' && hours < 12) {
      hours += 12;
    } else if (modifier === 'am' && hours === 12) {
      hours = 0;
    }
    return hours * 60 + minutes;
  }

  const [h, m] = trimmed.split(':').map((s) => parseInt(s, 10));
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const norm = ((mins % 1440) + 1440) % 1440;
  const hours = Math.floor(norm / 60);
  const minutes = norm % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatTimeAMPM(timeStr: string): string {
  const mins = timeToMinutes(timeStr);
  const hours24 = Math.floor(mins / 60);
  const minutes = mins % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export interface IntervalMinutes {
  start: number;
  end: number;
}

export function mergeIntervals(intervals: IntervalMinutes[]): IntervalMinutes[] {
  if (intervals.length <= 1) return intervals;
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: IntervalMinutes[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Calculates common intersection intervals across all participants for a specific day
 */
export function findCommonIntersection(
  availabilities: ParticipantAvailability[],
  targetDay: string
): TimeInterval[] {
  if (availabilities.length === 0) return [];

  const participantMergedIntervals: IntervalMinutes[][] = [];

  for (const p of availabilities) {
    const dayIntervals = p.intervals.filter((i) => {
      if (!i.day) return true;
      return (
        i.day.toLowerCase() === targetDay.toLowerCase() ||
        targetDay.toLowerCase().includes(i.day.toLowerCase()) ||
        i.day.toLowerCase().includes(targetDay.toLowerCase())
      );
    });

    const minsIntervals: IntervalMinutes[] = dayIntervals
      .map((i) => ({
        start: timeToMinutes(i.startTime),
        end: timeToMinutes(i.endTime),
      }))
      .filter((i) => i.end > i.start);

    const merged = mergeIntervals(minsIntervals);
    if (merged.length === 0) {
      return [];
    }
    participantMergedIntervals.push(merged);
  }

  let currentIntersection = participantMergedIntervals[0];

  for (let idx = 1; idx < participantMergedIntervals.length; idx++) {
    const nextIntersection: IntervalMinutes[] = [];
    const other = participantMergedIntervals[idx];

    for (const a of currentIntersection) {
      for (const b of other) {
        const s = Math.max(a.start, b.start);
        const e = Math.min(a.end, b.end);
        if (s < e) {
          nextIntersection.push({ start: s, end: e });
        }
      }
    }

    currentIntersection = mergeIntervals(nextIntersection);
    if (currentIntersection.length === 0) {
      return [];
    }
  }

  return currentIntersection.map((iv) => ({
    day: targetDay,
    startTime: minutesToTime(iv.start),
    endTime: minutesToTime(iv.end),
  }));
}

export interface ClientSchedulingResult {
  selectedSlot: MeetingSlot | null;
  candidateSlots: MeetingSlot[];
  alternativeSlots: MeetingSlot[];
  intersectionWindows: TimeInterval[];
  reasoning: string;
  hasConflicts: boolean;
}

export function computeClientSchedule(
  durationMinutes: number,
  priority: TaskPriority,
  preferredDate: string,
  preferredTimeRange: string,
  availabilities: ParticipantAvailability[]
): ClientSchedulingResult {
  const totalParticipants = availabilities.length;
  if (totalParticipants === 0) {
    return {
      selectedSlot: null,
      candidateSlots: [],
      alternativeSlots: [],
      intersectionWindows: [],
      reasoning: 'No participants selected.',
      hasConflicts: true,
    };
  }

  let prefStart = -1;
  let prefEnd = -1;
  let hasPreferredRange = false;
  if (preferredTimeRange && preferredTimeRange.includes('-')) {
    const parts = preferredTimeRange.split('-');
    if (parts.length === 2) {
      const p1 = timeToMinutes(parts[0]);
      const p2 = timeToMinutes(parts[1]);
      if (p2 > p1) {
        prefStart = p1;
        prefEnd = p2;
        hasPreferredRange = true;
      }
    }
  }

  const daysFound = Array.from(
    new Set(availabilities.flatMap((a) => a.intervals.map((i) => i.day)).filter(Boolean))
  );
  const targetDays = daysFound.length > 0 ? daysFound : [preferredDate || '2026-09-29'];

  const allParticipantIds = availabilities.map((a) => a.participantId);
  const candidateSlots: MeetingSlot[] = [];
  const allIntersectionWindows: TimeInterval[] = [];

  for (const day of targetDays) {
    const dayIntersections = findCommonIntersection(availabilities, day);
    allIntersectionWindows.push(...dayIntersections);

    for (const iv of dayIntersections) {
      const wStart = timeToMinutes(iv.startTime);
      const wEnd = timeToMinutes(iv.endTime);
      const windowLen = wEnd - wStart;

      if (windowLen >= durationMinutes) {
        const slotStarts = new Set<number>();
        for (let s = wStart; s + durationMinutes <= wEnd; s += 15) {
          slotStarts.add(s);
        }
        const boundaryStart = wEnd - durationMinutes;
        if (boundaryStart >= wStart) {
          slotStarts.add(boundaryStart);
        }

        const sortedStarts = Array.from(slotStarts).sort((a, b) => a - b);
        for (const s of sortedStarts) {
          candidateSlots.push({
            day,
            startTime: minutesToTime(s),
            endTime: minutesToTime(s + durationMinutes),
            durationMinutes,
            availableParticipantIds: [...allParticipantIds],
            conflictParticipantIds: [],
            score: 0,
            reasoning: '',
          });
        }
      }
    }
  }

  let hasConflicts = false;
  if (candidateSlots.length === 0 && totalParticipants > 1) {
    hasConflicts = true;
    for (const day of targetDays) {
      for (let skipIdx = 0; skipIdx < totalParticipants; skipIdx++) {
        const subset = availabilities.filter((_, idx) => idx !== skipIdx);
        const skipped = availabilities[skipIdx];
        const subsetIntersections = findCommonIntersection(subset, day);

        for (const iv of subsetIntersections) {
          const wStart = timeToMinutes(iv.startTime);
          const wEnd = timeToMinutes(iv.endTime);
          if (wEnd - wStart >= durationMinutes) {
            const slotStarts = new Set<number>();
            for (let s = wStart; s + durationMinutes <= wEnd; s += 15) {
              slotStarts.add(s);
            }
            const boundaryStart = wEnd - durationMinutes;
            if (boundaryStart >= wStart) {
              slotStarts.add(boundaryStart);
            }

            for (const s of Array.from(slotStarts).sort((a, b) => a - b)) {
              const sTime = minutesToTime(s);
              const eTime = minutesToTime(s + durationMinutes);
              const exists = candidateSlots.some(
                (c) => c.day === day && c.startTime === sTime && c.endTime === eTime
              );
              if (!exists) {
                candidateSlots.push({
                  day,
                  startTime: sTime,
                  endTime: eTime,
                  durationMinutes,
                  availableParticipantIds: subset.map((p) => p.participantId),
                  conflictParticipantIds: [skipped.participantId],
                  score: 0,
                  reasoning: '',
                });
              }
            }
          }
        }
      }
    }
  }

  for (const slot of candidateSlots) {
    const sStart = timeToMinutes(slot.startTime);
    const sEnd = timeToMinutes(slot.endTime);
    const availRatio = slot.availableParticipantIds.length / totalParticipants;
    const isZeroConflict = slot.conflictParticipantIds.length === 0;

    const quorumScore = isZeroConflict ? 60 : availRatio * 35;

    let prefScore = 0;
    if (hasPreferredRange) {
      if (sStart >= prefStart && sEnd <= prefEnd) {
        prefScore = 25;
      } else if (Math.max(sStart, prefStart) < Math.min(sEnd, prefEnd)) {
        prefScore = 15;
      } else {
        const dist = Math.min(Math.abs(sStart - prefEnd), Math.abs(prefStart - sEnd));
        prefScore = Math.max(0, 10 - Math.floor(dist / 30));
      }
    } else {
      prefScore = 20;
    }

    let dateScore = 0;
    if (
      preferredDate &&
      (slot.day.toLowerCase().includes(preferredDate.toLowerCase()) ||
        preferredDate.toLowerCase().includes(slot.day.toLowerCase()))
    ) {
      dateScore = 10;
    }

    const workHoursBonus = sStart >= 540 && sEnd <= 1080 ? 5 : 0;
    const priorityBonus =
      priority === 'HIGH' || priority === 'CRITICAL' || priority === 'URGENT' ? 5 : 0;
    const conflictPenalty = slot.conflictParticipantIds.length * 40;
    const boundaryBonus = sStart % 15 === 0 ? 2 : 0;

    const totalScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          quorumScore +
            prefScore +
            dateScore +
            workHoursBonus +
            priorityBonus +
            boundaryBonus -
            conflictPenalty
        )
      )
    );

    slot.score = totalScore;
    if (isZeroConflict) {
      slot.reasoning =
        `Unanimous: All ${totalParticipants} participants available. ` +
        `Zero conflicts detected within common overlap interval. ` +
        (hasPreferredRange && sStart >= prefStart && sEnd <= prefEnd
          ? 'Aligns with preferred focus window. '
          : '') +
        `Meets requested ${durationMinutes}m duration.`;
    } else {
      const conflictNames = slot.conflictParticipantIds
        .map((id) => {
          const p = availabilities.find((a) => a.participantId === id);
          return p ? p.participantName : id;
        })
        .join(', ');
      slot.reasoning =
        `Partial quorum: ${slot.availableParticipantIds.length}/${totalParticipants} participants available. ` +
        `Conflict for: ${conflictNames}.`;
    }
  }

  candidateSlots.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.availableParticipantIds.length !== a.availableParticipantIds.length) {
      return b.availableParticipantIds.length - a.availableParticipantIds.length;
    }
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });

  const selectedSlot = candidateSlots[0] || null;
  const alternativeSlots = candidateSlots.slice(1, 5);

  let finalReasoning = '';
  if (selectedSlot) {
    if (selectedSlot.conflictParticipantIds.length === 0) {
      finalReasoning =
        `Selected ${selectedSlot.day} ${selectedSlot.startTime}–${selectedSlot.endTime} (Score: ${selectedSlot.score}/100). ` +
        `All ${totalParticipants} participants mutually available. ` +
        `Common overlap window discovered: ${
          allIntersectionWindows.map((w) => `${w.startTime}–${w.endTime}`).join(', ') || 'N/A'
        }. ` +
        `Validated against ${durationMinutes}-minute duration constraint and ${priority} priority.`;
    } else {
      finalReasoning =
        `Selected partial quorum slot ${selectedSlot.day} ${selectedSlot.startTime}–${selectedSlot.endTime} (Score: ${selectedSlot.score}/100). ` +
        `${selectedSlot.availableParticipantIds.length}/${totalParticipants} participants available. ` +
        `Full unanimity was not possible for ${durationMinutes} minutes.`;
    }
  } else {
    finalReasoning = `No feasible time interval could satisfy meeting duration (${durationMinutes} mins) for any quorum of participants.`;
  }

  return {
    selectedSlot,
    candidateSlots,
    alternativeSlots,
    intersectionWindows: allIntersectionWindows,
    reasoning: finalReasoning,
    hasConflicts,
  };
}
