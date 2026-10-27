"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  NormalizedLandmark,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { supabase } from "@/lib/supabase";
import { getEloTier, ELO_BASE, type EloTierDef } from "@/lib/elo";
import Link from "next/link"; // <-- ADD THIS LINE

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const MATCH_DURATION_SECONDS = 60;
const DOWN_ANGLE_THRESHOLD = 90;
const UP_ANGLE_THRESHOLD = 160;
const VISIBILITY_THRESHOLD = 0.65;

const GAUGE_MIN_ANGLE = 30;
const GAUGE_MAX_ANGLE = 180;

const MILESTONE_INTERVAL = 5;
const MILESTONE_MESSAGES = [
  "Warming up",
  "On fire",
  "Unstoppable",
  "Beast mode",
  "Legendary",
] as const;

const COUNTDOWN_START = 3;
const COUNTDOWN_TICK_MS = 800;
const COUNTDOWN_GO_HOLD_MS = 550;

// Minimum time between two counted reps. Angle noise right at the 90°/160°
// boundary can occasionally cause the state machine to complete a second
// UP->DOWN->UP cycle within the same fraction of a second as the first —
// this refractory window treats anything faster than a plausible human rep
// as jitter rather than a second rep.
const MIN_REP_INTERVAL_MS = 250;

const LANDMARK = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const;

const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm";
const MODEL_ASSET_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const COLOR = {
  mint: "#2BFFB0",
  mintDim: "#15805A",
  coral: "#FF5C3E",
  coralDim: "#99311E",
  amber: "#FFC94D",
  danger: "#FF3B3B",
} as const;

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type CameraStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

type ModelStatus = "loading" | "ready" | "error";
type RepStage = "up" | "down";
type MatchPhase = "idle" | "countdown" | "active" | "finished";
type LoaderPhase = "visible" | "exiting" | "gone";

interface Point2D {
  x: number;
  y: number;
}

interface PlayerInfo {
  name: string;
  elo: number;
  avatarInitial: string;
  streak: number;
  season_badges: string[];
}

type Gender = "male" | "female" | "unspecified";

interface Profile {
  id: string;
  username: string;
  gender: Gender;
  elo: number;
  wins: number;
  losses: number;
  is_top10: boolean;
  current_streak: number;
  season_badges: string[];
}

type AuthStatus = "checking" | "signed-in" | "signed-out";

interface ComboFlash {
  id: number;
  text: string;
}

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function calculateAngle(a: Point2D, b: Point2D, c: Point2D): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return angle;
}

function averageFinite(values: Array<number | null>): number | null {
  const finite = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (finite.length === 0) return null;
  return finite.reduce((sum, v) => sum + v, 0) / finite.length;
}

function triggerHaptic(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silently ignore on unsupported platforms
  }
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export default function PushupTracker() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  const repStageRef = useRef<RepStage>("up");
  const baselineEstablishedRef = useRef<boolean>(false);
  const matchPhaseRef = useRef<MatchPhase>("idle");
  const scoreRef = useRef<number>(0);
  const trackingReadyRef = useRef<boolean>(false);
  const lastAngleUpdateRef = useRef<number>(0);
  const comboIdRef = useRef<number>(0);
  const particleIdRef = useRef<number>(0);
  const repSoundRef = useRef<HTMLAudioElement | null>(null);
  // Timestamp (performance.now()) of the last counted rep — see
  // MIN_REP_INTERVAL_MS above.
  const lastRepTimeRef = useRef<number>(0);
  const smoothedAngleRef = useRef<number | null>(null);
  // Mirrors currentUserId for the realtime/matchmaking callbacks below,
  // which read it outside of React's render cycle.
  const currentUserIdRef = useRef<string | null>(null);

