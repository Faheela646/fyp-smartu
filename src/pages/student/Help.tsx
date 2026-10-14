import { Bot, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { ChatBody } from "@/components/domain/ChatPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FAQ = [
  { q: "How do I board the bus?", a: "Open My QR and show the code to the conductor. Hostelites also need a confirmed seat or standing ticket for that bus." },
  { q: "What if the bus is full?", a: "When all seats are taken, hostelites can buy a half-price standing ticket from the Book Seat page (while standing spots remain)." },
  { q: "Can I cancel a booking?", a: "Yes, from Book Seat → My bookings. It's free until two hours before departure; after that a cancellation fee applies and your seat is released instantly." },
  { q: "My QR code won't scan.", a: "Raise screen brightness and use the full-screen view. If it still fails, the conductor can mark your attendance manually." },
  { q: "Why can't I book a seat?", a: "Booking may be paused by the Transport Office, or you may have overdue dues. Check Fees & Dues and the announcements." },
  { q: "How are fines decided?", a: "Fines follow the transport rules: for example boarding without a pass, standing without a ticket or late cancellations. You can review and pay them under Fines & Violations." },
];

export default function Help() {
  return (
    <div>
      <PageHeader title="Help & assistant" description="Ask the assistant anything about routes, seats and bookings, or browse common questions." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="flex h-[620px] flex-col overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> SmartU Assistant</CardTitle>
          </CardHeader>
          <ChatBody className="flex-1" />
        </Card>
        <Card className="h-fit">
          <CardHeader><CardTitle>Frequently asked questions</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 py-3.5 text-base font-semibold hover:text-primary">
                    {f.q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-1 pb-3.5 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
