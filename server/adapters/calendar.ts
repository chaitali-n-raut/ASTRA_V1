import { CalendarEvent, Meeting } from '../types.ts';

export interface CalendarAdapter {
  createEvent(meeting: Meeting): Promise<CalendarEvent>;
  updateEvent(eventId: string, meeting: Meeting): Promise<CalendarEvent>;
  deleteEvent(eventId: string): Promise<boolean>;
  getEvents(): Promise<CalendarEvent[]>;
}

/**
 * MockCalendarAdapter
 * Simulates calendar synchronization for local demo without needing external OAuth credentials.
 * Explicitly labeled as Demo Adapter.
 */
export class MockCalendarAdapter implements CalendarAdapter {
  private events: Map<string, CalendarEvent> = new Map();

  async createEvent(meeting: Meeting): Promise<CalendarEvent> {
    const slot = meeting.selectedSlot;
    const start = slot ? `${slot.day}T${slot.startTime}:00` : new Date().toISOString();
    const end = slot ? `${slot.day}T${slot.endTime}:00` : new Date(Date.now() + 3600000).toISOString();

    const event: CalendarEvent = {
      id: `cal-evt-${meeting.id}`,
      organizationId: meeting.organizationId || 'demo-org',
      meetingId: meeting.id,
      title: meeting.title,
      startTime: start,
      endTime: end,
      participants: meeting.participants.map((p) => p.email),
      agendaSummary: meeting.agendaItems.map((a) => a.topic).join('; '),
      status: 'CONFIRMED',
      provider: 'GOOGLE_CALENDAR',
      location: 'Virtual Conference Room A (ASTRA Meet)',
      createdAt: new Date().toISOString(),
    };

    this.events.set(event.id, event);
    return event;
  }

  async updateEvent(eventId: string, meeting: Meeting): Promise<CalendarEvent> {
    const existing = this.events.get(eventId);
    if (!existing) {
      return this.createEvent(meeting);
    }
    const slot = meeting.selectedSlot;
    const updated: CalendarEvent = {
      ...existing,
      title: meeting.title,
      startTime: slot ? `${slot.day}T${slot.startTime}:00` : existing.startTime,
      endTime: slot ? `${slot.day}T${slot.endTime}:00` : existing.endTime,
      agendaSummary: meeting.agendaItems.map((a) => a.topic).join('; '),
    };
    this.events.set(eventId, updated);
    return updated;
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    return this.events.delete(eventId);
  }

  async getEvents(): Promise<CalendarEvent[]> {
    return Array.from(this.events.values());
  }

  seedEvent(event: CalendarEvent) {
    this.events.set(event.id, event);
  }
}

export const calendarAdapter = new MockCalendarAdapter();
