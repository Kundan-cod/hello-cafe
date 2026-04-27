import Dexie, { type Table } from 'dexie'

export class CafeDatabase extends Dexie {
  menuCategories!: Table
  menuItems!: Table
  orders!: Table
  areas!: Table
  dineTables!: Table
  combos!: Table
  customers!: Table
  staff!: Table
  branches!: Table
  discounts!: Table
  vendors!: Table
  inventoryProducts!: Table
  tenant!: Table
  syncQueue!: Table
  syncMeta!: Table

  constructor() {
    super('cafe-local')
    this.version(1).stores({
      menuCategories: 'id',
      menuItems: 'id, categoryId',
      orders: 'id, status, createdAt',
      areas: 'id',
      dineTables: 'id, areaId',
      combos: 'id',
      customers: 'id, type',
      staff: 'id, branchId, role',
      branches: 'id',
      discounts: 'id',
      vendors: 'id',
      inventoryProducts: 'id',
      tenant: 'id',
      syncQueue: '++id',
      syncMeta: 'storeName',
    })
  }
}

export const db = new CafeDatabase()
