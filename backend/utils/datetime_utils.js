/**
 * Centralized DateTime Utility
 * Handles timezone conversions and date operations consistently across the application
 * 
 * TIMEZONE HANDLING STRATEGY:
 * ==========================
 * 
 * 1. STORAGE (Database):
 *    - All timestamps are stored in UTC using getISOString()
 *    - This ensures consistency regardless of server timezone
 *    
 * 2. SERVER PROCESSING:
 *    - Server processes dates/times using this centralized utility
 *    - formatDatabaseTimestampForClient() converts UTC to ISO strings for client
 *    - No timezone assumptions are made in application logic
 *    
 * 3. CLIENT DISPLAY:
 *    - Client receives ISO strings from server
 *    - Frontend DateTimeUtils converts to user's local timezone
 *    - All display formatting uses browser's native timezone handling
 *    
 * 4. CONSISTENCY RULES:
 *    - NEVER format timestamps directly with toLocaleString() in application code
 *    - ALWAYS use these centralized utilities for any date/time operations
 *    - Database stores UTC, client displays local time automatically
 *    
 * This approach eliminates the common UTC vs Local timezone confusion
 * and ensures consistent behavior across different deployment environments.
 */

class DateTimeUtils {
    /**
     * Get current date in local timezone (YYYY-MM-DD format)
     */
    static getLocalDateString(date = new Date()) {
        return date.getFullYear() + '-' + 
               String(date.getMonth() + 1).padStart(2, '0') + '-' + 
               String(date.getDate()).padStart(2, '0');
    }

