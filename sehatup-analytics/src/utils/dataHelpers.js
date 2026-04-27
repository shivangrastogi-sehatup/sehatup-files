// src/utils/dataHelpers.js
/**
 * Helper function to format a Date string or object to DD/MMM/YYYY (e.g., 12/Aug/2002).
 * @param {Date|string} dateInput 
 * @returns {string} formatted date string
 */
export function formatDateToCustom(dateInput) {
    if (!dateInput) return 'N/A';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput; // Fallback to original if invalid
    
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}


/**
 * Helper function to safely format a Date object.
 * @param {Date} date 
 * @returns {string} formatted date string
 */
export function formatDate(date) {
    if (!date || !(date instanceof Date)) return 'N/A';
    return date.toLocaleString();
}

/**
 * Compares two values for sorting based on type.
 * @param {*} a 
 * @param {*} b 
 * @returns {number} 1, -1, or 0
 */
export function compareValues(a, b) {
    if (typeof a === 'string' && typeof b === 'string') {
        return a.localeCompare(b);
    }
    if (typeof a === 'number' && typeof b === 'number') {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }
    // Convert to string for comparison if types are mixed or unknown
    return String(a || '').localeCompare(String(b || ''));
}

/**
 * Helper function to format a Date object for HTML date input (YYYY-MM-DD).
 * @param {Date} date 
 * @returns {string} formatted date string
 */
export function dateToInputFormat(date) {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Robustly parses any timestamp-like input into a JS Date object.
 * Handles Firestore Timestamps, JS Dates, ISO strings, and Unix seconds/ms.
 */
export function parseFirestoreDate(ts) {
    if (!ts) return null;
    
    // 1. Firestore Timestamp object
    if (typeof ts.toDate === 'function') return ts.toDate();
    
    // 2. Already a JS Date object
    if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
    
    // 3. Serialized Firestore Timestamp {seconds, nanoseconds}
    if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
    
    // 4. ISO String or Unix Timestamp
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Standardized table timestamp formatter.
 * Output: "Thu, 27 Mar 2026, 02:45 PM"
 */
export function formatTableTimestamp(ts) {
    const d = parseFirestoreDate(ts);
    if (!d) return 'N/A';
    
    return d.toLocaleString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Calculates age based on a birth date.
 * @param {Date|string} dob 
 * @returns {number|string} age or 'N/A'
 */
export function calculateAge(dob) {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return 'N/A';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age > 0 ? age : 'N/A';
}