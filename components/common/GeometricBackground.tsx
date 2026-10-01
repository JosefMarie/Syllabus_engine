"use client";

import React, { useEffect, useRef } from "react";

export default function GeometricBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    // Mouse coordinates with smooth damping
    let mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      isActive: false,
    };

    // Idle ambient drift when mouse is still or not hovering
    let idleAngle = 0;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.isActive = true;
    };

    const handleMouseLeave = () => {
      mouse.isActive = false;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    // Decagon rendering constants
    const RADIUS = 38; // Radius of each decagon
    const SPACING_X = 96; // Horizontal grid spacing
    const SPACING_Y = 84; // Vertical grid spacing
    const GLOW_RADIUS = 280; // Illumination radius around mouse
    const SIDES = 10;

    // Precalculate unit decagon vertices (cos, sin)
    const decagonUnitPoints: { cos: number; sin: number }[] = [];
    for (let i = 0; i < SIDES; i++) {
      const angle = (i * 2 * Math.PI) / SIDES - Math.PI / 2; // Start with top point
      decagonUnitPoints.push({
        cos: Math.cos(angle),
        sin: Math.sin(angle),
      });
    }

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse interpolation (lerp)
      if (mouse.isActive) {
        mouse.x += (mouse.targetX - mouse.x) * 0.1;
        mouse.y += (mouse.targetY - mouse.y) * 0.1;
      } else {
        // Slow gentle idle drift when mouse is off-screen or motionless
        idleAngle += 0.008;
        const centerX = width * 0.5;
        const centerY = height * 0.35;
        const driftRadius = Math.min(width, height) * 0.22;
        mouse.x = centerX + Math.cos(idleAngle) * driftRadius;
        mouse.y = centerY + Math.sin(idleAngle * 0.8) * (driftRadius * 0.6);
      }

      // Calculate grid dimensions
      const cols = Math.ceil(width / SPACING_X) + 2;
      const rows = Math.ceil(height / SPACING_Y) + 2;

      // Draw subtle connecting grid lines & Decagons
      for (let r = -1; r < rows; r++) {
        const rowOffsetY = r * SPACING_Y;
        const isOddRow = Math.abs(r) % 2 === 1;
        const rowShiftX = isOddRow ? SPACING_X * 0.5 : 0;

        for (let c = -1; c < cols; c++) {
          const cx = c * SPACING_X + rowShiftX;
          const cy = rowOffsetY;

          // Distance from mouse/light point to decagon center
          const dx = cx - mouse.x;
          const dy = cy - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Proximity factor (0 when far, 1 when right on top of mouse)
          const proximity = Math.max(0, 1 - dist / GLOW_RADIUS);
          const glowFactor = Math.pow(proximity, 1.6);

          // Base style for ambient background
          const baseAlpha = 0.07;
          const activeAlpha = baseAlpha + glowFactor * 0.75;

          ctx.beginPath();
          // Draw 10-sided regular decagon
          for (let i = 0; i < SIDES; i++) {
            const pt = decagonUnitPoints[i];
            const px = cx + pt.cos * RADIUS;
            const py = cy + pt.sin * RADIUS;
            if (i === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          }
          ctx.closePath();

          if (glowFactor > 0.02) {
            // Illuminated tech aesthetic: smooth transition from cyan (06B6D4) to purple (A855F7)
            const rVal = Math.round(6 + (168 - 6) * glowFactor);
            const gVal = Math.round(182 - 97 * glowFactor);
            const bVal = Math.round(212 + (247 - 212) * glowFactor);

            ctx.strokeStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${activeAlpha})`;
            ctx.lineWidth = 1 + glowFactor * 1.4;
            ctx.stroke();

            // Inner decagon star spokes when close to mouse
            if (glowFactor > 0.15) {
              ctx.beginPath();
              for (let i = 0; i < SIDES; i += 2) {
                const pt = decagonUnitPoints[i];
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + pt.cos * RADIUS * 0.85, cy + pt.sin * RADIUS * 0.85);
              }
              ctx.strokeStyle = `rgba(6, 182, 212, ${glowFactor * 0.45})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();

              // Micro vertex dots for enhanced tech look
              for (let i = 0; i < SIDES; i++) {
                const pt = decagonUnitPoints[i];
                const vx = cx + pt.cos * RADIUS;
                const vy = cy + pt.sin * RADIUS;
                ctx.beginPath();
                ctx.arc(vx, vy, 1.2 + glowFactor * 1.2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(168, 85, 247, ${glowFactor * 0.9})`;
                ctx.fill();
              }
            }
          } else {
            // Default subtle dark grid line
            ctx.strokeStyle = `rgba(51, 65, 85, ${baseAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }

          // Subtle center pivot node
          ctx.beginPath();
          ctx.arc(cx, cy, 1, 0, Math.PI * 2);
          ctx.fillStyle = glowFactor > 0.05 
            ? `rgba(6, 182, 212, ${0.2 + glowFactor * 0.7})` 
            : "rgba(51, 65, 85, 0.15)";
          ctx.fill();
        }
      }

      // Draw mouse radial ambient glow burst
      if (mouse.x > -500 && mouse.y > -500) {
        const glowGradient = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          GLOW_RADIUS
        );
        glowGradient.addColorStop(0, "rgba(6, 182, 212, 0.16)"); // Soft cyan core
        glowGradient.addColorStop(0.35, "rgba(99, 102, 241, 0.10)"); // Indigo midtone
        glowGradient.addColorStop(0.7, "rgba(168, 85, 247, 0.04)"); // Violet halo
        glowGradient.addColorStop(1, "rgba(11, 15, 25, 0)"); // Fade to background

        ctx.save();
        ctx.fillStyle = glowGradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    // Pause when tab is inactive to save battery/CPU
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
      {/* HTML5 Canvas Grid with Decagon geometry and mouse tracking glow */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full"
      />

      {/* Top Header Ambient Glow (spans across the entire navbar area) */}
      <div 
        className="absolute -top-24 left-1/2 -translate-x-1/2 h-56 w-[90%] max-w-5xl rounded-full bg-gradient-to-r from-cyan-500/15 via-indigo-500/15 to-purple-500/15 blur-3xl opacity-70 pointer-events-none" 
      />

      {/* Top-Left Corner Ambient Gradient (Cyan / Turquoise) */}
      <div 
        className="absolute -top-28 -left-28 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-500/20 via-blue-600/10 to-transparent blur-3xl opacity-60 pointer-events-none" 
      />

      {/* Top-Right Corner Ambient Gradient (Purple / Violet) */}
      <div 
        className="absolute -top-28 -right-28 h-88 w-88 rounded-full bg-gradient-to-bl from-purple-500/20 via-indigo-600/10 to-transparent blur-3xl opacity-60 pointer-events-none" 
      />

      {/* Bottom-Right Corner Ambient Gradient (Indigo / Blue) */}
      <div 
        className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-tl from-indigo-500/15 via-purple-600/10 to-transparent blur-3xl opacity-50 pointer-events-none" 
      />

      {/* Bottom-Left Corner Ambient Gradient (Emerald / Teal) */}
      <div 
        className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-emerald-500/10 via-teal-600/10 to-transparent blur-3xl opacity-40 pointer-events-none" 
      />

      {/* Subtle vignette border gradient to deepen edges and focus content */}
      <div 
        className="absolute inset-0 bg-radial-gradient from-transparent via-[#0B0F19]/20 to-[#0B0F19]/80 pointer-events-none" 
      />
    </div>
  );
}
