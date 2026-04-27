import CategoryList from '@/components/menu/CategoryList'

export default function Page() {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Menu & Categories</h1>
      <CategoryList />
    </div>
  )
}