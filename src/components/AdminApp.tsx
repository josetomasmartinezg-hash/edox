import { AdminPanel } from './AdminPanel'
import { AdminSales } from './AdminSales'

export function AdminApp() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/admin/ventas') return <AdminSales />
  return <AdminPanel />
}
