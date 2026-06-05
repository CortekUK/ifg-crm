import Link from "next/link";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";

// Lightweight placeholder for programme sub-pages not yet built out.
export function ComingSoon({ title, eyebrow = "Macclesfield Football Education" }: { title: string; eyebrow?: string }) {
  return (
    <section className="section coming">
      <div className="wrap-tight" style={{ textAlign: "center" }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="t-display" style={{ marginTop: 14 }}>{title}</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 18, lineHeight: 1.6, margin: "18px auto 30px", maxWidth: "46ch" }}>
          This page is coming soon. In the meantime, get in touch and our team will be happy to help.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/contact" className="btn btn-primary btn-lg">Get in touch<Icon name="arrow-right" className="ic" size={20} /></Link>
          <Link href="/programmes/macclesfield" className="btn btn-ghost btn-lg">Back to programme</Link>
        </div>
      </div>
    </section>
  );
}
