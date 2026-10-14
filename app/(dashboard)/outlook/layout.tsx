/**
 * The mailbox takes the whole window.
 *
 * Same approach as the template editor: a fixed, full-screen layer over the
 * dashboard chrome. A mail client competing with the CRM sidebar, the global
 * search, Scout, the notification bell and the theme toggle has no room left
 * for the thing people came for — and two search boxes on one screen is a
 * genuine trap, because the wrong one silently searches the wrong thing.
 *
 * The "← CRM" button in the top bar is the way back.
 */
export default function OutlookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 overflow-hidden">
      {children}
    </div>
  )
}
