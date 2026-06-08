"use client";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Button, PhotoPlate } from "./primitives";
import { mkt, type Programme } from "@/lib/data";

export function ProgrammeCard({ p }: { p: Programme }) {
  const router = useRouter();
  return (
    <article className="pcard" onClick={() => router.push("/programmes/" + p.id)}>
      <PhotoPlate className="pc-photo" src={p.img} tone={p.tone}>
        <span className="pc-tag">{p.tag}</span>
        <span className="pc-loc"><Icon name="map-pin" size={14} />{p.loc}</span>
      </PhotoPlate>
      <div className="pc-body">
        <h3>{p.name}</h3>
        <p>{p.short}</p>
        <span className="pc-more">Discover the programme <Icon name="arrow-right" size={15} /></span>
      </div>
    </article>
  );
}

export function CTABand() {
  const router = useRouter();
  return (
    <section className="section cta-band">
      <img className="cta-bg" src={mkt(43484)} alt="" loading="lazy" />
      <div className="cta-overlay" />
      <div className="wrap cta-in" data-anim="up">
        <span className="cta-eyebrow"><i />Start your journey</span>
        <h2 className="t-display cta-title" data-anim="reveal-title">Begin your pathway</h2>
        <p className="cta-sub">Apply to train inside world-class methodologies and graduate with an accredited degree — living in Europe&apos;s great cities.</p>
        <div className="cta-actions">
          <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push("/contact")}>Get in touch</Button>
          <Button variant="ghost" size="lg" onClick={() => router.push("/programmes")}>Explore programmes</Button>
        </div>
        <div className="cta-foot">
          <span><Icon name="check" size={15} />Accredited degrees</span>
          <span><Icon name="check" size={15} />World-renowned partners</span>
          <span><Icon name="check" size={15} />Live across Europe</span>
        </div>
      </div>
    </section>
  );
}

export function StatItem({ v, l }: { v: string; l: string }) {
  const m = String(v).match(/^(\d+)(\D*)$/);
  const numProps = m ? { "data-count": m[1], "data-suffix": m[2] } : {};
  return (
    <div className="stat">
      <div className="sv" {...numProps}>{v}</div>
      <div className="sl">{l}</div>
    </div>
  );
}
