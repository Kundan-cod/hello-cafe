'use client'

import { useState } from 'react'
import Link from 'next/link'

const checkIcon = (
  <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
)

type Duration = '3months' | '6months' | '1year'

const durationLabels: Record<Duration, string> = {
  '3months': '3 Months',
  '6months': '6 Months',
  '1year': '1 Year',
}

const pricingByDuration = {
  '3months': {
    plus: { daily: 45, total: '4,070', period: '3 Months', save: '1,330' },
    pro: { daily: 90, total: '8,100', period: '3 Months', save: '1,800' },
  },
  '6months': {
    plus: { daily: 37, total: '6,780', period: '6 Months', save: '2,220' },
    pro: { daily: 85, total: '15,300', period: '6 Months', save: '3,600' },
  },
  '1year': {
    plus: { daily: 20, total: '7,300', period: '12 Months', save: '7,300' },
    pro: { daily: 60, total: '21,900', period: '12 Months', save: '7,300' },
  },
} as const

const plusFeatureTooltips: Record<string, string> = {
  'Up to 10 staff members': 'Add up to 10 staff accounts with login. Each can have a role (e.g. waiter, manager).',
  'Unlimited Orders, Menus, Areas & Tables': 'No cap on orders, menu items, seating areas, or tables.',
  'Smart Reporting + Built-in Credit Tracking': 'Daily and period reports; track customer credit and dues in one place.',
  '365-Day Data Backup, Custom Brand Theme & Flexible Order Types': 'One year of cloud backup; customize logo and colors; support for dine-in, takeaway, delivery.',
  'Discounts, Offers & Loyalty Feature': 'Create discounts and offers; run a simple loyalty program for repeat customers.',
  'Vendor, Inventory & Expense Management': 'Manage vendors, stock levels, and record expenses for better control.',
}

const proFeatureTooltips: Record<string, string> = {
  'Up to 50 staff members': 'Add up to 50 staff accounts across your outlets with roles and permissions.',
  '1 Cafe + 4 Branches': 'Run one main cafe and up to 4 branch locations from a single account.',
  'Lifetime Data Backup': 'Unlimited retention of your data in the cloud for as long as you subscribe.',
  'Priority Support': 'Faster response and dedicated support channel for Pro subscribers.',
  'Unlimited Orders, Menus, Areas & Tables': 'No limits on orders, menu items, areas, or tables.',
  'Smart Reporting + Built-in Credit Tracking': 'Full reporting and credit/dues tracking across all branches.',
  'Custom Brand Theme & Flexible Order Types': 'Custom branding; support for dine-in, takeaway, delivery, and more.',
  'Discounts, Offers & Loyalty Feature': 'Discounts, promotions, and loyalty program for all branches.',
  'Vendor, Inventory & Expense Management': 'Vendors, inventory, and expense tracking across branches.',
}

export default function Pricing() {
  const [duration, setDuration] = useState<Duration>('3months')

  const plus = pricingByDuration[duration].plus
  const pro = pricingByDuration[duration].pro

  return (
    <section id="pricing" className="py-16 sm:py-24 bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Duration selector */}
        <div className="flex justify-center gap-2 mb-10">
          {(Object.keys(durationLabels) as Duration[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition ${
                duration === d
                  ? 'bg-red-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {durationLabels[d]}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {/* Trial */}
          <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 border border-slate-100 flex flex-col">
            <h3 className="text-2xl font-bold text-red-800 mb-2">Trial</h3>
            <p className="text-slate-600 text-sm mb-6">
              Enjoy full access to Pro for 15 days. Experience it first. Explore freely, and choose
              what best fits your business.
            </p>
            <div className="mb-6">
              <span className="text-slate-500 text-lg">Rs. </span>
              <span className="text-4xl font-bold text-red-800">0</span>
            </div>
            <Link
              href="/register"
              className="inline-flex justify-center py-3 px-5 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition mb-4"
              prefetch
            >
              Start 15 days free trial
            </Link>
            <div className="flex items-start gap-2 text-sm text-slate-600 mt-auto">
              {checkIcon}
              <span>Includes All Hello Cafe Pro Features</span>
              <span className="text-slate-400 cursor-help" title="Your trial includes every feature from the Pro plan for 15 days—orders, menu, reports, inventory, and more.">ⓘ</span>
            </div>
          </div>

          {/* Hello Cafe Plus - Most Popular */}
          <div className="bg-white rounded-2xl shadow-xl p-6 lg:p-8 border-2 border-red-200 flex flex-col relative">
            <span className="absolute -top-0 left-0 right-0 bg-red-800 text-white text-center text-sm font-medium py-1.5 rounded-t-2xl">
              Most Popular
            </span>
            <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg rotate-12">
              Save Rs.{plus.save}
            </span>
            <div className="pt-6">
              <h3 className="text-2xl font-bold text-red-800 mb-2">Hello Cafe Plus</h3>
              <p className="text-slate-600 text-sm mb-6">
                One plan, every feature, all your business needs.
              </p>
              <div className="mb-2">
                <span className="text-slate-500">Rs. </span>
                <span className="text-4xl font-bold text-red-800">{plus.daily}</span>
                <span className="text-slate-600"> /Day</span>
              </div>
              <p className="text-sm text-slate-500 mb-6">(Rs. {plus.total} for {plus.period})</p>
              <Link
                href="/register"
                className="inline-flex justify-center py-3 px-5 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition mb-6 w-full"
                prefetch
              >
                Get Started
              </Link>
              <ul className="space-y-2 text-sm text-slate-600">
                {[
                  'Up to 10 staff members',
                  'Unlimited Orders, Menus, Areas & Tables',
                  'Smart Reporting + Built-in Credit Tracking',
                  '365-Day Data Backup, Custom Brand Theme & Flexible Order Types',
                  'Discounts, Offers & Loyalty Feature',
                  'Vendor, Inventory & Expense Management',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    {checkIcon}
                    <span>{f}</span>
                    <span className="text-slate-400 cursor-help flex-shrink-0 select-none" title={plusFeatureTooltips[f] ?? f}>ⓘ</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Hello Cafe Pro */}
          <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 border border-slate-100 flex flex-col relative">
            <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg rotate-12">
              Save Rs.{pro.save}
            </span>
            <h3 className="text-2xl font-bold text-red-800 mb-2">Hello Cafe Pro</h3>
            <p className="text-slate-600 text-sm mb-6">
              Scale with Hello Cafe Pro: multi-branch, larger teams, lifetime backup.
            </p>
            <div className="mb-2">
              <span className="text-slate-500">Rs. </span>
              <span className="text-4xl font-bold text-red-800">{pro.daily}</span>
              <span className="text-slate-600"> /Day</span>
            </div>
            <p className="text-sm text-slate-500 mb-6">(Rs. {pro.total} for {pro.period})</p>
            <Link
              href="/register"
              className="inline-flex justify-center py-3 px-5 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition mb-6 w-full"
              prefetch
            >
              Get Started
            </Link>
            <ul className="space-y-2 text-sm text-slate-600">
              {[
                'Up to 50 staff members',
                '1 Cafe + 4 Branches',
                'Lifetime Data Backup',
                'Priority Support',
                'Unlimited Orders, Menus, Areas & Tables',
                'Smart Reporting + Built-in Credit Tracking',
                'Custom Brand Theme & Flexible Order Types',
                'Discounts, Offers & Loyalty Feature',
                'Vendor, Inventory & Expense Management',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  {checkIcon}
                  <span>{f}</span>
                  <span className="text-slate-400 cursor-help flex-shrink-0 select-none" title={proFeatureTooltips[f] ?? f}>ⓘ</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