    /**
     * Get current date in UTC timezone (YYYY-MM-DD format)
     */
    static getUTCDateString(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Get current local time formatted for display
     */
    static getLocalTimeString(date = new Date()) {
        return date.toLocaleString();
    }

    /**
     * Get current time in ISO format (UTC)
     */
    static getISOString(date = new Date()) {
        return date.toISOString();
    }

    /**
     * Add time to a date (handles timezone properly)
     * @param {Date} date - Base date
     * @param {number} amount - Amount to add
     * @param {string} unit - 'minutes', 'hours', 'days'
     * @returns {Date}
     */
    static addTime(date, amount, unit) {
        const newDate = new Date(date);
        
        switch (unit.toLowerCase()) {
            case 'second':
            case 'seconds':
                newDate.setSeconds(newDate.getSeconds() + amount);
                break;
            case 'minute':
            case 'minutes':
                newDate.setMinutes(newDate.getMinutes() + amount);
                break;
            case 'hour':
            case 'hours':
                newDate.setHours(newDate.getHours() + amount);
                break;
            case 'day':
            case 'days':
                newDate.setDate(newDate.getDate() + amount);
                break;
            default:
                throw new Error(`Unsupported time unit: ${unit}`);
        }
        
        return newDate;
    }

    /**
     * Parse relative time expressions and return absolute date
     * @param {string} expression - "in 5 minutes", "within 2 hours", etc.
     * @param {Date} baseDate - Base date (defaults to now)
     * @returns {Date|null}
     */
    static parseRelativeTime(expression, baseDate = new Date()) {
        const expr = expression.toLowerCase().trim();
        
        // Match patterns like "in 5 minutes", "within 2 hours", "due in 30 seconds"
        const patterns = [
            /(?:in|due in|within|within exactly)\s+(\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days)/i,
            /(?:by|before)\s+(\d+)\s*(minute|minutes|hour|hours)/i
        ];
        
        for (const pattern of patterns) {
            const match = expr.match(pattern);
            if (match) {
                const amount = parseInt(match[1]);
                const unit = match[2];
                
                return this.addTime(baseDate, amount, unit);
            }
        }
        
        return null;
    }

    /**
     * Parse absolute time expressions (like "by 4:30 PM")
     * @param {string} expression - Time expression
     * @param {Date} baseDate - Base date (defaults to today)
     * @returns {Date|null}
     */
    static parseAbsoluteTime(expression, baseDate = new Date()) {
        const timeMatch = expression.match(/(?:by|at|before)\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
        if (!timeMatch) return null;
        
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3];
        
        let adjustedHour = hour;
        if (ampm) {
            if (ampm.toLowerCase() === 'pm' && hour !== 12) {
                adjustedHour += 12;
            } else if (ampm.toLowerCase() === 'am' && hour === 12) {
                adjustedHour = 0;
            }
        }
        
        const dueDate = new Date(baseDate);
        dueDate.setHours(adjustedHour, minute, 0, 0);
        
        // If time has passed today, assume tomorrow (unless explicitly mentioned)
        if (dueDate <= baseDate && !expression.toLowerCase().includes('tomorrow')) {
            if (!expression.toLowerCase().includes('today')) {
                dueDate.setDate(dueDate.getDate() + 1);
            }
        }
        
        return dueDate;
    }

    /**
     * Comprehensive date/time parsing that handles both relative and absolute expressions
     * @param {string} message - Full message containing date/time info
     * @param {Date} baseDate - Base date (defaults to now)
     * @returns {Date|null}
     */
    static parseDateTime(message, baseDate = new Date()) {
        // Try relative time first
        const relativeDate = this.parseRelativeTime(message, baseDate);
        if (relativeDate) return relativeDate;
        
        // Try absolute time
        const absoluteDate = this.parseAbsoluteTime(message, baseDate);
        if (absoluteDate) return absoluteDate;
        
        // Handle special cases
        const messageLower = message.toLowerCase();
        
        if (messageLower.includes('tomorrow')) {
            const tomorrow = new Date(baseDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(23, 59, 59, 999); // End of day
            return tomorrow;
        }
        
        if (messageLower.includes('next week')) {
            const nextWeek = new Date(baseDate);
            nextWeek.setDate(nextWeek.getDate() + 7);
            nextWeek.setHours(23, 59, 59, 999);
            return nextWeek;
        }
        
        return null;
    }

    /**
     * Get current context for LLM date extraction
     * Returns both local and UTC context to avoid timezone confusion
     */
    static getCurrentTimeContext() {
        const now = new Date();
        return {
            utcTime: now.toISOString(),
            localTime: now.toString(),
            localDate: this.getLocalDateString(now),
            utcDate: this.getUTCDateString(now),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: now.getTime()
        };
    }

    /**
     * Get comprehensive system prompt formatted date/time for LLMs
     * This is THE central method for providing date/time context to all LLMs
     */
    static getSystemPromptDateTime(date = new Date()) {
        const timestamp = date.getTime();
        const oneMinuteFromNow = new Date(timestamp + 60000);
        const fiveMinutesFromNow = new Date(timestamp + 300000);
        const oneHourFromNow = new Date(timestamp + 3600000);
        
        return `Current date and time: ${date.toLocaleString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}
Current UTC time: ${date.toISOString()}
Current timestamp: ${timestamp}
Local date: ${this.getLocalDateString(date)}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

Time calculation examples for relative times:
- "in 1 minute" = ${oneMinuteFromNow.toISOString()}
- "in 5 minutes" = ${fiveMinutesFromNow.toISOString()}
- "in 1 hour" = ${oneHourFromNow.toISOString()}

IMPORTANT: Use the current timestamp (${timestamp}) for all relative time calculations by adding milliseconds.`;
    }

    /**
     * Get conversational date/time string
     */
    static getConversationalDateTime(date = new Date()) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === -1) {
            return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return `${date.toLocaleDateString()}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
    }

    /**
     * Get business date/time formatting
     */
    static getBusinessDateTime(date = new Date()) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    /**
     * Check if current time is business hours
     */
    static isBusinessHours(date = new Date()) {
        const hour = date.getHours();
        const dayOfWeek = date.getDay();
        
        // Monday-Friday, 9 AM to 5 PM
        return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 17;
    }

    /**
     * Get time-aware greeting
     */
    static getTimeAwareGreeting(date = new Date()) {
        const hour = date.getHours();
        
        if (hour < 12) {
            return "Good morning";
        } else if (hour < 17) {
            return "Good afternoon";
        } else if (hour < 21) {
            return "Good evening";
        } else {
            return "Good night";
        }
    }

    /**
     * Get relative time description
     */
    static getRelativeTime(targetDate, fromDate = new Date()) {
        const diff = targetDate - fromDate;
        const absDiff = Math.abs(diff);
        
        if (absDiff < 60000) { // Less than 1 minute
            return diff > 0 ? 'in a few seconds' : 'a few seconds ago';
        }
        
        const minutes = Math.floor(absDiff / 60000);
        const hours = Math.floor(absDiff / 3600000);
        const days = Math.floor(absDiff / 86400000);
        
        if (absDiff < 3600000) { // Less than 1 hour
            const suffix = diff > 0 ? 'from now' : 'ago';
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ${suffix}`;
        } else if (absDiff < 86400000) { // Less than 1 day
            const suffix = diff > 0 ? 'from now' : 'ago';
            return `${hours} hour${hours !== 1 ? 's' : ''} ${suffix}`;
        } else {
            const suffix = diff > 0 ? 'from now' : 'ago';
            return `${days} day${days !== 1 ? 's' : ''} ${suffix}`;
        }
    }

    /**
     * Get comprehensive system context for LLMs - THE central method
     */
    static getSystemContext(sessionId = null) {
        const now = new Date();
        return {
            dateTime: this.getSystemPromptDateTime(now),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: now.getTime(),
            conversational: this.getConversationalDateTime(now),
            business: this.getBusinessDateTime(now),
            isBusinessHours: this.isBusinessHours(now),
            greeting: this.getTimeAwareGreeting(now),
            localDate: this.getLocalDateString(now),
            utcDate: this.getUTCDateString(now)
        };
    }

