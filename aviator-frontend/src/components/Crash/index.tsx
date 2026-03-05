/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState, useCallback } from "react";
import "./crash.scss";
import Context from "../../context";

// ─── Local Assets ────────────────────────────────────────────────────────────
import bgSun from "../../assets/images/bg-sun.svg";
import planeImg from "../../assets/images/plane-0.svg";
import propImg from "../../assets/images/prop.svg";
import blurImg from "../../assets/images/blur.svg";

// ─── Local Audios ─────────────────────────────────────────────────────────────
import takeOffSnd from "../../assets/audio/take_off.mp3";
import flewAwaySnd from "../../assets/audio/flew_away.mp3";
import mainSnd from "../../assets/audio/main.wav";

// ─── Sub-components ──────────────────────────────────────────────────────────
const Plane = ({ isFlying }: { isFlying: boolean }) => (
  <div className="plane-container">
    <img src={planeImg} className="plane-body" alt="aviator plane" />
    <img src={propImg} className={`plane-propeller ${isFlying ? "spinning" : ""}`} alt="propeller" />
  </div>
);

// ─── Exhaust particles ───────────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  opacity: number;
  size: number;
}

export default function CrashCanvas() {
  const { GameState, currentNum, time, setCurrentTarget, userInfo } =
    React.useContext(Context);

  const isSoundEnable = userInfo?.isSoundEnable ?? true;
  const isMusicEnable = userInfo?.isMusicEnable ?? true;

  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const gradPathRef = useRef<SVGPathElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const [liveMultiplier, setLiveMultiplier] = useState(1.0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const particleTimerRef = useRef<any>(null);

  // ── Audio Refs ────────────────────────────────────────────────────────────
  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const takeOffAudioRef = useRef<HTMLAudioElement | null>(null);
  const flewAwayAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    mainAudioRef.current = new Audio(mainSnd);
    mainAudioRef.current.loop = true;
    takeOffAudioRef.current = new Audio(takeOffSnd);
    flewAwayAudioRef.current = new Audio(flewAwaySnd);

    return () => {
      mainAudioRef.current?.pause();
      takeOffAudioRef.current?.pause();
      flewAwayAudioRef.current?.pause();
    };
  }, []);

  // ── Derive display state ──────────────────────────────────────────────────
  const isPlaying = GameState === "PLAYING";
  const isBet = GameState === "BET" || GameState === "WAITING" || !GameState;
  const isCrashed = GameState === "CRASHED" || GameState === "GAMEEND";
  const crashValue = parseFloat(currentNum) || 1;

  // ── SVG path builder ─────────────────────────────────────────────────────
  const buildCurve = useCallback((progress: number) => {
    if (!svgRef.current || !pathRef.current || !gradPathRef.current) return;
    const W = svgRef.current.clientWidth || 700;
    const H = svgRef.current.clientHeight || 380;

    // Clamp progress 0..1
    const p = Math.max(0, Math.min(progress, 0.97));

    // Origin point: bottom-left corner with padding
    const ox = 60;
    const oy = H - 40;

    // End point rises and moves right
    const ex = ox + p * (W - ox - 40);
    const ey = oy - p * p * (H - 60);

    // Control point: keep curve arching upward
    const cpx = ox + p * (W - ox - 40) * 0.35;
    const cpy = oy - p * (H - 60) * 0.1;

    const d = `M${ox},${oy} Q${cpx},${cpy} ${ex},${ey}`;
    pathRef.current.setAttribute("d", d);
    gradPathRef.current.setAttribute("d", d);

    // Position plane at tip of curve
    if (planeRef.current && isPlaying) {
      const angle =
        Math.atan2(oy - ey, ex - ox) * (180 / Math.PI) * -1 * 0.55;
      planeRef.current.style.left = `${ex - 55}px`;
      planeRef.current.style.top = `${ey - 38}px`;
      planeRef.current.style.transform = `rotate(${-angle}deg)`;

      // Spawn exhaust particle
      spawnParticle(ex - 60, ey - 5);
    }
  }, [isPlaying]);

  const spawnParticle = (x: number, y: number) => {
    const id = particleIdRef.current++;
    setParticles(prev => [
      ...prev.slice(-12),
      { id, x, y, opacity: 0.7, size: 6 + Math.random() * 6 },
    ]);
  };

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(particleTimerRef.current);

    if (isPlaying) {
      startTimeRef.current = time;

      const animate = () => {
        if (!startTimeRef.current) {
          startTimeRef.current = Date.now();
        }
        const now = Date.now();
        const elapsed = Math.max(0, (now - startTimeRef.current) / 1000);

        // Multiplier formula
        let mult = Math.floor(100 * Math.E ** (0.06 * elapsed)) / 100;
        if (!isFinite(mult) || mult > 1000000) mult = 1000000; // Cap at 1M for safety

        const m = Math.max(1, mult);
        setLiveMultiplier(m);
        setCurrentTarget(m);

        // Progress: how far along the normalized path
        const progress = Math.min(Math.log(m) / Math.log(4.0), 0.95);
        buildCurve(progress);

        // Fade old particles
        setParticles(prev =>
          prev
            .map(p => ({ ...p, opacity: p.opacity - 0.06, x: p.x - 2.5 }))
            .filter(p => p.opacity > 0)
        );

        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);

      // Play start sounds
      if (isSoundEnable) {
        takeOffAudioRef.current?.play().catch(() => { });
      }
      setTimeout(() => {
        if (isMusicEnable) {
          mainAudioRef.current?.play().catch(() => { });
        }
      }, 500);
    } else if (isCrashed) {
      cancelAnimationFrame(rafRef.current);
      setLiveMultiplier(crashValue);
      setCurrentTarget(crashValue);
      buildCurve(1);
      setParticles([]);

      // Stop flying sound and play crash
      mainAudioRef.current?.pause();
      if (mainAudioRef.current) mainAudioRef.current.currentTime = 0;
      if (isSoundEnable) {
        flewAwayAudioRef.current?.play().catch(() => { });
      }
    } else {
      // BET phase — reset
      mainAudioRef.current?.pause();
      if (mainAudioRef.current) mainAudioRef.current.currentTime = 0;
      setLiveMultiplier(1.0);
      setCurrentTarget(1.0);
      if (pathRef.current) pathRef.current.setAttribute("d", "");
      if (gradPathRef.current) gradPathRef.current.setAttribute("d", "");
      setParticles([]);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(particleTimerRef.current);
    };
  }, [GameState, crashValue, time]);

  // ── Stars (static) ────────────────────────────────────────────────────────
  const stars = React.useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 80,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
      })),
    []
  );

  const displayMult = isPlaying
    ? liveMultiplier.toFixed(2)
    : isCrashed
      ? crashValue.toFixed(2)
      : "1.00";

  // ── Countdown for BET phase ───────────────────────────────────────────────
  const [betCountdown, setBetCountdown] = useState(100);
  useEffect(() => {
    if (!isBet) { setBetCountdown(100); return; }
    const interval = setInterval(() => {
      const elapsed = Date.now() - time;
      const pct = Math.max(0, 100 - (elapsed / 5000) * 100);
      setBetCountdown(pct);
    }, 50);
    return () => clearInterval(interval);
  }, [isBet, time]);

  return (
    <div className="crash-wrap" ref={canvasRef}>
      {/* ── Top Banner ── */}
      <div className="top-banner">
        <span className="fun-mode">FUN MODE</span>
      </div>

      {/* ── Background Sunburst ── */}
      <div className={`sunray-bg-container ${isPlaying ? "active" : ""}`}>
        <img src={bgSun} className="sunray-img" alt="rays" />
      </div>

      {/* ── Star field ── */}
      < div className="star-field" >
        {
          stars.map(s => (
            <div
              key={s.id}
              className="star"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
              }}
            />
          ))
        }
      </div >

      {/* ── Exhaust particles ── */}
      {
        particles.map(p => (
          <div
            key={p.id}
            className="exhaust-particle"
            style={{
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
            }}
          />
        ))
      }

      {/* ── SVG curve ── */}
      <svg
        ref={svgRef}
        className="curve-svg"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="curveGlow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e30737" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ff6060" stopOpacity="1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Gradient fill under curve */}
          <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e30737" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#e30737" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Glow / fill area (closed path) */}
        <path
          ref={gradPathRef}
          stroke="none"
          fill="none"
          opacity="0"
        />

        {/* Main curve line */}
        <path
          ref={pathRef}
          stroke="url(#curveGlow)"
          strokeWidth="3"
          fill="none"
          filter="url(#glow)"
          strokeLinecap="round"
        />

        {/* Axis labels */}
        <text x="20" y="30" fill="rgba(255,255,255,0.15)" fontSize="11" fontFamily="Roboto">
          {isCrashed ? crashValue.toFixed(2) + "x" : ""}
        </text>
      </svg>

      {/* ── Plane ── */}
      {
        isPlaying && (
          <div ref={planeRef} className="plane-wrap">
            <Plane isFlying={true} />
          </div>
        )
      }

      {/* ── Crashed plane fly-away ── */}
      {
        isCrashed && (
          <div className="plane-flyaway">
            <Plane isFlying={false} />
          </div>
        )
      }

      {/* ── Multiplier display ── */}
      <div className={`mult-display ${isCrashed ? "crashed" : ""} ${isBet ? "hidden" : ""}`}>
        <img src={blurImg} className="mult-blur" alt="blur-bg" />
        {isCrashed ? (
          <div className="crashed-info">
            <div className="flew-away-label">FLEW AWAY!</div>
            <div className="mult-value">{displayMult}x</div>
          </div>
        ) : (
          <div className="mult-value">{displayMult}x</div>
        )}
      </div>

      {/* ── BET phase overlay ── */}
      {
        isBet && (
          <div className="bet-phase-overlay">
            <div className="next-round-label">NEXT ROUND IN</div>
            <div className="countdown-timer">
              {(betCountdown * 0.05).toFixed(1)}s
            </div>
            <div className="countdown-bar-wrap">
              <div
                className="countdown-bar"
                style={{ width: `${betCountdown}%` }}
              />
            </div>
          </div>
        )
      }
    </div >
  );
}
