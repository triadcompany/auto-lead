import { CalendarDays, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppointmentCardData {
  id: string;
  datetime: string;
  tipo: string;
  duration_minutes: number | null;
  anotacoes: string | null;
  created_at: string | null;
}

interface AppointmentCardProps {
  appointment: AppointmentCardData;
}

export function AppointmentCard({ appointment }: AppointmentCardProps) {
  return (
    <div className="flex justify-center my-2 px-4">
      <div className="w-full max-w-[85%] rounded-lg border-l-4 border-sky-400 bg-sky-50 dark:bg-sky-950/30 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1">
          <CalendarDays className="h-3 w-3 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">Agendamento</span>
        </div>
        <p className="text-sm font-medium text-foreground">{appointment.tipo}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(parseISO(appointment.datetime), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </div>
          {appointment.duration_minutes && (
            <span className="text-xs text-muted-foreground">
              {appointment.duration_minutes} min
            </span>
          )}
        </div>
        {appointment.anotacoes && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{appointment.anotacoes}</p>
        )}
      </div>
    </div>
  );
}
