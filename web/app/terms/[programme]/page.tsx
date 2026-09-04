import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { Eyebrow } from "@/components/primitives";
import { getProgrammeTerms, TERMS_SLUG_LIST } from "@/lib/content";

// One page per programme's Terms & Conditions, managed in the CRM.
//
// This is the page the Stripe checkout tick box links to, so it has to be
// reachable without logging in and has to stay at a stable URL. Terms that
// have not been published 404 rather than rendering an empty document —
// showing a blank page headed "Terms & Conditions" would be worse than not
// having one.

export const revalidate = 60;

export async function generateStaticParams() {
  return TERMS_SLUG_LIST.map((programme) => ({ programme }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programme: string }>;
}): Promise<Metadata> {
  const { programme } = await params;
  const terms = await getProgrammeTerms(programme);
  return {
    title: terms?.title ?? "Terms & Conditions",
    description: "The terms that apply to this IFG programme.",
    // A legal document has no business in search results competing with the
    // programme pages themselves.
    robots: { index: false, follow: true },
  };
}

/**
 * Render the terms written in the CRM.
 *
 * The body is HTML from the CRM's rich-text editor, which sanitises on the way
 * in. It is sanitised again here because this is the point where it reaches a
 * visitor's browser, and a page that renders stored HTML should never trust
 * that something upstream already cleaned it.
 *
 * The allowlist matches the editor's: text, structure and links. No images,
 * styles, scripts or iframes — a legal document needs none of them.
 */
function cleanTerms(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u",
      "h2", "h3", "h4", "ul", "ol", "li", "a", "blockquote",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    KEEP_CONTENT: true,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ programme: string }>;
}) {
  const { programme } = await params;
  const terms = await getProgrammeTerms(programme);
  if (!terms) notFound();

  const updated = new Date(terms.updatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <section style={{ padding: "120px 0 48px" }}>
        <div className="c-wrap" style={{ maxWidth: 820 }}>
          <Eyebrow style={{ color: "var(--pitch-400)" }}>The International Football Group</Eyebrow>
          <h1 className="t-h1" style={{ marginTop: 12 }}>
            {terms.title}
          </h1>
          <p style={{ marginTop: 12, opacity: 0.7, fontSize: 14 }}>
            Version {terms.version} · Last updated {updated}
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 96 }}>
        <div
          className="c-wrap terms-body"
          style={{ maxWidth: 820 }}
          dangerouslySetInnerHTML={{ __html: cleanTerms(terms.body) }}
        />
      </section>

      {/* Scoped to .terms-body so the site's own type scale is untouched. */}
      <style>{`
        .terms-body { line-height: 1.75; }
        .terms-body h2 { font-size: 1.5rem; font-weight: 700; margin: 2.2rem 0 0.6rem; }
        .terms-body h3 { font-size: 1.15rem; font-weight: 700; margin: 1.6rem 0 0.5rem; }
        .terms-body h4 { font-size: 1rem; font-weight: 700; margin: 1.3rem 0 0.4rem; }
        .terms-body p { margin: 0 0 1rem; }
        .terms-body ul, .terms-body ol { margin: 0 0 1rem; padding-left: 1.6rem; }
        .terms-body ul { list-style: disc; }
        .terms-body ol { list-style: decimal; }
        .terms-body li { margin: 0.35rem 0; }
        .terms-body a { color: var(--pitch-400, #dc2626); text-decoration: underline; }
        .terms-body blockquote {
          margin: 0 0 1rem; padding-left: 1rem;
          border-left: 3px solid rgba(255,255,255,0.2); opacity: 0.85;
        }
      `}</style>
    </div>
  );
}
