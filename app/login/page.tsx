"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.5 6.7C4 8.3 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.7-1.2M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-2.2 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Text/label crossfade helper: stacks children in the same CSS grid cell
 * ([grid-area:1/1]) so the container's box auto-sizes to the largest child
 * and swapping which one is visible produces a true crossfade with no
 * layout jump — no extra state, no absolute-positioning math.
 */
function CrossfadeStack({
  activeKey,
  items,
  className = "",
}: {
  activeKey: string;
  items: { key: string; content: React.ReactNode; className?: string }[];
  className?: string;
}) {
  return (
    <div className={`grid ${className}`}>
      {items.map((item) => (
        <span
          key={item.key}
          className={`[grid-area:1/1] transition-all duration-400 ease-out ${
            item.key === activeKey
              ? "opacity-100 translate-y-0"
              : "pointer-events-none opacity-0 -translate-y-1"
          } ${item.className ?? ""}`}
        >
          {item.content}
        </span>
      ))}
    </div>
  );
}

export default function CinematicLogin() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "unspecified">("unspecified");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Purely cosmetic — doesn't touch auth state or logic.
  const [showPassword, setShowPassword] = useState(false);

  // Cinematic fade-in on mount
  useEffect(() => {
    setLoaded(true);
  }, []);

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    if (!termsAccepted) {
      setErrorMsg("You must accept the Privacy Policy to enter the Arena.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to connect with ${provider}.`);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setErrorMsg("You must accept the Privacy Policy to enter the Arena.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      if (isSignUp) {
        if (!username.trim()) throw new Error("Username is required.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim(), gender: gender },
          },
        });
        if (error) throw error;

        // Auto-login
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      router.push("/");
      router.refresh();

    } catch (err: any) {
      setErrorMsg(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#090B10] p-4 font-sans text-white">
      {/* ================= Cinematic Background ================= */}
      <div className="absolute inset-0 z-0">
        <div className="pua-grid absolute inset-0 opacity-[0.05]" />

        {/* Duotone drifting glow orbs */}
        <div className="pua-orb-drift absolute left-1/2 top-1/2 h-[60vw] w-[60vw] max-h-[820px] max-w-[820px] min-h-[420px] min-w-[420px] bg-[radial-gradient(circle,rgba(43,255,176,0.07)_0%,transparent_70%)]" />
        <div className="pua-orb-drift-slow absolute left-[30%] top-[68%] h-[45vw] w-[45vw] max-h-[560px] max-w-[560px] min-h-[300px] min-w-[300px] bg-[radial-gradient(circle,rgba(255,92,62,0.06)_0%,transparent_70%)]" />

        {/* Scanline sweep */}
        <div className="pua-scanline pointer-events-none absolute inset-0 opacity-70" />

        {/* Vignette to keep edges dark and focus on the card */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_35%,rgba(2,3,6,0.75)_100%)]" />
      </div>

      <div
        className={`relative z-10 w-full max-w-[380px] transition-all duration-1000 ease-out sm:max-w-[420px] ${
          loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        {/* Glowing Container */}
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 p-6 shadow-[0_0_100px_rgba(43,255,176,0.06)] backdrop-blur-2xl sm:rounded-[2.5rem] sm:p-8">

          {/* Top / bottom edge glow */}
          <div className="absolute left-1/4 top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-[#2BFFB0] to-transparent opacity-50" />
          <div className="absolute bottom-0 left-1/4 h-px w-1/2 bg-gradient-to-r from-transparent via-[#FF5C3E] to-transparent opacity-30" />

          {/* HUD corner brackets */}
          <span className="pointer-events-none absolute left-3 top-3 h-4 w-4 rounded-tl-md border-l-2 border-t-2 border-[#2BFFB0]/40" />
          <span className="pointer-events-none absolute right-3 top-3 h-4 w-4 rounded-tr-md border-r-2 border-t-2 border-[#2BFFB0]/40" />
          <span className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 rounded-bl-md border-b-2 border-l-2 border-[#2BFFB0]/40" />
          <span className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 rounded-br-md border-b-2 border-r-2 border-[#2BFFB0]/40" />

          <header className="mb-8 text-center">
            <CrossfadeStack
              className="justify-items-center"
              activeKey={isSignUp ? "up" : "in"}
              items={[
                {
                  key: "up",
                  content: "INITIALIZE",
                  className:
                    "pua-display text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]",
                },
                {
                  key: "in",
                  content: "WELCOME BACK",
                  className:
                    "pua-display text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]",
                },
              ]}
            />
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.3em] text-[#2BFFB0]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2BFFB0] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#2BFFB0]" />
              </span>
              Encrypted Arena Gateway
            </p>
          </header>

          <div className="space-y-4">
            {/* High-End OAuth Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 py-3 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-xs font-bold text-white/80">Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuth('facebook')}
                className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/10 py-3 transition-all hover:-translate-y-0.5 hover:border-[#1877F2]/50 hover:bg-[#1877F2]/20"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                <svg className="h-5 w-5" fill="#1877F2" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span className="text-xs font-bold text-white/80">Facebook</span>
              </button>
            </div>

            <div className="flex items-center gap-3 py-2">
              <hr className="flex-grow border-white/10" />
              <span className="text-[9px] font-mono tracking-widest text-white/30">OR PROTOCOL</span>
              <hr className="flex-grow border-white/10" />
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
              {/* Sign-up-only fields — always mounted so the height/opacity
                  transition has something to animate; collapsed via the
                  grid-template-rows 0fr/1fr trick when signed-in mode is
                  active. required/tabIndex are gated on isSignUp so the
                  collapsed fields can't block submission or steal focus. */}
              <div
                className={`grid overflow-hidden transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isSignUp ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
                  <div className="group relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#2BFFB0]">
                      <UserIcon />
                    </span>
                    <input
                      type="text"
                      required={isSignUp}
                      tabIndex={isSignUp ? 0 : -1}
                      maxLength={16}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 font-mono text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-[#2BFFB0] focus:bg-black/80 focus:shadow-[0_0_0_3px_rgba(43,255,176,0.12),inset_0_1px_2px_rgba(0,0,0,0.4)]"
                      placeholder="CALLSIGN (USERNAME)"
                    />
                  </div>

                  <div className="relative flex gap-2 rounded-xl bg-white/5 p-1">
                    <div
                      className="absolute inset-y-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                      style={{
                        left: gender === "male" ? "4px" : "calc(50% + 0px)",
                        opacity: gender === "unspecified" ? 0 : 1,
                        backgroundColor:
                          gender === "male" ? "rgba(43,255,176,0.15)" : "rgba(255,92,62,0.15)",
                        boxShadow:
                          gender === "male"
                            ? "0 0 15px rgba(43,255,176,0.25)"
                            : "0 0 15px rgba(255,92,62,0.25)",
                      }}
                    />
                    <button
                      type="button"
                      tabIndex={isSignUp ? 0 : -1}
                      onClick={() => setGender("male")}
                      className={`relative z-10 flex-1 rounded-lg py-2.5 text-xs font-bold transition-colors ${
                        gender === "male" ? "text-[#2BFFB0]" : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      MALE
                    </button>
                    <button
                      type="button"
                      tabIndex={isSignUp ? 0 : -1}
                      onClick={() => setGender("female")}
                      className={`relative z-10 flex-1 rounded-lg py-2.5 text-xs font-bold transition-colors ${
                        gender === "female" ? "text-[#FF5C3E]" : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      FEMALE
                    </button>
                  </div>
                </div>
              </div>

              <div className="group relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#2BFFB0]">
                  <MailIcon />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 font-mono text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-[#2BFFB0] focus:bg-black/80 focus:shadow-[0_0_0_3px_rgba(43,255,176,0.12),inset_0_1px_2px_rgba(0,0,0,0.4)]"
                  placeholder="EMAIL ADDRESS"
                />
              </div>

              <div className="group relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#2BFFB0]">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-11 font-mono text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-[#2BFFB0] focus:bg-black/80 focus:shadow-[0_0_0_3px_rgba(43,255,176,0.12),inset_0_1px_2px_rgba(0,0,0,0.4)]"
                  placeholder="PASSWORD"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/70"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>

              {/* Privacy & Policy Verification */}
              <label className="group mt-2 flex cursor-pointer items-start gap-3">
                <div className="relative mt-0.5 flex items-center justify-center">
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div
                    className={`h-5 w-5 rounded-md border transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:border-white/40 ${
                      termsAccepted
                        ? "scale-110 border-[#2BFFB0] bg-[#2BFFB0]/20 shadow-[0_0_12px_rgba(43,255,176,0.5)]"
                        : "scale-100 border-white/20 bg-white/5"
                    }`}
                  />
                  <svg
                    className="pointer-events-none absolute h-3 w-3 text-[#2BFFB0]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline
                      points="20 6 9 17 4 12"
                      pathLength={1}
                      style={{
                        strokeDasharray: 1,
                        strokeDashoffset: termsAccepted ? 0 : 1,
                        transition: "stroke-dashoffset 320ms cubic-bezier(0.65,0,0.35,1) 40ms",
                      }}
                    />
                  </svg>
                </div>
                <span className="text-[10px] leading-relaxed text-white/50 transition-colors group-hover:text-white/70">
                  I agree to the <span className="text-white underline decoration-white/30 underline-offset-2">Terms of Service</span> and acknowledge that my camera feed is processed locally and never stored.
                </span>
              </label>

              {errorMsg && (
                <div className="pua-shake rounded-lg border border-[#FF5C3E]/30 bg-[#FF5C3E]/10 p-3 text-center">
                  <p className="text-[11px] font-bold text-[#FF5C3E]">
                    {errorMsg}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="pua-press group relative mt-2 grid w-full place-items-center overflow-hidden rounded-xl bg-gradient-to-r from-[#2BFFB0] to-[#25d99a] py-4 text-sm font-bold text-black shadow-[0_0_20px_rgba(43,255,176,0.2)] transition-all hover:shadow-[0_0_30px_rgba(43,255,176,0.4)] disabled:opacity-50"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                <CrossfadeStack
                  activeKey={loading ? "loading" : isSignUp ? "up" : "in"}
                  items={[
                    { key: "loading", content: "AUTHENTICATING..." },
                    { key: "up", content: "INITIALIZE PROFILE" },
                    { key: "in", content: "ENTER ARENA" },
                  ]}
                />
              </button>
            </form>

            <div className="mt-4 border-t border-white/10 pt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-[11px] font-bold uppercase tracking-wider text-white/40 transition-colors hover:text-white"
              >
                <CrossfadeStack
                  className="justify-items-center"
                  activeKey={isSignUp ? "up" : "in"}
                  items={[
                    { key: "up", content: "Already a member? Sign In" },
                    { key: "in", content: "New challenger? Create Profile" },
                  ]}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@500;700&display=swap');
        .pua-display { font-family: 'Bebas Neue', ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.05em; }
        .pua-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace; font-variant-numeric: tabular-nums; }
        .pua-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
          background-size: 40px 40px;
          animation: grid-pan 20s linear infinite;
        }
        @keyframes grid-pan {
          from { background-position: 0 0; }
          to { background-position: -40px -40px; }
        }
        .pua-orb-drift { animation: orb-drift 9s ease-in-out infinite alternate; }
        .pua-orb-drift-slow { animation: orb-drift 14s ease-in-out infinite alternate-reverse; }
        @keyframes orb-drift {
          0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); }
          100% { transform: translate(-50%, -50%) translate(24px, -18px) scale(1.06); }
        }
        .pua-scanline {
          background: linear-gradient(to bottom, transparent 0%, rgba(43,255,176,0.05) 50%, transparent 100%);
          background-size: 100% 220%;
          animation: scanline-sweep 7s linear infinite;
        }
        @keyframes scanline-sweep {
          0% { background-position: 0 -120%; }
          100% { background-position: 0 220%; }
        }
        .pua-shake { animation: shake 0.4s ease; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        .pua-press { transition: transform 0.1s ease; }
        .pua-press:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}