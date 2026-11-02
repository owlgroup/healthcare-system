/** Lời chào theo giờ trong ngày (tiếng Việt). */
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** Lời chào cho thời điểm hiện tại. */
export function greetingNow(date = new Date()): string {
  return greetingForHour(date.getHours());
}
