'use client'

import { useEffect, useRef } from 'react'

/**
 * Animated Westeros & Essos map background.
 * Pure inline SVG + CSS. No external assets. HBO-aesthetic:
 * dark parchment, drifting landmass silhouettes, ember particles, traversing fog.
 */

export default function MapBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Ember / ash particle system
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width = W
    canvas.height = H

    const particles: Array<{
      x: number
      y: number
      r: number
      dx: number
      dy: number
      alpha: number
      dAlpha: number
    }> = []

    const PARTICLE_COUNT = 80
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3 - 0.15, // slight upward drift
        alpha: Math.random() * 0.6 + 0.1,
        dAlpha: (Math.random() - 0.5) * 0.005,
      })
    }

    let animId: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of particles) {
        p.x += p.dx
        p.y += p.dy
        p.alpha += p.dAlpha
        if (p.alpha <= 0.05 || p.alpha >= 0.8) p.dAlpha *= -1
        if (p.x < -10) p.x = W + 10
        if (p.x > W + 10) p.x = -10
        if (p.y < -10) p.y = H + 10
        if (p.y > H + 10) p.y = -10

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(192, 57, 43, ${p.alpha})` // ember red
        ctx.fill()
      }
      animId = requestAnimationFrame(draw)
    }
    draw()

    const onResize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W
      canvas.height = H
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-iron-900">
      {/* Deep parchment texture via CSS gradients */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse at 20% 80%, rgba(44,62,80,0.6) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(44,62,80,0.5) 0%, transparent 60%),
            radial-gradient(ellipse at 50% 50%, rgba(20,20,25,0.9) 0%, transparent 70%)
          `,
        }}
      />

      {/* Subtle grid / longitude lines */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '120px 120px',
        }}
      />

      {/* SVG Map Layer: Westeros (left) and Essos (right) drifting slowly */}
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1920 1080"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Landmass gradient: dark slate to faint warm brown */}
          <linearGradient id="landGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(60,55,50,0.35)" />
            <stop offset="50%" stopColor="rgba(45,40,38,0.25)" />
            <stop offset="100%" stopColor="rgba(30,28,26,0.15)" />
          </linearGradient>

          {/* Fog/mist filter */}
          <filter id="mist" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" />
          </filter>

          {/* Glow for cities/keeps */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Slow panning group — Westeros & Essos coastlines */}
        <g className="map-drift">
          {/* ===== WESTEROS (left side) ===== */}
          <g transform="translate(-60, 40)" opacity="0.55">
            {/* The North */}
            <path
              d="M 480,120 Q 520,80 580,100 T 640,140 Q 660,200 620,260 T 580,340 Q 540,360 500,340 T 460,280 Q 440,200 480,120 Z"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* The Neck (narrowing) */}
            <path
              d="M 500,340 Q 520,380 560,390 T 600,380 Q 610,410 590,430 T 550,440 Q 510,430 500,340"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Riverlands + Vale + Crownlands (main body) */}
            <path
              d="M 550,440 Q 600,460 650,440 T 720,460 Q 760,500 740,560 T 700,620 Q 660,640 620,620 T 560,580 Q 520,540 540,500 T 550,440"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* The Reach (south-west bulge) */}
            <path
              d="M 540,500 Q 500,550 520,620 T 580,680 Q 620,700 660,680 T 700,620"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Stormlands (south-east) */}
            <path
              d="M 660,680 Q 700,720 760,700 T 820,680 Q 840,640 820,600 T 760,560"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Dorne (long southern peninsula) */}
            <path
              d="M 660,680 Q 640,760 680,840 T 740,920 Q 720,960 760,980 T 800,940 Q 780,860 760,800 T 720,720"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Iron Islands (small cluster west of Riverlands) */}
            <ellipse cx="420" cy="380" rx="28" ry="14" fill="url(#landGrad)" filter="url(#mist)" />
            <ellipse cx="450" cy="410" rx="22" ry="10" fill="url(#landGrad)" filter="url(#mist)" />
          </g>

          {/* ===== ESSOS (right side) ===== */}
          <g transform="translate(40, -20)" opacity="0.5">
            {/* Braavos archipelago (north-west Essos) */}
            <path
              d="M 1100,200 Q 1140,180 1180,210 T 1220,250 Q 1240,280 1200,300 T 1140,280 Q 1100,260 1100,200"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Pentos / Andal coast */}
            <path
              d="M 1080,340 Q 1120,320 1160,350 T 1220,380 Q 1260,420 1240,460 T 1180,480 Q 1140,470 1100,440 T 1060,380 Q 1040,340 1080,340"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Norvos / Qohor forest belt */}
            <path
              d="M 1240,460 Q 1280,440 1320,470 T 1380,500 Q 1420,540 1400,580 T 1340,600 Q 1300,590 1260,560 T 1220,500"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Dothraki Sea (wide central plains) */}
            <path
              d="M 1180,480 Q 1220,540 1280,560 T 1360,600 Q 1400,640 1380,700 T 1320,760 Q 1280,780 1240,760 T 1180,700 Q 1140,640 1160,560 T 1180,480"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Slaver's Bay (coastal indent) */}
            <path
              d="M 1320,760 Q 1360,800 1400,820 T 1460,840 Q 1500,860 1520,820 T 1500,760 Q 1460,740 1420,740 T 1360,720"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Valyrian peninsula / Ghiscari coast */}
            <path
              d="M 1400,820 Q 1440,880 1480,920 T 1540,960 Q 1580,980 1620,940 T 1660,880 Q 1680,820 1640,780 T 1580,760 Q 1540,750 1500,780 T 1400,820"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
            {/* Summer Sea / Basilisk Isles (south) */}
            <path
              d="M 1500,960 Q 1540,1000 1580,1020 T 1640,1040 Q 1680,1060 1700,1020 T 1720,960 Q 1700,920 1660,900 T 1580,900"
              fill="url(#landGrad)"
              filter="url(#mist)"
            />
          </g>

          {/* Decorative compass rose (top-left, subtle) */}
          <g transform="translate(140, 140)" opacity="0.25">
            <circle cx="0" cy="0" r="60" stroke="rgba(192,57,43,0.4)" strokeWidth="1" fill="none" />
            <circle cx="0" cy="0" r="45" stroke="rgba(192,57,43,0.25)" strokeWidth="0.5" fill="none" />
            {/* N-S diamond */}
            <path d="M 0,-55 L 8,-8 L 55,0 L 8,8 L 0,55 L -8,8 L -55,0 L -8,-8 Z" fill="rgba(192,57,43,0.15)" />
            {/* E-W cross */}
            <path d="M -40,0 L 40,0 M 0,-40 L 0,40" stroke="rgba(192,57,43,0.3)" strokeWidth="1" />
            <text x="0" y="-66" textAnchor="middle" fill="rgba(192,57,43,0.5)" fontSize="12" fontFamily="Cinzel, serif" letterSpacing="3">NORTH</text>
          </g>

          {/* City markers — faint glowing dots */}
          <g filter="url(#glow)">
            {/* King's Landing */}
            <circle cx="640" cy="640" r="3" fill="rgba(243,156,18,0.6)" />
            {/* Winterfell */}
            <circle cx="560" cy="180" r="3" fill="rgba(116,185,255,0.5)" />
            {/* Oldtown */}
            <circle cx="520" cy="660" r="2.5" fill="rgba(243,156,18,0.5)" />
            {/* Braavos */}
            <circle cx="1160" cy="240" r="3" fill="rgba(116,185,255,0.5)" />
            {/* Pentos */}
            <circle cx="1140" cy="400" r="2.5" fill="rgba(243,156,18,0.5)" />
            {/* Meereen */}
            <circle cx="1440" cy="800" r="3" fill="rgba(192,57,43,0.6)" />
            {/* Vaes Dothrak */}
            <circle cx="1280" cy="600" r="2.5" fill="rgba(162,155,254,0.5)" />
          </g>
        </g>

        {/* Traversing fog overlays (animated via CSS) */}
        <g className="fog-layer-1" opacity="0.12">
          <ellipse cx="400" cy="900" rx="600" ry="180" fill="#a0a0a0" filter="url(#mist)" />
        </g>
        <g className="fog-layer-2" opacity="0.1">
          <ellipse cx="1500" cy="200" rx="500" ry="150" fill="#a0a0a0" filter="url(#mist)" />
        </g>
        <g className="fog-layer-3" opacity="0.08">
          <ellipse cx="960" cy="540" rx="700" ry="200" fill="#a0a0a0" filter="url(#mist)" />
        </g>
      </svg>

      {/* Ember particle canvas (above SVG, below UI) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen', opacity: 0.7 }}
      />

      {/* Bottom vignette for readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(to top, rgba(10,10,11,0.92) 0%, rgba(10,10,11,0.4) 25%, transparent 45%),
            linear-gradient(to bottom, rgba(10,10,11,0.85) 0%, transparent 20%)
          `,
        }}
      />
    </div>
  )
}
