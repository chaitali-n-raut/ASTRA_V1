import { ActionItem, Task, TaskStatus } from '../types.ts';

export interface TaskTrackerAdapter {
  createTaskFromAction(action: ActionItem, meetingId: string): Promise<Task>;
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task>;
  getTasks(): Promise<Task[]>;
}

/**
 * MockTaskTrackerAdapter
 * Simulates external task trackers (Jira, Trello, Asana, Linear) for local offline/demo mode.
 * Explicitly labeled as Demo Task Tracker.
 */
export class MockTaskTrackerAdapter implements TaskTrackerAdapter {
  private tasks: Map<string, Task> = new Map();

  async createTaskFromAction(action: ActionItem, meetingId: string): Promise<Task> {
    const existing = Array.from(this.tasks.values()).find(
      (t) => t.actionItemId === action.id || (t.meetingId === meetingId && t.title.toLowerCase() === action.text.toLowerCase())
    );
    if (existing) {
      return existing;
    }

    const task: Task = {
      id: `task-${meetingId}-${this.tasks.size + 1}`,
      organizationId: 'demo-org',
      meetingId,
      actionItemId: action.id,
      title: action.text,
      description: `Generated autonomously by ASTRA Minutes/NLU Agent from Meeting #${meetingId}. Deadline: ${action.deadline}`,
      owner: action.owner,
      deadline: action.deadline,
      priority: action.priority,
      status: action.status || 'TODO',
      source: 'MEETING_ACTION_ITEM',
      syncedToExternal: true,
      externalProvider: 'LINEAR',
      externalTaskId: `ASTRA-DEV-${100 + this.tasks.size + 1}`,
      confidence: action.confidence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in MockTaskTrackerAdapter`);
    }
    task.status = status;
    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);
    return task;
  }

  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  seedTask(task: Task) {
    this.tasks.set(task.id, task);
  }

  clear() {
    this.tasks.clear();
  }
}

export const taskTrackerAdapter = new MockTaskTrackerAdapter();
