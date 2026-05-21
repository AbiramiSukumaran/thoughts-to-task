/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: any; // Firestore Timestamp
}

export interface Thought {
  id: string;
  userId: string;
  rawText: string;
  inputType: 'text' | 'voice' | 'template';
  processed: boolean;
  convertedTaskId: string | null;
  createdAt: any; // Firestore Timestamp
}

export interface TaskSubtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'archived';
  subtasks: TaskSubtask[];
  category?: string;
  tags?: string[];
  dueDate?: string | null; // e.g. "2026-05-25"
  durationMinutes?: number;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  sourceThoughtId: string | null;
}