useEffect(() => {
  repSoundRef.current = new Audio('/sounds/rep.mp3.wav'); 
}, []);
  // --- React UI State ---
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
  const [matchPhase, setMatchPhase] = useState<MatchPhase>("idle");
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [score, setScore] = useState<number>(0);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(MATCH_DURATION_SECONDS);
  const [pulse, setPulse] = useState<boolean>(false);
  const [milestoneFlash, setMilestoneFlash] = useState<boolean>(false);
  const [trackingReady, setTrackingReady] = useState<boolean>(false);
  const [displayAngle, setDisplayAngle] = useState<number | null>(null);
  const [comboFlash, setComboFlash] = useState<ComboFlash | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [loaderPhase, setLoaderPhase] = useState<LoaderPhase>("visible");

  // --- Multiplayer State ---
  const [matchId, setMatchId] = useState<string | null>(null);
  const [playerNum, setPlayerNum] = useState<number | null>(null);
  const [joinCode, setJoinCode] = useState<string>("");
  const [matchStatusText, setMatchStatusText] = useState<string>("");

  // --- Identity / ELO ---
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [youProfile, setYouProfile] = useState<Profile | null>(null);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<Profile | null>(null);

  // Real nameplate data — falls back to a neutral placeholder until the
  // corresponding profile row has loaded (base ELO, no tier claimed).
  const you: PlayerInfo = {
    name: youProfile?.username ?? "You",
    elo: youProfile?.elo ?? ELO_BASE,
    avatarInitial: (youProfile?.username?.[0] ?? "Y").toUpperCase(),
    streak: youProfile?.current_streak ?? 0,
    season_badges: youProfile?.season_badges ?? [], // <-- NEW
  };
  const opponent: PlayerInfo = {
    name: opponentProfile?.username ?? "Opponent",
    elo: opponentProfile?.elo ?? ELO_BASE,
    avatarInitial: (opponentProfile?.username?.[0] ?? "R").toUpperCase(),
    streak: opponentProfile?.current_streak ?? 0,
    season_badges: opponentProfile?.season_badges ?? [], // <-- NEW
  };
  const youTier: EloTierDef = getEloTier(you.elo, youProfile?.is_top10 ?? false, youProfile?.gender ?? "male");
  const opponentTier: EloTierDef = getEloTier(opponent.elo, opponentProfile?.is_top10 ?? false, opponentProfile?.gender ?? "male");
  
  useEffect(() => {
    matchPhaseRef.current = matchPhase;
  }, [matchPhase]);

  // ------------------------------------------------------------------
  // Identity — who is actually playing. Everything ELO-related depends
  // on this resolving to a real Supabase Auth user; without it, ranked
  // matchmaking stays disabled (see the lobby UI below).
  // ------------------------------------------------------------------
  const fetchProfile = useCallback(async (id: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, gender, elo, wins, losses, is_top10, current_streak, season_badges")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return data as Profile;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setAuthStatus("signed-out");
        return;
      }

      currentUserIdRef.current = user.id;
      setCurrentUserId(user.id);
      setAuthStatus("signed-in");

      const profile = await fetchProfile(user.id);
      if (!cancelled && profile) setYouProfile(profile);
    }

    void bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, [fetchProfile]);

  // Keep the opponent's profile (name/ELO/tier) in sync with whoever
  // opponentId currently points at.
  useEffect(() => {
    if (!opponentId) {
      setOpponentProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const profile = await fetchProfile(opponentId);
      if (!cancelled) setOpponentProfile(profile);
    })();
    return () => {
      cancelled = true;
    };
  }, [opponentId, fetchProfile]);

  // ------------------------------------------------------------------
  // Match Lifecycle Trigger
  // ------------------------------------------------------------------
  const triggerRoundStart = useCallback(() => {
    setScore(0);
    setOpponentScore(0);
    scoreRef.current = 0;
    setSecondsLeft(MATCH_DURATION_SECONDS);
    setParticles([]);
    setComboFlash(null);
    setMilestoneFlash(false);
    setCountdownValue(COUNTDOWN_START);
    setMatchPhase("countdown");
  }, []);

  // A finished `matches` row is permanently closed — finalize_match's
  // status guard means resubmitting scores against the same row would
  // just no-op forever. So "Rematch" after a ranked match doesn't
  // restart that row; it clears match/opponent state and drops back to
  // the lobby so the player finds or creates a fresh match.
  const handleRematch = useCallback(() => {
    setMatchId(null);
    setPlayerNum(null);
    setOpponentId(null);
    setOpponentProfile(null);
    setJoinCode("");
    setMatchStatusText("");
    setScore(0);
    setOpponentScore(0);
    scoreRef.current = 0;
    setSecondsLeft(MATCH_DURATION_SECONDS);
    setParticles([]);
    setComboFlash(null);
    setMilestoneFlash(false);
    setMatchPhase("idle");
  }, []);

  // ------------------------------------------------------------------
  // Supabase Multiplayer & Realtime Handlers
  // ------------------------------------------------------------------
  const createMatch = async () => {
    if (!currentUserId || !youProfile) return;

    const { data, error } = await supabase
      .from("matches")
      .insert([{ player1_id: currentUserId, host_elo: youProfile.elo, status: "waiting" }])
      .select()
      .single();

    if (error) {
      alert("Error creating match: " + error.message);
      return;
    }

    if (data) {
      setMatchId(data.id);
      setPlayerNum(1);
      setMatchStatusText("Match Created! Share the Lobby ID with Player 2.");
    }
  };

  const joinMatch = async () => {
    if (!joinCode.trim() || !currentUserId) return;

    const { data, error } = await supabase
      .from("matches")
      .update({ player2_id: currentUserId, status: "active" })
      .eq("id", joinCode.trim())
      .select()
      .single();

    if (error || !data) {
      alert("Could not join lobby. Double-check the code.");
      return;
    }

    setMatchId(data.id);
    setPlayerNum(2);
    setOpponentId(data.player1_id);
    setMatchStatusText("Connected as Player 2!");
    triggerRoundStart();
  };

  const findRandomMatch = async () => {
    if (!currentUserId || !youProfile) return;
    setMatchStatusText("Scanning queue for the closest-ELO opponent...");

    // Closest-ELO pairing, done as a locking RPC so two players hitting
    // "Find Random Match" at the same instant can't both claim the same
    // waiting lobby (see find_closest_waiting_match in the migration).
    const { data: foundMatchId, error: rpcError } = await supabase.rpc(
      "find_closest_waiting_match",
      { p_user_id: currentUserId, p_elo: youProfile.elo }
    );

    if (rpcError) {
      setMatchStatusText("Matchmaking error — please try again.");
      return;
    }

    if (foundMatchId) {
      const { data } = await supabase
        .from("matches")
        .update({ player2_id: currentUserId, status: "active" })
        .eq("id", foundMatchId)
        .select()
        .single();

      if (data) {
        setMatchId(data.id);
        setPlayerNum(2);
        setOpponentId(data.player1_id);
        setMatchStatusText("Match Found! Starting...");
        triggerRoundStart();
      }
    } else {
      const { data } = await supabase
        .from("matches")
        .insert([{ player1_id: currentUserId, host_elo: youProfile.elo, status: "waiting" }])



        
        .select()
        .single();

      if (data) {
        setMatchId(data.id);
        setPlayerNum(1);
        setMatchStatusText("Searching for a worthy rival in your ELO bracket...");
      }
    }
  };

  // Real-time synchronization
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const updated = payload.new;

          // If Host is waiting and Player 2 connects, start round
          if (playerNum === 1 && updated.status === "active" && matchPhaseRef.current === "idle") {
            setMatchStatusText("Opponent joined! Get ready.");
            if (updated.player2_id) setOpponentId(updated.player2_id);
            triggerRoundStart();
          }

          // Sync incoming score
          if (playerNum === 1) {
            setOpponentScore(updated.player2_score ?? 0);
          } else if (playerNum === 2) {
            setOpponentScore(updated.player1_score ?? 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, playerNum, triggerRoundStart]);

  // Broadcast score updates to database
  useEffect(() => {
    if (!matchId || !playerNum || score === 0) return;

    const pushScore = async () => {
      const col = playerNum === 1 ? "player1_score" : "player2_score";
      await supabase.from("matches").update({ [col]: score }).eq("id", matchId);
    };

    void pushScore();
  }, [score, matchId, playerNum]);

  // ------------------------------------------------------------------
  // MediaPipe Vision Initialization
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function initModel() {
      try {
        setModelStatus("loading");
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        poseLandmarkerRef.current = landmarker;
        setModelStatus("ready");
      } catch (err) {
        console.error("PoseLandmarker init failed:", err);
        if (!cancelled) setModelStatus("error");
      }
    }

    void initModel();

    return () => {
      cancelled = true;
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------
  // Camera Setup
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function initCamera() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("unsupported");
        return;
      }

      setCameraStatus("requesting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: false,
        });

        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraStatus("granted");
      } catch (err) {
        console.error("Camera setup failed:", err);
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setCameraStatus("denied");
        } else {
          setCameraStatus("error");
        }
      }
    }

    void initCamera();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  // ------------------------------------------------------------------
  // CV Heuristic & Rep Processing
  // ------------------------------------------------------------------
  const processPushupPhase = useCallback((landmarks: NormalizedLandmark[]) => {
    const ls = landmarks[LANDMARK.LEFT_SHOULDER];
    const le = landmarks[LANDMARK.LEFT_ELBOW];
    const lw = landmarks[LANDMARK.LEFT_WRIST];
    const rs = landmarks[LANDMARK.RIGHT_SHOULDER];
    const re = landmarks[LANDMARK.RIGHT_ELBOW];
    const rw = landmarks[LANDMARK.RIGHT_WRIST];

    const markUntrackable = () => {
      if (trackingReadyRef.current) {
        trackingReadyRef.current = false;
        setTrackingReady(false);
      }
    };

    const requiredLandmarks = [ls, le, lw, rs, re, rw];
    const allRequiredVisible = requiredLandmarks.every(
      (lm) => lm !== undefined && lm.visibility >= VISIBILITY_THRESHOLD
    );
    if (!allRequiredVisible || !ls || !le || !lw || !rs || !re || !rw) {
      markUntrackable();
      return;
    }

    const wristsBelowShoulders = lw.y > ls.y && rw.y > rs.y;
    if (!wristsBelowShoulders) {
      markUntrackable();
      return;
    }

    const leftAngle = calculateAngle(ls, le, lw);
    const rightAngle = calculateAngle(rs, re, rw);
    const rawAngle = averageFinite([leftAngle, rightAngle]);
    if (rawAngle === null) {
      markUntrackable();
      return;
    }

    // ==========================================
    // AI EXTREME SPEED FILTER (EMA)
    // 60% immediate response, 40% noise cancellation
    // ==========================================
    if (smoothedAngleRef.current === null) {
      smoothedAngleRef.current = rawAngle;
    } else {
      smoothedAngleRef.current = (0.6 * rawAngle) + (0.4 * smoothedAngleRef.current); 
    }
    const elbowAngle = smoothedAngleRef.current;

    if (!trackingReadyRef.current) {
      trackingReadyRef.current = true;
      setTrackingReady(true);
    }

    const now = performance.now();
    if (now - lastAngleUpdateRef.current > 80) {
      lastAngleUpdateRef.current = now;
      setDisplayAngle(elbowAngle);
    }

    if (matchPhaseRef.current !== "active") return;

    const isDown = elbowAngle < DOWN_ANGLE_THRESHOLD;
    const isUp = elbowAngle > UP_ANGLE_THRESHOLD;

    if (!baselineEstablishedRef.current) {
      if (isUp) {
        baselineEstablishedRef.current = true;
        repStageRef.current = "up";
      }
      return;
    }

    if (isDown && repStageRef.current === "up") {
      repStageRef.current = "down";
    } else if (isUp && repStageRef.current === "down") {
      // Debounce: if the last counted rep was too recent, this UP->DOWN->UP
      // cycle is almost certainly angle jitter at the threshold boundary
      // rather than a second genuine rep. Close the state machine's cycle
      // (so it doesn't get stuck waiting in "down") without scoring it.
      if (now - lastRepTimeRef.current < MIN_REP_INTERVAL_MS) {
        repStageRef.current = "up";
        return;
      }
      lastRepTimeRef.current = now;
      repStageRef.current = "up";

      scoreRef.current += 1;
      const next = scoreRef.current;
      setScore(next);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 260);
      triggerHaptic(15);

      if (repSoundRef.current) {
     repSoundRef.current.currentTime = 0; 
     repSoundRef.current.play().catch(() => {});
   }
      if (next % MILESTONE_INTERVAL === 0) {
        const tier = Math.min(
          Math.floor(next / MILESTONE_INTERVAL) - 1,
          MILESTONE_MESSAGES.length - 1
        );
        comboIdRef.current += 1;
        setComboFlash({ id: comboIdRef.current, text: `${next}! ${MILESTONE_MESSAGES[tier]}` });
        setMilestoneFlash(true);
        window.setTimeout(() => setMilestoneFlash(false), 500);
        triggerHaptic([15, 60, 15, 60, 40]);

        const colors = [COLOR.mint, COLOR.amber, COLOR.coral];
        const burst: Particle[] = Array.from({ length: 14 }, () => {
          particleIdRef.current += 1;
          return {
            id: particleIdRef.current,
            angle: Math.random() * Math.PI * 2,
            distance: 40 + Math.random() * 60,
            color: colors[Math.floor(Math.random() * colors.length)],
          };
        });
        setParticles((prev) => [...prev, ...burst]);
        window.setTimeout(() => {
          setParticles((prev) => prev.filter((p) => !burst.some((b) => b.id === p.id)));
        }, 900);
      }
    }
  }, []);

  // ------------------------------------------------------------------
  // Canvas Render Loop
  // ------------------------------------------------------------------
  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = poseLandmarkerRef.current;

    if (!video || !canvas || !landmarker || video.readyState < 2) {
      rafIdRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    if (!canvasCtxRef.current) {
      canvasCtxRef.current = canvas.getContext("2d");
    }
    const ctx = canvasCtxRef.current;
    if (!ctx) {
      rafIdRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    if (!drawingUtilsRef.current) {
      drawingUtilsRef.current = new DrawingUtils(ctx);
    }
    const drawingUtils = drawingUtilsRef.current;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || canvas.width;
      canvas.height = video.videoHeight || canvas.height;
    }

    const currentTime = video.currentTime;
    if (currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = currentTime;

      const nowMs = performance.now();
      landmarker.detectForVideo(video, nowMs, (result: PoseLandmarkerResult) => {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        for (const landmarks of result.landmarks) {
          ctx.save();
          ctx.shadowColor = COLOR.mint;
          ctx.shadowBlur = 10;
          drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
            color: COLOR.mint,
            lineWidth: 4,
          });
          drawingUtils.drawLandmarks(landmarks, {
            radius: 5,
            color: COLOR.mint,
            fillColor: COLOR.mint,
          });
          ctx.restore();

          drawingUtils.drawLandmarks(landmarks, {
            radius: 2,
            color: "#ffffff",
            fillColor: "#ffffff",
          });

          processPushupPhase(landmarks);
        }
        ctx.restore();
      });
    }

    rafIdRef.current = requestAnimationFrame(renderLoop);
  }, [processPushupPhase]);

  useEffect(() => {
    if (cameraStatus !== "granted" || modelStatus !== "ready") return;

    rafIdRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [cameraStatus, modelStatus, renderLoop]);

  // ------------------------------------------------------------------
  // Countdown Logic
  // ------------------------------------------------------------------
  useEffect(() => {
    if (matchPhase !== "countdown" || countdownValue === null) return;

    if (countdownValue <= 0) {
      const t = window.setTimeout(() => {
        baselineEstablishedRef.current = false;
        repStageRef.current = "up";
        scoreRef.current = 0;
        setCountdownValue(null);
        setMatchPhase("active");
      }, COUNTDOWN_GO_HOLD_MS);
      return () => window.clearTimeout(t);
    }

    triggerHaptic(25);
    const t = window.setTimeout(() => {
      setCountdownValue((v) => (v === null ? null : v - 1));
    }, COUNTDOWN_TICK_MS);
    return () => window.clearTimeout(t);
  }, [matchPhase, countdownValue]);

  // ------------------------------------------------------------------
  // Match Clock Logic. One interval per "active" phase rather than one
  // recreated every tick — cheaper on the main thread, same behavior.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (matchPhase !== "active") return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [matchPhase]);

  useEffect(() => {
    if (matchPhase === "active" && secondsLeft === 0) {
      setMatchPhase("finished");
      triggerHaptic([40, 80, 40, 80, 120]);

      // Resolve ELO server-side. Both players' clocks hit zero
      // independently, so both clients call this — finalize_match is
      // idempotent (see the migration), so whichever call lands first
      // applies the ELO delta and the other is a safe no-op.
      if (matchId) {
        void supabase.rpc("finalize_match", { p_match_id: matchId }).then(async () => {
          if (currentUserIdRef.current) {
            const mine = await fetchProfile(currentUserIdRef.current);
            if (mine) setYouProfile(mine);
          }
          if (opponentId) {
            const theirs = await fetchProfile(opponentId);
            if (theirs) setOpponentProfile(theirs);
          }
        });
      }
    }
  }, [matchPhase, secondsLeft, matchId, opponentId, fetchProfile]);

  useEffect(() => {
    if (!comboFlash) return;
    const t = window.setTimeout(() => setComboFlash(null), 1300);
    return () => window.clearTimeout(t);
  }, [comboFlash]);

  // ------------------------------------------------------------------
  // Loader Transitions
  // ------------------------------------------------------------------
  const loadingDone = cameraStatus === "granted" && modelStatus === "ready";

  useEffect(() => {
    if (loadingDone && loaderPhase === "visible") {
      const t = window.setTimeout(() => setLoaderPhase("exiting"), 550);
      return () => window.clearTimeout(t);
    }
  }, [loadingDone, loaderPhase]);

  useEffect(() => {
    if (loaderPhase === "exiting") {
      const t = window.setTimeout(() => setLoaderPhase("gone"), 500);
      return () => window.clearTimeout(t);
    }
  }, [loaderPhase]);

  // ------------------------------------------------------------------
  // Derived HUD Values
  // ------------------------------------------------------------------
  const totalReps = score + opponentScore;
  const youPct = totalReps === 0 ? 50 : Math.round((score / totalReps) * 100);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#090B10] p-4 font-sans">
      <div className={`relative w-full max-w-sm aspect-[9/16] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_0_80px_rgba(43,255,176,0.10)] transition-all duration-700 ${
        you.streak >= 5 ? 'aura-lightning' : you.streak >= 3 ? 'aura-flame' : ''
      }`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <video
          ref={videoRef}
          className="absolute inset-0 -z-10 h-full w-full opacity-0"
          playsInline
          muted
          aria-hidden="true"
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />

        {/* ================= HUD ================= */}
        <div className="absolute inset-0 flex flex-col justify-between p-3">
          <div className="flex items-start justify-between">
            <PlayerBadge player={you} tier={youTier} align="left" accent="mint" />
            <PlayerBadge player={opponent} tier={opponentTier} align="right" accent="coral" />
          </div>

          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
            <TimerBadge
              label={timerLabel}
              urgent={matchPhase === "active" && secondsLeft <= 10}
              live={matchPhase === "active"}
            />
          </div>

          <div className="mt-16">
            <DualProgressBar youPct={youPct} />
          </div>

          <div className="flex-1" />

          {/* Center Form Ring */}
          <div className="flex flex-col items-center gap-2 pb-1">
            <RepGaugeRing
              score={score}
              pulse={pulse}
              milestoneFlash={milestoneFlash}
              displayAngle={displayAngle}
              trackingReady={trackingReady}
              showHint={loadingDone && matchPhase !== "finished"}
            />

            {/* Matchmaking Lobby Overlay */}
            {matchPhase === "idle" && (
              <div className="w-full max-w-[280px] rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur-md flex flex-col gap-2">
                {authStatus === "checking" ? (
                  <p className="py-2 text-center text-[11px] text-white/50">Checking your session…</p>
                ) : authStatus === "signed-out" ? (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <p className="text-center text-[11px] text-white/60">
                      Sign in to unlock ranked matchmaking and claim your ELO tier.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.location.href = '/login'}
                      className="pua-press w-full rounded-lg bg-white/10 border border-white/20 py-2 text-xs font-bold text-white hover:bg-white/20 transition-all"
                    >
                      Login / Sign Up
                    </button>
                  </div>
                ) : !matchId ? (
                  <>
                    <button
                      type="button"
                      onClick={findRandomMatch}
                      disabled={!loadingDone || !youProfile}
                      className="pua-press w-full rounded-lg bg-gradient-to-r from-[#2BFFB0] to-[#25d99a] py-2 text-xs font-bold text-black shadow-[0_0_15px_rgba(43,255,176,0.3)] disabled:opacity-30"
                    >
                      Find Random Match
                    </button>

                    <div className="flex items-center gap-2">
                      <hr className="flex-grow border-white/10" />
                      <span className="text-[9px] tracking-widest text-white/40 font-mono">OR PRIVATE</span>
                      <hr className="flex-grow border-white/10" />
                    </div>

                    <button
                      type="button"
                      onClick={createMatch}
                      disabled={!loadingDone || !youProfile}
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 transition-colors"
                    >
                      Create Code
                    </button>

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Lobby Code"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white outline-none focus:border-[#2BFFB0] font-mono"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={joinMatch}
                        disabled={!youProfile}
                        className="rounded-lg bg-[#FF5C3E] px-3 py-1 text-xs font-bold text-white hover:bg-red-500 transition-colors disabled:opacity-30"
                      >
                        Join
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-1">
                    <p className="text-[11px] font-bold text-[#2BFFB0] animate-pulse">Lobby Active</p>
                    <p className="text-[9px] font-mono text-white/60 truncate my-0.5">ID: {matchId}</p>
                    <p className="text-[10px] text-white/80">You are Player {playerNum}</p>
                  </div>
                )}

                {matchStatusText && (
                  <p className="text-[9px] text-center text-amber-300/80 font-mono">{matchStatusText}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ================= Overlays ================= */}
        <CountdownOverlay value={countdownValue} />
        <MatchEndOverlay
          visible={matchPhase === "finished"}
          score={score}
          opponentScore={opponentScore}
          onRematch={handleRematch}
          canRematch={loadingDone && authStatus === "signed-in"}
        />
        <ParticleBurst particles={particles} />
        <ComboPopup flash={comboFlash} />
        <LoadingScreen
          cameraStatus={cameraStatus}
          modelStatus={modelStatus}
          visible={loaderPhase !== "gone"}
          fading={loaderPhase === "exiting"}
        />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@500;700&display=swap');
        .pua-display { font-family: 'Bebas Neue', ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.02em; }
        .pua-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace; font-variant-numeric: tabular-nums; }
        .pua-grid {
          background-image:
            linear-gradient(rgba(43,255,176,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(43,255,176,0.5) 1px, transparent 1px);
          background-size: 34px 34px;
          animation: pua-grid-pan 18s linear infinite;
        }
        @keyframes pua-grid-pan {
          from { background-position: 0 0; }
          to { background-position: 34px 34px; }
        }
        .pua-logo-path {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation: pua-draw 1.1s ease-out forwards, pua-logo-glow 2.4s ease-in-out 1.1s infinite;
        }
        @keyframes pua-draw { to { stroke-dashoffset: 0; } }
        @keyframes pua-logo-glow {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(43,255,176,0.4)); }
          50% { filter: drop-shadow(0 0 10px rgba(43,255,176,0.75)); }
        }
        .pua-rise { animation: pua-rise-fade 0.6s ease-out both; }
        @keyframes pua-rise-fade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pua-shimmer { position: relative; overflow: hidden; }
        .pua-shimmer::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.5) 50%, transparent 80%);
          animation: pua-shimmer-sweep 1.8s ease-in-out infinite;
        }
        @keyframes pua-shimmer-sweep {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
        .pua-spin { animation: pua-spin 0.9s linear infinite; }
        @keyframes pua-spin { to { transform: rotate(360deg); } }
        .pua-countdown {
          display: inline-block;
          animation: pua-countdown-pop 0.8s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
        }
        @keyframes pua-countdown-pop {
          0% { opacity: 0; transform: scale(0.4); }
          35% { opacity: 1; transform: scale(1.12); }
          60% { transform: scale(0.96); }
          100% { opacity: 0; transform: scale(1.02); }
        }
        .pua-combo { animation: pua-combo-pop 1.2s ease-out forwards; }
        @keyframes pua-combo-pop {
          0% { opacity: 0; transform: translate(-50%, 10px) scale(0.85); }
          15% { opacity: 1; transform: translate(-50%, 0) scale(1.05); }
          30% { transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -26px) scale(1); }
        }
        .pua-particle { animation: pua-particle-fly 0.9s ease-out forwards; }
        @keyframes pua-particle-fly {
          0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0); }
          100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--pua-tx), var(--pua-ty)); }
        }
        .pua-live { animation: pua-live-pulse 1.6s ease-in-out infinite; }
        @keyframes pua-live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        .pua-timer-urgent { animation: pua-timer-shake 0.5s ease-in-out infinite; }
        @keyframes pua-timer-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-1px); }
          75% { transform: translateX(1px); }
        }
        .pua-press { transition: transform 0.15s ease; }
        .pua-press:active { transform: scale(0.95); }
        /* ================= AURA ENGINE ================= */
        .aura-flame {
          box-shadow: 0 0 30px rgba(0, 229, 255, 0.4), inset 0 0 20px rgba(0, 229, 255, 0.3) !important;
          border-color: rgba(0, 229, 255, 0.8) !important;
          animation: aura-breathe 2s ease-in-out infinite alternate;
        }
        @keyframes aura-breathe {
          0% { box-shadow: 0 0 20px rgba(0, 229, 255, 0.3), inset 0 0 10px rgba(0, 229, 255, 0.2); }
          100% { box-shadow: 0 0 50px rgba(0, 229, 255, 0.6), inset 0 0 30px rgba(0, 229, 255, 0.4); }
        }
        
        .aura-lightning {
          box-shadow: 0 0 40px rgba(217, 66, 255, 0.5), inset 0 0 30px rgba(217, 66, 255, 0.4) !important;
          border-color: rgba(217, 66, 255, 0.9) !important;
          animation: aura-strike 1.5s infinite;
        }
        @keyframes aura-strike {
          0%, 100% { box-shadow: 0 0 30px rgba(217, 66, 255, 0.4), inset 0 0 20px rgba(217, 66, 255, 0.3); }
          45% { box-shadow: 0 0 60px rgba(217, 66, 255, 0.6), inset 0 0 40px rgba(217, 66, 255, 0.5); }
          50% { box-shadow: 0 0 100px #fff, inset 0 0 60px #fff; border-color: #fff !important; } /* Lightning Strike */
          55% { box-shadow: 0 0 40px rgba(217, 66, 255, 0.5), inset 0 0 30px rgba(217, 66, 255, 0.4); }
        }
      `}</style>
    </div>
  );
}

// ------------------------------------------------------------------
// Subcomponents
// ------------------------------------------------------------------

function PlayerBadge({
  player,
  tier,
  align,
  accent,
}: {
  player: PlayerInfo;
  tier: EloTierDef;
  align: "left" | "right";
  accent: "mint" | "coral";
}) {
  const color = accent === "mint" ? COLOR.mint : COLOR.coral;
  const isLightning = player.streak >= 5;
  const isFlame = player.streak >= 3 && player.streak < 5;
  const hasLegacy = player.season_badges.length > 0;

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border bg-black/70 px-2.5 py-1.5 backdrop-blur-md transition-all ${
        align === "right" ? "flex-row-reverse text-right" : ""
      } ${isLightning ? "aura-lightning" : isFlame ? "aura-flame" : ""}`}
      style={{ borderColor: `${color}55` }}
    >
      <div
        className="pua-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-lg relative"
        style={{ backgroundColor: `${color}22`, color }}
      >
        {player.avatarInitial}
        {hasLegacy && (
          <div className="absolute -top-1.5 -right-1.5 flex h-4 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE066] to-[#F59E0B] px-1 shadow-[0_0_8px_rgba(245,158,11,0.6)]">
             <span className="text-[8px] font-black text-black">⭐{player.season_badges.length}</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex flex-col justify-center">
        <div className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
          <p className="truncate text-xs font-bold text-white/95">{player.name}</p>
          {isLightning && <span className="text-xs drop-shadow-[0_0_8px_#d942ff] animate-pulse">⚡{player.streak}</span>}
          {isFlame && <span className="text-xs drop-shadow-[0_0_8px_#00e5ff]">🔥{player.streak}</span>}
        </div>
        <div className={`flex items-center gap-1.5 mt-0.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
          <p className="pua-mono text-[9px] font-black uppercase tracking-widest" style={{ color: tier.color }}>
            {tier.label}
          </p>
          <span className="text-white/20 text-[8px]">|</span>
          <p className="pua-mono text-[9px] text-white/60">{player.elo}</p>
        </div>
      </div>
    </div>
  );
}

function TimerBadge({
  label,
  urgent,
  live,
}: {
  label: string;
  urgent: boolean;
  live: boolean;
}) {
  const color = urgent ? COLOR.danger : COLOR.amber;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-14 min-w-[92px] items-center justify-center border px-4 ${
          urgent ? "pua-timer-urgent" : ""
        }`}
        style={{
          clipPath: "polygon(12% 0, 100% 0, 88% 100%, 0 100%)",
          backgroundColor: "rgba(0,0,0,0.55)",
          borderColor: `${color}66`,
        }}
      >
        <span
          className="pua-mono text-3xl font-bold"
          style={{ color, textShadow: `0 0 18px ${color}aa` }}
        >
          {label}
        </span>
      </div>
      {live && (
        <span className="pua-live flex items-center gap-1 text-[9px] font-bold tracking-widest text-[#FF5C3E]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5C3E]" />
          LIVE
        </span>
      )}
    </div>
  );
}

