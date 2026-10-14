import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Armchair, Eye, EyeOff, MapPin, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/domain/Logo";
import { ThemeToggle } from "@/components/domain/ThemeToggle";
import { authService } from "@/services/auth";
import { errorMessage } from "@/services/http";
import { DEMO_MODE } from "@/services/wsClient";
import { DEMO_ACCOUNTS } from "@/demo/data";
import { checkUniEmail, EMAIL_HELP } from "@/lib/email";
import { homeForRole, useAuthStore } from "@/store/auth";
import { ROLE_LABEL } from "@/app/nav";

const schema = z.object({
  email: z.string().superRefine((v, ctx) => {
    const c = checkUniEmail(v);
    if (!c.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: c.message });
  }),
  password: z.string().min(1, "Enter your password"),
});
type Form = z.infer<typeof schema>;

const features = [
  { icon: MapPin, title: "Live tracking", text: "Watch every shuttle move on the map" },
  { icon: Armchair, title: "Seat availability", text: "See open seats and book in seconds" },
  { icon: QrCode, title: "QR boarding", text: "Scan once and you're on board" },
];

const ROAD = "M -40 330 C 120 330, 160 150, 320 170 S 560 330, 720 120";

export default function Login() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), mode: "onBlur" });

  if (user) return <Navigate to={homeForRole(user.role)} replace />;

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      const res = await authService.login(data);
      setSession(res.user, res.token);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? homeForRole(res.user.role), { replace: true });
    } catch (e) {
      setServerError(errorMessage(e, "Could not sign in."));
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0B1326] via-[#14307A] to-[#1D4ED8] p-12 text-center text-white lg:flex">
        {/* animated road + bus */}
        <svg aria-hidden viewBox="0 0 700 400" className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full opacity-90" preserveAspectRatio="xMidYMax slice">
          <path d={ROAD} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="26" strokeLinecap="round" />
          <path d={ROAD} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="3" strokeDasharray="4 16" strokeLinecap="round" />
          {[[320, 170], [560, 250], [120, 300]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="9" fill="#fff" />
              <circle cx={x} cy={y} r="18" fill="none" stroke="rgba(255,255,255,.35)" />
            </g>
          ))}
          <g>
            <animateMotion dur="16s" repeatCount="indefinite" path={ROAD} rotate="0" />
            <circle r="24" fill="#fff" />
            <g transform="translate(-12,-12)" fill="none" stroke="#14307A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6v6M16 6v6M2 12h20M4 6h16a2 2 0 0 1 2 2v8h-2M4 6a2 2 0 0 0-2 2v8h2" />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
              <path d="M9 18h6" />
            </g>
          </g>
        </svg>

        {/* everything is centred in the blue panel */}
        <div className="relative z-10 flex w-full max-w-lg flex-col items-center">
          <Logo className="max-w-[280px]" />
          <h2 className="mt-10 text-4xl font-extrabold leading-tight">Smarter commutes for every FAST-NUCES student.</h2>
          <ul className="mt-10 space-y-5 text-left">
            {features.map((f) => (
              <li key={f.title} className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-white/15 backdrop-blur">
                  <f.icon className="h-6 w-6" aria-hidden />
                </span>
                <span>
                  <span className="block text-lg font-bold">{f.title}</span>
                  <span className="block text-base text-white/80">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-12 text-sm text-white/70">FAST National University, Chiniot-Faisalabad Campus</p>
        </div>
      </aside>

      <main className="relative flex items-center justify-center px-5 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <Logo className="mx-auto mb-8 max-w-[260px] lg:hidden" />
          <h1 className="text-3xl font-extrabold">Welcome back</h1>
          <p className="mt-2 text-base text-muted-foreground">Sign in with your university email to continue.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            <Input label="University email" type="email" inputMode="email" autoComplete="username" placeholder="f223284@cfd.nu.edu.pk" hint={errors.email ? undefined : EMAIL_HELP} error={errors.email?.message} {...register("email")} />
            <div className="relative">
              <Input label="Password" type={show ? "text" : "password"} autoComplete="current-password" error={errors.password?.message} className="pr-12" {...register("password")} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-[38px] rounded p-1 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {serverError && (
              <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {serverError}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-base text-muted-foreground">
            New here?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>

          {DEMO_MODE && (
            <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-4">
              <p className="mb-3 text-sm font-semibold text-muted-foreground">Demo accounts: tap to fill</p>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setServerError(null);
                      setValue("email", a.email!, { shouldValidate: true });
                      setValue("password", a.password, { shouldValidate: true });
                    }}
                    className="rounded-full border border-border bg-muted px-3.5 py-1.5 text-sm font-semibold hover:bg-primary-soft hover:text-primary"
                  >
                    {ROLE_LABEL[a.role]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
