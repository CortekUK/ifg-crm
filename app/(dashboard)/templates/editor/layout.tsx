export default function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This layout removes the dashboard sidebar for the full-page editor
  return (
    <div className="fixed inset-0 z-50 bg-white">
      {children}
    </div>
  )
}