function DualProgressBar({ youPct }: { youPct: number }) {
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/8">
      <div className="absolute inset-0 flex">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${youPct}%`,
            background: `linear-gradient(90deg, ${COLOR.mintDim}, ${COLOR.mint})`,
          }}
        />
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${100 - youPct}%`,
            background: `linear-gradient(90deg, ${COLOR.coral}, ${COLOR.coralDim})`,
          }}
        />
      </div>
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/25" />
    </div>
  );
}

function RepGaugeRing({
  score,
  pulse,
  milestoneFlash,
  displayAngle,
  trackingReady,
  showHint,
}: {
  score: number;
  pulse: boolean;
  milestoneFlash: boolean;
  displayAngle: number | null;
  trackingReady: boolean;
  showHint: boolean;
}) {
  const milestoneProgress =
    ((score % MILESTONE_INTERVAL) || (score > 0 ? MILESTONE_INTERVAL : 0)) /
    MILESTONE_INTERVAL;

  const angleFrac =
    displayAngle === null
      ? null
      : Math.min(
          1,
          Math.max(0, (displayAngle - GAUGE_MIN_ANGLE) / (GAUGE_MAX_ANGLE - GAUGE_MIN_ANGLE))
        );
  const angleColor =
    displayAngle === null
      ? "rgba(255,255,255,0.15)"
      : displayAngle < DOWN_ANGLE_THRESHOLD
      ? COLOR.coral
      : displayAngle > UP_ANGLE_THRESHOLD
      ? COLOR.mint
      : COLOR.amber;

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg viewBox="0 0 128 128" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="64" cy="64" r="60" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} pathLength={1} />
        <circle
          cx="64"
          cy="64"
          r="60"
          fill="none"
          stroke={angleColor}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${angleFrac ?? 0} 1`}
          className="transition-[stroke-dasharray,stroke] duration-150 ease-out"
        />
        <circle cx="64" cy="64" r="48" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} pathLength={1} />
        <circle
          cx="64"
          cy="64"
          r="48"
          fill="none"
          stroke={COLOR.mint}
          strokeWidth={7}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${milestoneProgress} 1`}
          className="transition-[stroke-dasharray] duration-300 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${COLOR.mint}aa)` }}
        />
      </svg>

      <div
        className={`flex h-[76px] w-[76px] items-center justify-center rounded-full bg-black/70 backdrop-blur-sm transition-transform duration-200 ${
          pulse ? "scale-110" : "scale-100"
        }`}
      >
        <span
          className={`pua-mono text-3xl font-bold transition-colors duration-200 ${
            milestoneFlash ? "text-[#FFC94D]" : "text-white"
          }`}
        >
          {score}
        </span>
      </div>

      {showHint && !trackingReady && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-2 py-0.5 text-[8px] font-semibold text-white/60">
          Center yourself in frame
        </div>
      )}
    </div>
  );
}

