import { notFound } from 'next/navigation'
import { getCmsPage } from '@/lib/website-content/pages'
import { PageWorkspace } from '@/components/website-content/PageWorkspace'

export default async function CmsEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!getCmsPage(slug)) notFound()
  return <PageWorkspace slug={slug} />
}
