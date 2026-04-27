'use client'

import { useEffect, useMemo, useState } from 'react'
import { billingApi, tenantApi, ApiError } from '@/lib/api'
import { showToast } from '@/components/ui/Toast'

type Plan = {
  id: string
  name: string
  description?: string | null
  price: number
  durationDays: number
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subscription, setSubscription] = useState<{
    planType: 'TRIAL' | 'PAID' | null
    currentSubscriptionEnd: string | null
  } | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)
  const [latestSubscription, setLatestSubscription] = useState<any | null>(null)
  const [loadingLatest, setLoadingLatest] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    billingApi
      .getPlans()
      .then((data) => {
        if (cancelled) return
        setPlans(Array.isArray(data) ? data : [])
        if (Array.isArray(data) && data.length > 0) {
          setSelectedPlanId(data[0].id)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof ApiError
            ? err.message
            : 'Unable to load plans. Please try again later.'
        setError(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadLatest() {
      setLoadingLatest(true)
      try {
        const data = await billingApi.getMySubscription()
        if (cancelled) return
        setLatestSubscription(data ?? null)
      } catch {
        if (!cancelled) setLatestSubscription(null)
      } finally {
        if (!cancelled) setLoadingLatest(false)
      }
    }
    void loadLatest()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadSubscription() {
      setLoadingSubscription(true)
      try {
        const data = await tenantApi.getMe()
        if (cancelled) return
        setSubscription({
          planType: (data?.planType as 'TRIAL' | 'PAID' | null) ?? null,
          currentSubscriptionEnd: data?.currentSubscriptionEnd ?? null,
        })
      } catch {
        if (!cancelled) setSubscription(null)
      } finally {
        if (!cancelled) setLoadingSubscription(false)
      }
    }
    void loadSubscription()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  )

  const esewaNumber = process.env.NEXT_PUBLIC_ESEWA_NUMBER ?? '9800000000'

  // Bank details for manual QR payment
  const bankAccount = {
    name: 'Aadarsh Kumar Jha',
    accountType: 'NABIL GEN N ACCOUNT',
    accountNumber: '24610017505255',
    bankName: 'Nabil Bank',
  }
  const formattedEndDate = useMemo(() => {
    if (!subscription?.currentSubscriptionEnd) return null
    try {
      return new Date(subscription.currentSubscriptionEnd).toLocaleString()
    } catch {
      return subscription.currentSubscriptionEnd
    }
  }, [subscription])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedPlan) {
      setError('Please select a plan first.')
      return
    }
    if (!transactionId.trim()) {
      setError('Please enter the transaction ID.')
      return
    }

    setIsSubmitting(true)
    try {
      await billingApi.requestSubscription({
        planId: selectedPlan.id,
        transactionId: transactionId.trim(),
        paidAmount: selectedPlan.price,
        screenshotUrl: screenshotUrl.trim() || undefined,
      })
      showToast(
        'Payment details submitted successfully. Our team will verify your payment and activate your subscription shortly.',
        'success'
      )
      setTransactionId('')
      setScreenshotUrl('')
      // Reload latest subscription so UI reflects newly submitted request.
      try {
        const data = await billingApi.getMySubscription()
        setLatestSubscription(data ?? null)
      } catch {
        // ignore; we still show success message
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to submit payment details. Please try again.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
        Subscription & Billing
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        Choose a plan that fits your cafe, pay via eSewa QR, and submit your transaction
        ID. Your subscription will be activated once our admin team verifies the payment.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Current subscription summary */}
      <section className="mb-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current subscription
            </p>
            {loadingSubscription ? (
              <p className="mt-1 text-sm text-slate-500">Loading subscription details...</p>
            ) : subscription?.planType ? (
              <>
                <p className="mt-1 text-sm text-slate-900">
                  Plan:{' '}
                  <span className="font-semibold">
                    {subscription.planType === 'TRIAL' ? 'Free trial' : 'Paid'}
                  </span>
                </p>
                <p className="text-xs text-slate-600">
                  Access valid until:{' '}
                  <span className="font-medium">
                    {formattedEndDate ?? 'Not available'}
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                No active subscription information is available yet.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Latest subscription request/status */}
      <section className="mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Latest subscription request
          </p>
          {loadingLatest ? (
            <p className="text-sm text-slate-600">Checking your latest request...</p>
          ) : !latestSubscription ? (
            <p className="text-sm text-slate-600">
              You have not submitted any subscription requests yet.
            </p>
          ) : (
            <div className="text-sm text-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">
                  {latestSubscription.plan?.name ?? 'Subscription'} · Rs.{' '}
                  {(latestSubscription.plan?.price ?? latestSubscription.paidAmount ?? 0).toLocaleString(
                    'en-NP'
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  Submitted at:{' '}
                  {latestSubscription.createdAt
                    ? new Date(latestSubscription.createdAt).toLocaleString()
                    : 'N/A'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    String(latestSubscription.status) === 'PENDING_VERIFICATION'
                      ? 'bg-amber-100 text-amber-800'
                      : String(latestSubscription.status) === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : String(latestSubscription.status) === 'REJECTED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {String(latestSubscription.status).replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Plans */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Available Plans</h2>
        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Loading plans...
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No plans are currently configured. Please contact support.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isSelected = plan.id === selectedPlanId
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`text-left rounded-xl border p-4 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-red-600 ${
                    isSelected
                      ? 'border-red-600 bg-red-50'
                      : 'border-gray-200 bg-white hover:border-red-300'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                      {plan.name}
                    </h3>
                    <span className="text-sm font-medium text-red-700">
                      Rs. {plan.price.toLocaleString('en-NP')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">
                    Duration: {plan.durationDays} days
                  </p>
                  {plan.description && (
                    <p className="text-xs text-slate-600 line-clamp-3">
                      {plan.description}
                    </p>
                  )}
                  {isSelected && (
                    <p className="mt-2 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                      Selected
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Payment section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Pay via eSewa QR</h2>
        <p className="text-sm text-slate-600 mb-4">
          Scan the QR from your app or send payment to the account number below. Then enter
          the transaction ID and submit the form.
        </p>

        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,3fr)] items-start">
          {/* QR / bank details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 flex flex-col items-center justify-center min-h-[220px]">
            <div className="mb-3 rounded-lg bg-white p-2 shadow-sm">
              <img
                src="/nabil_qr.png"
                alt="Payment QR for Nabil Bank account"
                className="h-40 w-40 object-contain"
              />
            </div>
            <p className="font-semibold text-slate-900">{bankAccount.bankName}</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {bankAccount.name}
            </p>
            <p className="text-xs text-slate-600">{bankAccount.accountType}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 tracking-wide">
              A/C No: {bankAccount.accountNumber}
            </p>
            <p className="mt-2 text-xs text-slate-500 text-center max-w-xs">
              After sending the payment using this QR or to the same account, enter the
              transaction ID on the right to confirm your subscription request.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Selected Plan
              </label>
              <input
                type="text"
                readOnly
                value={
                  selectedPlan
                    ? `${selectedPlan.name} — Rs. ${selectedPlan.price.toLocaleString(
                        'en-NP'
                      )} for ${selectedPlan.durationDays} days`
                    : 'No plan selected'
                }
                className="block w-full rounded-lg border border-slate-300 bg-slate-100 text-sm text-slate-900 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label
                htmlFor="transactionId"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Transaction Reference ID<span className="text-red-500"> *</span>
              </label>
              <input
                id="transactionId"
                type="text"
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:ring-red-500"
                placeholder="Enter the transaction reference ID of the payment"
              />
            </div>

            <div>
              <label
                htmlFor="screenshotUrl"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Screenshot URL (optional)
              </label>
              <input
                id="screenshotUrl"
                type="url"
                value={screenshotUrl}
                onChange={(e) => setScreenshotUrl(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:ring-red-500"
                placeholder="Paste a link to the payment screenshot (e.g. from Drive)"
              />
              <p className="mt-1 text-xs text-slate-500">
                File uploads will be added later; for now you can paste a link if needed.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedPlan}
                className="inline-flex w-full justify-center rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Payment Details'}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                After submission, your access will be activated once payment is verified by
                an admin.
              </p>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}