function CountdownOverlay({ value }: { value: number | null }) {
  if (value === null) return null;
  const label = value > 0 ? String(value) : "GO!";

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      aria-live="assertive"
    >
      <span
        key={label}
        className="pua-display pua-countdown text-white drop-shadow-[0_0_30px_rgba(43,255,176,0.55)]"
        style={{ fontSize: value > 0 ? "7rem" : "5rem" }}
      >
        {label}
      </span>
    </div>
  );
}

function MatchEndOverlay({
  visible,
  score,
  opponentScore,
  onRematch,
  canRematch,
}: {
  visible: boolean;
  score: number;
  opponentScore: number;
  onRematch: () => void;
  canRematch: boolean;
}) {
  if (!visible) return null;

  const outcome = score > opponentScore ? "win" : score < opponentScore ? "loss" : "draw";
  const headline = outcome === "win" ? "You win" : outcome === "loss" ? "Rival wins" : "Draw";
  const headlineColor =
    outcome === "win" ? COLOR.mint : outcome === "loss" ? COLOR.coral : COLOR.amber;
  const pace = (score / (MATCH_DURATION_SECONDS / 60)).toFixed(1);
  const milestones = Math.floor(score / MILESTONE_INTERVAL);

  return (
    <div
      className="pua-rise absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-[#090B10]/95 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <p className="pua-display text-4xl" style={{ color: headlineColor }}>
        {headline}
      </p>

      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="pua-mono text-4xl font-bold" style={{ color: COLOR.mint }}>
            {score}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-white/50">You</p>
        </div>
        <div className="h-10 w-px bg-white/15" />
        <div className="text-center">
          <p className="pua-mono text-4xl font-bold" style={{ color: COLOR.coral }}>
            {opponentScore}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-white/50">Rival</p>
        </div>
      </div>

      <div className="flex gap-8 text-center">
        <div>
          <p className="pua-mono text-lg font-bold text-white/90">{pace}</p>
          <p className="text-[10px] text-white/40">reps / min</p>
        </div>
        <div>
          <p className="pua-mono text-lg font-bold text-white/90">{milestones}</p>
          <p className="text-[10px] text-white/40">milestones</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRematch}
        disabled={!canRematch}
        className="pua-press rounded-full bg-gradient-to-r from-[#2BFFB0] to-[#25d99a] px-8 py-3 text-sm font-bold text-black shadow-[0_0_30px_rgba(43,255,176,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2BFFB0] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
      >
        Find New Match
      </button>
    </div>
  );
}

