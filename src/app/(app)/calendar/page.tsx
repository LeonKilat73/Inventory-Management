import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { deleteCalendarEvent } from "@/actions/calendarEvents";
import { CalendarEventForm } from "./_components/CalendarEventForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const TYPE_TONE = {
  delivery: "primary",
  restock_task: "tertiary",
  supplier_meeting: "secondary",
  other: "neutral",
} as const;

type EventRow = {
  id: string;
  title: string;
  event_type: keyof typeof TYPE_TONE;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  suppliers: { name: string } | { name: string }[] | null;
  purchase_orders: { po_number: string } | { po_number: string }[] | null;
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  if (permissions.calendar?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view the calendar.
      </p>
    );
  }

  const [{ data: events }, { data: suppliers }] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, title, event_type, starts_at, ends_at, notes, suppliers(name), purchase_orders(po_number)")
      .order("starts_at")
      .returns<EventRow[]>(),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
  ]);

  const canCreate = permissions.calendar?.create === true;
  const canDelete = permissions.calendar?.delete === true;

  const groups = new Map<string, EventRow[]>();
  for (const event of events ?? []) {
    const dateKey = new Date(event.starts_at).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(event);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Calendar</h1>
        <p className="text-sm text-on-surface-variant">
          Deliveries (auto-added when you submit a purchase order with an
          expected date), restock tasks, and supplier meetings.
        </p>
      </div>

      <div className="space-y-6">
        {[...groups.entries()].map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            <h2 className="mb-2 text-sm font-medium text-on-surface-variant">{dateKey}</h2>
            <div className="space-y-2">
              {dayEvents.map((event) => {
                const supplier = Array.isArray(event.suppliers) ? event.suppliers[0] : event.suppliers;
                const po = Array.isArray(event.purchase_orders)
                  ? event.purchase_orders[0]
                  : event.purchase_orders;
                return (
                  <Card key={event.id} className="flex items-start justify-between py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-on-surface">{event.title}</p>
                        <Badge tone={TYPE_TONE[event.event_type]}>
                          {event.event_type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {new Date(event.starts_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {supplier && ` · ${supplier.name}`}
                        {po && ` · ${po.po_number}`}
                      </p>
                      {event.notes && (
                        <p className="mt-2 text-sm text-on-surface-variant">{event.notes}</p>
                      )}
                    </div>
                    {canDelete && (
                      <form action={deleteCalendarEvent.bind(null, event.id)}>
                        <button
                          type="submit"
                          className="text-sm text-error underline underline-offset-2"
                        >
                          Delete
                        </button>
                      </form>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
        {!events?.length && (
          <p className="text-sm text-on-surface-variant">No events yet.</p>
        )}
      </div>

      {canCreate && (
        <Card className="max-w-xl">
          <h2 className="mb-4 text-lg font-medium text-on-surface">New event</h2>
          <CalendarEventForm suppliers={suppliers ?? []} />
        </Card>
      )}
    </div>
  );
}
