'use client'

import Link from 'next/link'

export default function Hero() {
  return (
    <section className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-slate-900 mb-2">
        Nepal&apos;s Own Cafe 
      </h1>
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-red-700 mb-8 sm:mb-10">
        Management System
      </h1>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a
          href="#features"
          className="w-full sm:w-auto px-6 py-3 rounded-full border-2 border-red-500 text-red-600 font-medium hover:bg-red-50 transition"
        >
          View Features
        </a>
        <Link
          href="/register"
          className="w-full sm:w-auto px-6 py-3 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition"
          prefetch
        >
          Start Free Trial
        </Link>
      </div>
    </section>
  )
}
