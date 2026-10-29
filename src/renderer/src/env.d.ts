import type { StockForgeApi } from '@shared/types'

declare global {
  interface Window {
    stockforge: StockForgeApi
  }
}

export {}
