import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
 * Render the plain text IFG pastes into the CRM.
 *
 * Deliberately not a markdown library: this is one legal document, the only
 * formatting anyone needs is headings and paragraphs, and a dependency that
 * renders arbitrary HTML into a page is the wrong thing to reach for when the
 * input is pasted from a Word document.
 */
function renderBody(body: string) {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      if (block.startsWith("#")) {
        const text = block.replace(/^#+\s*/, "");
        return (
          <h2 key={i} style={{ marginTop: 32, marginBottom: 8 }} className="t-h4">
            {text}
          </h2>
        );
      }
      return (
        <p key={i} style={{ marginBottom: 16, lineHeight: 1.7 }}>
          {block.split("\n").map((line, j, all) => (
            <span key={j}>
              {line}
              {j < all.length - 1 && <br />}
            </span>
          ))}
        </p>
      );
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
        <div className="c-wrap" style={{ maxWidth: 820 }}>
          {renderBody(terms.body)}
        </div>
      </section>
    </div>
  );
}
