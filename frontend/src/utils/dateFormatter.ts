/**
 * Date and Time Formatting Utilities
 * 
 * Provides human-readable date/time formatting with local timezone support.
 * All dates are displayed in the user's local timezone.
 */

/**
 * Formats a date/time in European format: DD.MM.YYYY HH:MM
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string like "8.10.2025 17:00"
 */
export const formatDateTime = (date: Date | string | number | null | undefined): string => {
  if (!date) return 'Not set';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

/**
 * Formats just the date in European format: DD.MM.YYYY
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string like "8.10.2025"
 */
export const formatDate = (date: Date | string | number | null | undefined): string => {
  if (!date) return 'Not set';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}.${month}.${year}`;
};

/**
 * Formats just the time in 24-hour format: HH:MM
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string like "17:00"
 */
export const formatTime = (date: Date | string | number | null | undefined): string => {
  if (!date) return 'Not set';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid time';
  
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
};

/**
 * Formats a date with day name: "Wednesday, 8.10.2025"
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string like "Wednesday, 8.10.2025"
 */
export const formatDateWithDay = (date: Date | string | number | null | undefined): string => {
  if (!date) return 'Not set';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[d.getDay()];
  
  return `${dayName}, ${formatDate(d)}`;
};

/**
 * Formats a date/time with day name: "Wednesday, 8.10.2025 17:00"
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string like "Wednesday, 8.10.2025 17:00"
 */
export const formatDateTimeWithDay = (date: Date | string | number | null | undefined): string => {
  if (!date) return 'Not set';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[d.getDay()];
  
  return `${dayName}, ${formatDateTime(d)}`;
};

/**
 * Formats a relative time like "2 hours ago", "in 3 days"
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string like "2 hours ago"
 */
export const formatRelativeTime = (date: Date | string | number | null | undefined): string => {
  if (!date) return 'Unknown';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  // Future dates
  if (diffMs < 0) {
    const absDiffMin = Math.abs(diffMin);
    const absDiffHour = Math.abs(diffHour);
    const absDiffDay = Math.abs(diffDay);
    
    if (absDiffMin < 60) return `in ${absDiffMin} minute${absDiffMin !== 1 ? 's' : ''}`;
    if (absDiffHour < 24) return `in ${absDiffHour} hour${absDiffHour !== 1 ? 's' : ''}`;
    if (absDiffDay < 7) return `in ${absDiffDay} day${absDiffDay !== 1 ? 's' : ''}`;
    return formatDate(d);
  }
  
  // Past dates
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  
  return formatDate(d);
};

/**
 * Formats a due date with contextual information
 * @param dueDate - Due date
 * @param label - Optional label (default: "Due Date")
 * @returns Formatted string like "Due Date: Wednesday, 8.10.2025 17:00 (in 2 hours)"
 */
export const formatDueDate = (dueDate: Date | string | number | null | undefined, label: string = 'Due Date'): {
  label: string;
  formatted: string;
  relative: string;
} => {
  if (!dueDate) {
    return {
      label,
      formatted: 'Not set',
      relative: ''
    };
  }
  
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) {
    return {
      label,
      formatted: 'Invalid date',
      relative: ''
    };
  }
  
  return {
    label,
    formatted: formatDateTimeWithDay(d),
    relative: formatRelativeTime(d)
  };
};

/**
 * Gets a short relative time for chat messages: "12:34" for today, "Yesterday" for yesterday, "2 Jan" for this year, "2 Jan 2024" for older
 * @param date - Date object, ISO string, or timestamp
 * @returns Short formatted string
 */
export const formatChatTimestamp = (date: Date | string | number | null | undefined): string => {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const messageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  
  // Today: show time
  if (messageDate.getTime() === today.getTime()) {
    return formatTime(d);
  }
  
  // Yesterday
  if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  
  // This year: show day and month
  if (d.getFullYear() === now.getFullYear()) {
    const day = d.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${monthNames[d.getMonth()]}`;
  }
  
  // Older: show day, month, and year
  const day = d.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
};