function ComboPopup({ flash }: { flash: ComboFlash | null }) {
  if (!flash) return null;
  return (
    <div
      key={flash.id}
      className="pua-combo pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2"
    >
      <span className="pua-display text-2xl text-[#FFC94D] drop-shadow-[0_0_14px_rgba(255,201,77,0.6)]">
        {flash.text}
      </span>
    </div>
  );
}

function ParticleBurst({ particles }: { particles: Particle[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="pua-particle absolute left-1/2 top-[70%] h-1.5 w-1.5 rounded-full"
          style={
            {
              backgroundColor: p.color,
              "--pua-tx": `${Math.cos(p.angle) * p.distance}px`,
              "--pua-ty": `${Math.sin(p.angle) * p.distance}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function StepIcon({ done, error }: { done: boolean; error: boolean }) {
  if (error) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5C3E]/15 text-[#FF5C3E]">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  if (done) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2BFFB0]/15 text-[#2BFFB0]">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
      <div className="pua-spin h-4 w-4 rounded-full border-2 border-white/15 border-t-[#2BFFB0]" />
    </div>
  );
}

function LoadingScreen({
  cameraStatus,
  modelStatus,
  visible,
  fading,
}: {
  cameraStatus: CameraStatus;
  modelStatus: ModelStatus;
  visible: boolean;
  fading: boolean;

}) {
  if (!visible) return null;

  const cameraError =
    cameraStatus === "denied" || cameraStatus === "unsupported" || cameraStatus === "error";
  const modelError = modelStatus === "error";
  const hasError = cameraError || modelError;

  const cameraDetail =
    cameraStatus === "granted"
      ? "Camera connected"
      : cameraStatus === "denied"
      ? "Access denied — allow it in browser settings."
      : cameraStatus === "unsupported"
      ? "Camera unsupported."
      : cameraStatus === "error"
      ? "Check camera connection."
      : "Waiting for camera...";

  const modelDetail =
    modelStatus === "ready"
      ? "Pose model loaded"
      : modelStatus === "error"
      ? "Couldn't load model."
      : "Downloading weights...";

  const steps = [
    { label: "Camera link", done: cameraStatus === "granted", error: cameraError, detail: cameraDetail },
    { label: "AI pose model", done: modelStatus === "ready", error: modelError, detail: modelDetail },
  ];

  const completed = steps.filter((s) => s.done).length;
  const progressPct = hasError
    ? (completed / steps.length) * 100
    : completed === steps.length
    ? 100
    : ((completed + 0.15) / steps.length) * 100;

  return (
    <div
      className={`absolute inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-[#090B10] px-8 transition-all duration-500 ease-out ${
        fading ? "pointer-events-none scale-[1.03] opacity-0" : "opacity-100"
      }`}
    >
      <div className="pua-grid pointer-events-none absolute inset-0 opacity-[0.07]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(43,255,176,0.16),transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-4">
        <svg viewBox="0 0 96 96" className="h-20 w-20" fill="none">
          <polygon
            points="48,6 86,27 86,69 48,90 10,69 10,27"
            stroke="url(#pua-logo-grad)"
            strokeWidth={3}
            className="pua-logo-path"
          />
          <path
            d="M30 58 L44 34 L54 50 L66 30"
            stroke="url(#pua-logo-grad)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pua-logo-path"
            style={{ animationDelay: "0.25s" }}
          />
          <defs>
            <linearGradient id="pua-logo-grad" x1="0" y1="0" x2="96" y2="96">
              <stop offset="0%" stopColor={COLOR.mint} />
              <stop offset="100%" stopColor={COLOR.coral} />
            </linearGradient>
          </defs>
        </svg>

        <div className="pua-rise text-center">
          <p className="pua-display bg-gradient-to-r from-[#2BFFB0] to-[#FF5C3E] bg-clip-text text-3xl text-transparent">
            Push-Up Arena
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            Real-time 1-vs-1 push-up tracking, powered by your camera.
          </p>
        </div>
      </div>

      <div className="pua-rise w-full max-w-[240px] space-y-3" role="status" aria-live="polite">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3">
            <StepIcon done={step.done} error={step.error} />
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold ${step.error ? "text-[#FF5C3E]" : "text-white/90"}`}>
                {step.label}
              </p>
              <p className="truncate text-[10px] text-white/40">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pua-rise w-full max-w-[240px]">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="pua-shimmer h-full rounded-full bg-gradient-to-r from-[#2BFFB0] to-[#FF5C3E] transition-[width] duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {hasError && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="pua-press mt-4 w-full rounded-full border border-white/15 bg-white/5 py-2 text-xs font-bold text-white/90 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2BFFB0]"
          >
            Reload &amp; try again
          </button>
        )}
      </div>
    </div>
  );
}