export const SESSIONS = ['Asian', 'London', 'New York AM', 'New York PM'];
export const EMOTIONS = ['Confident', 'Anxious', 'FOMO', 'Revenge', 'Calm', 'Hesitant'];
export const GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Duration between two HH:MM times, e.g. "1h 05m". An exit earlier than the
// entry is treated as crossing midnight (23:30 -> 00:15 = 45m).
export function tradeDuration(entryTime?: string | null, exitTime?: string | null): string | null {
  if (!entryTime || !exitTime) return null;

  let minutes = toMinutes(exitTime) - toMinutes(entryTime);
  if (minutes < 0) minutes += 24 * 60;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}
