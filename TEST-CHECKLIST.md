# SmartU Transport: feature checklist & test log

Four user modules: **Admin**, **Day Scholar**, **Hostelite**, **Conductor** (drivers are employee records managed by the Admin; they have no login).

How it was tested
- **(A)** automated: `npm test`, 162 service-level tests in `src/tests/` (admin, students, tickets, conductor, RBAC & notifications). All pass.
- **(B)** by hand in the running app (production build served on port 4173), driving the real UI and reading results back.
- `[x]` passed · `[~]` partly verified (see note) · `[ ]` not tested

---

## Round 2 changes (this round)

| # | Requirement | Where | Status |
|---|---|---|---|
| 1 | RBAC: students only see their own info + announcements meant for them | `services/rbac.ts`, `lib/audience.ts`, every service | [x] A + B |
| 2 | Ticket QR: one-way = 1 scan, two-way = 2 scans, disposed after 14 h or when used up, then book again | `services/bookings.ts`, `ops.ts` scan, My QR | [x] A + B |
| 3 | Hostelites don't register for the semester | nav, route guard, service | [x] A + B |
| 4 | University routes data from the PDF | `demo/uniRoutes.ts` (17 routes) | [x] A + B |
| 5 | Hostelite ticket log (one-way / two-way counts), downloadable | My Tickets | [x] B |
| 6 | Conductor violation: route number + student name + roll no. | Report page, admin table, DDC mail | [x] A + B |
| 7 | Day scholar attendance log (every boarding) | Attendance page | [x] A + B |
| 8 | Different challans: day scholar per semester, hostelite monthly | `lib/challan.ts`, Fees pages | [x] A + B (PDF look not viewed) |
| 9 | Speed | see "Performance" below | [x] measured |

---

## MODULE 1: ADMIN
- [x] Dashboard, live tracking, 17-route fleet map (B)
- [x] Students: stats, single add, **bulk add (CSV)**, ban, challans single/bulk (A + B); challan = semester for day scholars, monthly for hostelites (A + B, toast says which)
- [x] Fee approvals: single + bulk approve, reject with reason (A + B, round trip to the student)
- [x] Registrations: single + bulk approve/reject; **only day scholars appear** (A)
- [x] Conductor reports → policy 1st Rs.1,000 / 2nd Rs.5,000 / 3rd DDC / vape-pod direct DDC; custom fine, dismiss; DDC email draft with **route number** (A + B)
- [x] Reports table shows the **Route** column (B)
- [x] Announcements with audience targeting (A + B); students only list their own audiences (A)
- [x] **Drivers**: add/edit/delete, assign to bus (A + B). Seeded from each route's authorised person in the PDF
- [x] **Routes page**: 17 routes with number, stops + times (timetable), authorised person and driver/phone (B). Route 17 has no authorised person printed in the PDF (shown as "No driver assigned")
- [x] Schedules, Pricing (new: ticket validity hours, scan gap), booking switch, hostel billing with month filter, scan logs (A/B)
- [~] Reports page charts / table export buttons (B earlier; not re-run this round)

## MODULE 2: DAY SCHOLAR
- [x] **Books tickets too**: one-way or two-way, free (covered by semester fee), no charge on any bill (A + B)
- [x] **My QR**: a QR per active ticket, rotating every 30 s, shows scans left and time left (B)
- [x] **Attendance**: every boarding ("1 of 2", "2 of 2", "marked by conductor") + CSV/PDF (B)
- [x] **Semester fee** page (challan + submit for approval), Registration visible (B)
- [x] Never sees other students' fines/fees/tickets (A)

## MODULE 3: HOSTELITE
- [x] **No Registration** (nav hidden; direct URL → access denied) (A + B)
- [x] Book one-way / two-way, seat or standing; price per trip (Rs. 150 / 300), booking adds to the **monthly bill** (A + B)
- [x] **My Tickets**: counts of one-way vs two-way, total charged, month filter, CSV + PDF download (B)
- [x] **Monthly Fee**: current-month bill grows with tickets, challan per month, pay (A + B)
- [x] Cancel with rule warning; cancelled ticket leaves the bill (A)

## MODULE 4: CONDUCTOR
- [x] Scans **ticket QR**: one-way works once; two-way twice; third scan refused; stale/old QR, unknown ticket, bad QR, wrong bus, banned, expired, trip not started (A + B via logs and on-screen red/green)
- [x] Accidental double scan within the gap doesn't burn the return trip (A + B)
- [x] Start/end trip (own bus only), GPS sharing (A; real phone GPS untested)
- [x] Manual attendance, passenger list (B)
- [x] **Report violation** with route number, student search showing name + roll no. (A + B)

---

## NOTIFICATIONS / RBAC (A)
- [x] A fine / DDC / fee decision / registration decision / ticket event goes **only** to the student concerned (+ admin where relevant)
- [x] DDC referral: admin only
- [x] Announcements: only the targeted audience; trip start/end only to that route's students
- [x] Store is cleared when another person signs in
- [x] 33 permission checks: students can't call admin or conductor actions; a conductor can't read fees/fines or book

## Performance
- First load (student home): **~0.36 s, 15 JS files** on the production build vs **~1.1 s, 102 module requests** on the dev server
- First-screen JavaScript: **2,124 KB → 786 KB**; PDF, charts and scanner code load only on the pages that use them
- Demo-service latency was 500-800 ms per request; now ≤ 120 ms
- GPS bursts from 17 buses are batched into one update; components re-render only for their own bus
- Run the fast version: `npm run demo` → http://localhost:4173

## Still untested / known limits
- Real backend (every non-demo request path is unverified).
- Camera QR scanning, real phone GPS, PDF layout appearance (text content verified), Reports page exports.
- **Map stop positions are schematic**: the PDF has names and times but no coordinates. Admin can enter real ones per stop.
- **Return-trip times are assumed (16:30)**: the PDF only lists morning times. Editable under Schedules.
- Hostelites' routes: the PDF has no hostel shuttle, so hostelites ride the same 17 routes.
- Accessibility sweep (contrast measurement, keyboard) not done.
