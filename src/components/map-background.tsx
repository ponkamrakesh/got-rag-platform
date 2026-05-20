'use client'

import { useEffect, useRef } from 'react'

/**
 * Iron Throne Background
 *
 * HBO-faithful aesthetic: dark steel, hundreds of swords fanning into the
 * throne silhouette, ember bloom behind it, and the classic medieval title
 * treatment. Everything is inline SVG + Canvas — zero external assets.
 */

export default function MapBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Warm ember / ash particle system
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
      color: string
    }> = []

    const PALETTE = ['192,57,43', '231,76,60', '243,156,18', '211,84,0']

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.8 + 0.2,
        dx: (Math.random() - 0.5) * 0.25,
        dy: -Math.random() * 0.6 - 0.1, // embers float upward
        alpha: Math.random() * 0.7 + 0.05,
        dAlpha: (Math.random() - 0.5) * 0.004,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      })
    }

    let animId: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of particles) {
        p.x += p.dx
        p.y += p.dy
        p.alpha += p.dAlpha
        if (p.alpha <= 0.02 || p.alpha >= 0.9) p.dAlpha *= -1
        if (p.x < -10) p.x = W + 10
        if (p.x > W + 10) p.x = -10
        if (p.y < -10) p.y = H + 10 // wrap upward
        if (p.y > H + 10) p.y = -10

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`
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
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#070708]">
      {/* Cold steel radial gradient behind the throne */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 50% 70% at 50% 85%, rgba(44,62,80,0.45) 0%, transparent 70%),
            radial-gradient(ellipse 40% 50% at 50% 75%, rgba(192,57,43,0.12) 0%, transparent 60%),
            radial-gradient(circle at 50% 50%, rgba(10,10,11,0.2) 0%, transparent 70%)
          `,
        }}
      />

      {/* Title watermark — huge, low opacity, Cinzel font (already loaded) */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style={{ fontFamily: "'Cinzel', Georgia, serif" }}
      >
        <div className="text-center opacity-[0.035] mt-32">
          <h1
            className="text-[10vw] md:text-[8vw] font-bold tracking-[0.25em] uppercase leading-none"
            style={{
              color: '#a0a0a0',
              textShadow: '0 0 60px rgba(192,57,43,0.15)',
            }}
          >
            Game of Thrones
          </h1>
          <p
            className="text-[2.5vw] md:text-[1.5vw] tracking-[0.6em] uppercase mt-4"
            style={{ color: '#666' }}
          >
            A Song of Ice &amp; Fire
          </p>
        </div>
      </div>

      {/* ===== SVG IRON THRONE ===== */}
      <svg
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-auto opacity-40"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMax meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Blade metal gradient */}
          <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(160,160,170,0.5)" />
            <stop offset="40%" stopColor="rgba(80,80,90,0.35)" />
            <stop offset="100%" stopColor="rgba(30,30,35,0.6)" />
          </linearGradient>

          {/* Hilt / guard darker steel */}
          <linearGradient id="hiltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(60,60,65,0.7)" />
            <stop offset="100%" stopColor="rgba(20,20,22,0.8)" />
          </linearGradient>

          {/* Ember bloom behind the throne */}
          <radialGradient id="throneBloom" cx="50%" cy="80%" r="60%">
            <stop offset="0%" stopColor="rgba(192,57,43,0.18)" />
            <stop offset="50%" stopColor="rgba(192,57,43,0.06)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          <filter id="swordGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Fire bloom behind throne */}
        <ellipse cx="400" cy="520" rx="280" ry="120" fill="url(#throneBloom)" />

        {/* === LEFT FAN (swords splaying left) === */}
        <g filter="url(#swordGlow)">
          {/* Far left blades */}
          <path d="M 400,520 L 280,220 L 285,225 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 300,180 L 305,185 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 330,150 L 335,155 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 360,130 L 365,135 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 390,120 L 395,125 Z" fill="url(#bladeGrad)" />

          {/* Mid-left blades */}
          <path d="M 400,520 L 320,280 L 325,285 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 340,240 L 345,245 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 370,200 L 375,205 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 395,170 L 400,175 Z" fill="url(#bladeGrad)" />

          {/* === RIGHT FAN (swords splaying right) === */}
          <path d="M 400,520 L 520,220 L 515,225 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 500,180 L 495,185 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 470,150 L 465,155 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 440,130 L 435,135 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 410,120 L 405,125 Z" fill="url(#bladeGrad)" />

          <path d="M 400,520 L 480,280 L 475,285 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 460,240 L 455,245 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 430,200 L 425,205 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 405,170 L 400,175 Z" fill="url(#bladeGrad)" />

          {/* === CREST SWORDS (top center cluster) === */}
          <path d="M 400,520 L 400,100 L 405,105 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 380,130 L 385,135 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 420,130 L 415,135 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 365,170 L 370,175 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 435,170 L 430,175 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 390,90 L 395,95 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 410,90 L 405,95 Z" fill="url(#bladeGrad)" />

          {/* === ARMRESTS / HORIZONTAL GUARDS === */}
          <rect x="260" y="340" width="80" height="10" rx="2" fill="url(#hiltGrad)" />
          <rect x="460" y="340" width="80" height="10" rx="2" fill="url(#hiltGrad)" />
          <rect x="270" y="355" width="60" height="6" rx="1" fill="url(#hiltGrad)" />
          <rect x="470" y="355" width="60" height="6" rx="1" fill="url(#hiltGrad)" />

          {/* === BASE / SEAT PLATFORM === */}
          <path d="M 340,480 L 460,480 L 480,520 L 320,520 Z" fill="url(#hiltGrad)" opacity="0.8" />
          <path d="M 320,520 L 480,520 L 500,560 L 300,560 Z" fill="url(#hiltGrad)" opacity="0.6" />

          {/* === FRONT FANGS (chaotic forward-pointing swords) === */}
          <path d="M 400,520 L 360,420 L 365,425 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 440,420 L 435,425 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 380,400 L 385,405 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 420,400 L 415,405 Z" fill="url(#bladeGrad)" />
          <path d="M 400,520 L 395,380 L 400,385 Z" fill="url(#bladeGrad)" />

          {/* === EXTRA DENSITY (small filler blades) === */}
          <path d="M 400,520 L 350,300 L 353,303 Z" fill="url(#bladeGrad)" opacity="0.6" />
          <path d="M 400,520 L 450,300 L 447,303 Z" fill="url(#bladeGrad)" opacity="0.6" />
          <path d="M 400,520 L 330,350 L 333,353 Z" fill="url(#bladeGrad)" opacity="0.5" />
          <path d="M 400,520 L 470,350 L 467,353 Z" fill="url(#bladeGrad)" opacity="0.5" />
          <path d="M 400,520 L 375,260 L 378,263 Z" fill="url(#bladeGrad)" opacity="0.5" />
          <path d="M 400,520 L 425,260 L 422,263 Z" fill="url(#bladeGrad)" opacity="0.5" />
        </g>
      </svg>

      {/* Ember canvas layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen', opacity: 0.8 }}
      />

      {/* Heavy vignette for text readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 50%, transparent 30%, rgba(7,7,8,0.85) 85%),
            linear-gradient(to top, rgba(7,7,8,0.95) 0%, rgba(7,7,8,0.3) 30%, transparent 50%),
            linear-gradient(to bottom, rgba(7,7,8,0.8) 0%, transparent 20%)
          `,
        }}
      />

      {/* Bottom fire-line ember strip */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(192,57,43,0.4), rgba(243,156,18,0.3), rgba(192,57,43,0.4), transparent)',
          filter: 'blur(4px)',
        }}
      />
    </div>
  )
}
