import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, GraduationCap, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/domain/Logo";
import { authService } from "@/services/auth";
import { errorMessage } from "@/services/http";
import { checkUniEmail, EMAIL_HELP } from "@/lib/email";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    name: z.string().trim().min(3, "Enter your full name"),
    email: z.string().superRefine((v, ctx) => {
      const c = checkUniEmail(v);
      if (!c.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: c.message });
    }),
    residence: z.enum(["DAY_SCHOLAR", "HOSTELITE"]),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" });
type Form = z.infer<typeof schema>;

export default function Register() {
  const [done, setDone] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { residence: "DAY_SCHOLAR" },
  });
  const residence = watch("residence");
  const parsed = checkUniEmail(watch("email") ?? "");

  const onSubmit = async (d: Form) => {
    setServerError(null);
    try {
      const { user } = await authService.register({ name: d.name, email: d.email, password: d.password, residence: d.residence });
      setDone(user.email ?? d.email);
    } catch (e) {
      setServerError(errorMessage(e));
    }
  };

  if (done)
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="max-w-sm">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" aria-hidden />
          <h1>Account created</h1>
          <p className="mt-2 text-base text-muted-foreground">You can now sign in with <span className="font-semibold text-foreground">{done}</span>.</p>
          <Button asChild className="mt-5" size="lg">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Logo className="mx-auto mb-6 max-w-[220px]" />
        <h1 className="text-3xl font-extrabold">Create your account</h1>
        <p className="mt-1 text-base text-muted-foreground">Use your university email. Conductor and admin accounts are created by the Transport Office.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
          <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register("name")} />
          <div>
            <Input label="University email" type="email" inputMode="email" autoComplete="email" placeholder="f223284@cfd.nu.edu.pk" hint={errors.email ? undefined : EMAIL_HELP} error={errors.email?.message} {...register("email")} />
            {parsed.ok && (
              <p className="mt-2 flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm font-medium text-success" role="status">
                {parsed.kind === "student" ? <GraduationCap className="h-4 w-4" aria-hidden /> : <UserRound className="h-4 w-4" aria-hidden />}
                {parsed.kind === "student" ? `Student · batch 20${parsed.batch} · roll number ${parsed.rollNo}` : "Teacher / staff account (faculty)"}
              </p>
            )}
          </div>
          {parsed.ok && parsed.kind === "student" && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">I am a</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["DAY_SCHOLAR", "HOSTELITE"] as const).map((v) => (
                  <label key={v} className={cn("cursor-pointer rounded-md border-2 px-3 py-3 text-center text-base font-semibold transition-colors focus-within:ring-2 focus-within:ring-ring", residence === v ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-muted")}>
                    <input type="radio" className="sr-only" checked={residence === v} onChange={() => setValue("residence", v)} />
                    {v === "DAY_SCHOLAR" ? "Day scholar" : "Hostelite"}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
            <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
          </div>
          {serverError && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {serverError}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            Create account
          </Button>
        </form>
        <p className="mt-5 text-center text-base text-muted-foreground">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