    /**
     * Convert database UTC timestamp to local display format
     * This is THE central method for displaying timestamps from the database
     * @param {string|Date} dbTimestamp - Timestamp from database (UTC)
     * @param {boolean} includeTime - Whether to include time portion
     * @returns {string} Formatted timestamp in local timezone
     */
    static formatDatabaseTimestamp(dbTimestamp, includeTime = true) {
        if (!dbTimestamp) return 'No date';
        
        let date;
        if (typeof dbTimestamp === 'string') {
            // Check if it's already an ISO string (has 'T' and potentially 'Z')
            if (dbTimestamp.includes('T')) {
                date = new Date(dbTimestamp);
            } else {
                // SQLite timestamp format: "YYYY-MM-DD HH:MM:SS"
                // These are stored in UTC time (since server runs in UTC)
                // Convert to proper UTC ISO string for parsing
                const utcString = dbTimestamp.replace(' ', 'T') + 'Z';
                date = new Date(utcString);
            }
        } else {
            date = new Date(dbTimestamp);
        }
        
        // Validate that we have a valid date
        if (isNaN(date.getTime())) {
            console.warn('Invalid timestamp received:', dbTimestamp);
            return 'Invalid date';
        }
        
        // Format for display using local timezone
        const options = {
            year: 'numeric',
            month: 'short', 
            day: 'numeric'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        
        return date.toLocaleString(undefined, options);
    }

    /**
     * Convert database UTC timestamp to ISO string for client transmission
     * Ensures consistent timezone handling between server and client
     * @param {string|Date} dbTimestamp - Timestamp from database (always UTC)
     * @returns {string} ISO string with proper timezone info
     */
    static formatDatabaseTimestampForClient(dbTimestamp) {
        if (!dbTimestamp) return null;
        
        let date;
        if (typeof dbTimestamp === 'string') {
            // Check if it's already an ISO string (has 'T' and potentially 'Z')
            if (dbTimestamp.includes('T')) {
                // Already in ISO format - just parse it
                date = new Date(dbTimestamp);
            } else {
                // SQLite timestamp format: "YYYY-MM-DD HH:MM:SS"
                // Database stores timestamps in UTC (using getISOString())
                // Convert to proper UTC ISO string for parsing
                const utcString = dbTimestamp.replace(' ', 'T') + 'Z';
                date = new Date(utcString);
            }
        } else {
            date = new Date(dbTimestamp);
        }
        
        if (isNaN(date.getTime())) {
            console.warn('Invalid timestamp for client:', dbTimestamp);
            return null;
        }
        
        // Return as ISO string - the client will handle local timezone conversion
        return date.toISOString();
    }

    /**
     * Enhanced format date for display (human-readable) with better timezone handling
     */
    static formatForDisplay(date, includeTime = true) {
        if (!date) return 'No date';
        
        let dateObj;
        if (typeof date === 'string') {
            dateObj = new Date(date);
        } else {
            dateObj = new Date(date);
        }
        
        if (isNaN(dateObj.getTime())) {
            console.warn('Invalid date for display:', date);
            return 'Invalid date';
        }
        
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        
        return dateObj.toLocaleString(undefined, options);
    }

    /**
     * Check if a date is overdue
     */
    static isOverdue(date, compareWith = new Date()) {
        return new Date(date) < compareWith;
    }

    /**
     * Get time difference in human-readable format
     */
    static getTimeUntil(futureDate, fromDate = new Date()) {
        const diff = new Date(futureDate) - fromDate;
        
        if (diff <= 0) {
            return 'overdue';
        }
        
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }

    /**
     * Format timestamp for client display (to be used in frontend)
     * Handles both ISO strings and other timestamp formats
     * @param {string|Date} timestamp - Timestamp to format
     * @returns {string} Human-readable timestamp in local timezone
     */
    static formatTimestampForDisplay(timestamp) {
        if (!timestamp) return '';
        
        // Create date object from timestamp (handles both ISO strings and other formats)
        const messageDate = new Date(timestamp);
        
        // Validate that we have a valid date
        if (isNaN(messageDate.getTime())) {
            console.warn('Invalid timestamp received:', timestamp);
            return 'Invalid date';
        }
        
        const now = new Date();
        const diffMs = now - messageDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        // If it's today, just show the time
        if (diffDays === 0) {
            return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        // If it's yesterday, show "Yesterday HH:MM"
        else if (diffDays === 1) {
            const time = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `Yesterday ${time}`;
        }
        // If it's within a week, show day and time
        else if (diffDays < 7) {
            const dayName = messageDate.toLocaleDateString([], { weekday: 'short' });
            const time = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${dayName} ${time}`;
        }
        // If it's older, show date and time
        else {
            const date = messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const time = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${date} ${time}`;
        }
    }

    /**
     * Get current time for display (to be used in frontend)
     * @returns {string} Current time in HH:MM format
     */
    static getCurrentTimeForDisplay() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

module.exports = DateTimeUtils; 