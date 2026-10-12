// The shop runs on Philippine time, but the server (Vercel) renders in UTC, so
// a bare toLocaleString() showed times 8 hours behind (a 3:42 PM sync read
// "7:42 AM"). Always pin the zone so server and browser agree.
const TIME_ZONE = "Asia/Manila";

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: TIME_ZONE });
}

export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-PH", { timeStyle: "short", timeZone: TIME_ZONE });
}
