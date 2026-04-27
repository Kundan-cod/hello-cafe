'use client'

export default function LandingFeatures() {
  const tabs = ['1 Day', '7 Days', '1 Month', 'Filter']
  const metrics = [
    { label: 'Total Sales', value: 'Rs. 50,000', sub: 'via today' },
    { label: 'Total Credit', value: 'Rs. 11,500', sub: 'via today' },
    { label: 'Online Payment', value: 'Rs. 10,000', sub: 'via today' },
    { label: 'Avg Sales / Order', value: 'Rs. 450', sub: 'via today' },
  ]
  const topItems = [
    { name: 'Momo', price: 'Rs. 150', unit: '10 Unit', progress: 90 },
    { name: 'Pizza', price: 'Rs. 450', unit: '10 Unit', progress: 70 },
    { name: 'Coffee', price: 'Rs. 250', unit: '10 Unit', progress: 55 },
  ]
  const categories = ['Combo', 'Appetizers', 'Beverages', 'Breakfast']

  return (
    <section id="features" className="relative py-16 sm:py-24 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-red-50/30 to-red-900/95 -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left: Top Selling + Stock */}
          <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            <div className="bg-white rounded-2xl shadow-lg p-5 border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-4">Top Selling Items - Today</h3>
              <ul className="space-y-3">
                {topItems.map((item) => (
                  <li key={item.name} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-sm text-slate-500">{item.price} ({item.unit})</p>
                    </div>
                    <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-5 border border-slate-100">
              <div className="w-full h-24 rounded-xl bg-slate-200 mb-3" />
              <p className="text-sm text-slate-600">Available Stock: 2 kg</p>
              <p className="text-sm font-medium text-amber-600">Stock Status: Low Stock</p>
            </div>
          </div>

          {/* Center: Phone mockup with dashboard */}
          <div className="lg:col-span-6 flex justify-center order-1 lg:order-2">
            <div className="relative w-full max-w-[280px] sm:max-w-[320px]">
              <div className="bg-slate-800 rounded-[2.5rem] p-2 shadow-2xl border-4 border-slate-700">
                <div className="bg-white rounded-[2rem] overflow-hidden min-h-[420px]">
                  <div className="px-4 pt-3 pb-2 border-b flex justify-between items-center">
                    <span className="font-semibold text-slate-800">Dashboard</span>
                    <span className="text-sm text-slate-500">9:41</span>
                  </div>
                  <div className="p-2 flex gap-1 overflow-x-auto">
                    {tabs.map((tab, i) => (
                      <button
                        key={tab}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium ${
                          i === 0 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div className="px-3 space-y-2">
                    {metrics.map((m) => (
                      <div
                        key={m.label}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-red-100" />
                          <div>
                            <p className="text-xs text-slate-500">{m.label}</p>
                            <p className="font-semibold text-slate-800">{m.value}</p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">{m.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Offer + Categories */}
          <div className="lg:col-span-3 space-y-4 order-3">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100 relative">
              <span className="absolute top-0 left-0 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-br">
                OFFER
              </span>
              <div className="p-4 pt-8">
                <div className="w-full h-32 rounded-xl bg-amber-100 mb-3 flex items-center justify-center text-4xl">
                  🫖
                </div>
                <p className="text-2xl font-bold text-slate-800">Rs. 20.00</p>
                <p className="text-sm text-slate-400 line-through">Rs. 40.00</p>
                <button className="mt-2 w-full py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
                  Add
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-5 border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-4">Categories</h3>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className="flex flex-col items-center p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-200 mb-2" />
                    <span className="text-sm font-medium text-slate-700">{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
