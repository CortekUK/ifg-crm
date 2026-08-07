import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/primitives";
import { Icon } from "@/components/icons";
import { getBrochures } from "@/lib/content";

export const metadata: Metadata = { title: "Brochures · Macclesfield" };

const LABEL: Record<string, string> = {
  summer: "Summer Residency",
  university: "University",
  "gap-year": "Gap Year",
};

export default async function Page() {
  const brochures = await getBrochures();

  return (
    <section className="section">
      <div className="wrap">
        <div style={{ textAlign: "center", maxWidth: "60ch", margin: "0 auto 40px" }}>
          <Eyebrow>Macclesfield Football Education</Eyebrow>
          <h1 className="t-display" style={{ marginTop: 14 }}>Programme Brochures</h1>
          <p style={{ color: "var(--fg-muted)", fontSize: 18, lineHeight: 1.6, marginTop: 16 }}>
            Explore our programmes in detail. Choose a brochure to view it as a flipbook.
          </p>
        </div>

        {brochures.length === 0 ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "var(--fg-muted)", fontSize: 18, marginBottom: 24 }}>
              Our brochures are being updated. Get in touch and we&apos;ll send you the latest.
            </p>
            <Link href="/contact" className="btn btn-primary btn-lg">
              Get in touch<Icon name="arrow-right" className="ic" size={20} />
            </Link>
          </div>
        ) : (
          <div className="bro-grid">
            {brochures.map((b) => (
              <Link key={b.program} href={`/programmes/macclesfield/brochure/${b.program}`} className="bro-card">
                <div className="bro-card-cover">
                  {b.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.coverImage} alt="" />
                  ) : (
                    <div className="bro-card-cover--empty"><Icon name="download" size={28} /></div>
                  )}
                </div>
                <div className="bro-card-body">
                  <span className="bro-card-kicker">{LABEL[b.program] ?? b.program}</span>
                  <h3 className="bro-card-title">{b.title}</h3>
                  {b.description && <p className="bro-card-sub">{b.description}</p>}
                  <span className="bro-card-cta">View brochure <Icon name="arrow-right" className="ic" size={16} /></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
