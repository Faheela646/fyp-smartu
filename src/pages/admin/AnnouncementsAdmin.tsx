import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useAction, useAnnouncements } from "@/hooks/useOps";
import { announcementService } from "@/services/ops";
import { timeAgo } from "@/lib/utils";

const schema = z.object({
  title: z.string().trim().min(4, "Title is too short").max(80, "Keep the title under 80 characters"),
  body: z.string().trim().min(10, "Write at least a sentence").max(600, "Max 600 characters"),
  audience: z.enum(["ALL", "HOSTELITE", "DAY_SCHOLAR"]),
});
type Form = z.infer<typeof schema>;

export default function AnnouncementsAdmin() {
  const list = useAnnouncements();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { audience: "ALL" } });
  const publish = useAction((f: Form) => announcementService.publish({ ...f, author: "Transport Office" }), { invalidate: [["announcements"]], success: "Published. Students were notified instantly", onSuccess: () => reset({ title: "", body: "", audience: "ALL" }) });
  const remove = useAction((id: string) => announcementService.remove(id), { invalidate: [["announcements"]], success: "Announcement removed" });

  return (
    <div>
      <PageHeader title="Announcements" description="Publish a notice. It's pushed to students' notification bell in real time." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="h-fit">
          <CardHeader><div><CardTitle>New announcement</CardTitle><CardDescription>Choose who should see it</CardDescription></div></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((f) => publish.mutate(f))} className="space-y-5" noValidate>
              <Input label="Title" error={errors.title?.message} {...register("title")} />
              <Textarea label="Message" rows={5} error={errors.body?.message} {...register("body")} />
              <Select label="Audience" {...register("audience")}><option value="ALL">Everyone</option><option value="HOSTELITE">Hostelites only</option><option value="DAY_SCHOLAR">Day scholars only</option></Select>
              <Button type="submit" size="lg" className="w-full" loading={publish.isPending}><Send className="h-5 w-5" /> Publish</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {list.isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />) : !list.data?.length ? <EmptyState icon={Megaphone} title="Nothing published yet" /> : list.data.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-xl font-bold">{a.title}</h3><p className="text-sm sm:text-base text-muted-foreground">{a.author} · {timeAgo(a.ts)}</p></div>
                  <div className="flex items-center gap-2"><Badge tone={a.audience === "ALL" ? "primary" : "accent"}>{a.audience === "ALL" ? "Everyone" : a.audience === "HOSTELITE" ? "Hostelites" : "Day scholars"}</Badge><Button variant="ghost" size="icon" className="h-10 w-10 text-danger" onClick={() => remove.mutate(a.id)} aria-label={`Delete ${a.title}`}><Trash2 className="h-4.5 w-4.5" /></Button></div>
                </div>
                <p className="mt-3.5 text-base sm:text-lg leading-relaxed">{a.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
