import { useMemo } from 'react';
import { ConversationNote } from './useConversationNotes';
import { TaskWithDetails } from './useTasks';

export interface TimelineNote {
  _type: 'note';
  id: string;
  created_at: string;
  data: ConversationNote;
}

export interface TimelineTask {
  _type: 'task';
  id: string;
  created_at: string;
  data: TaskWithDetails;
}

export interface TimelineAppointment {
  _type: 'appointment';
  id: string;
  created_at: string;
  data: {
    id: string;
    datetime: string;
    tipo: string;
    duration_minutes: number | null;
    anotacoes: string | null;
    created_at: string | null;
  };
}

export type TimelineItem = TimelineNote | TimelineTask | TimelineAppointment;

export function useConversationTimeline(
  notes: ConversationNote[],
  tasks: TaskWithDetails[],
  appointments: TimelineAppointment['data'][]
): TimelineItem[] {
  return useMemo(() => {
    const items: TimelineItem[] = [
      ...notes.map((n): TimelineNote => ({
        _type: 'note',
        id: n.id,
        created_at: n.created_at,
        data: n,
      })),
      ...tasks.map((t): TimelineTask => ({
        _type: 'task',
        id: t.id,
        created_at: t.created_at ?? '',
        data: t,
      })),
      ...appointments.map((a): TimelineAppointment => ({
        _type: 'appointment',
        id: a.id,
        created_at: a.created_at ?? a.datetime,
        data: a,
      })),
    ];
    return items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [notes, tasks, appointments]);
}
