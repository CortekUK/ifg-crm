import { Eyebrow, PhotoPlate } from "./primitives";
import { CTABand } from "./sections";
import { ABOUT } from "@/lib/data";

export function AboutView({ data }: { data?: typeof ABOUT }) {
  const a = data ?? ABOUT;
  return (
    <div>
      <section style={{ position: "relative", minHeight: "56vh", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        <PhotoPlate
          src={a.hero.image}
          style={{ position: "absolute", inset: 0 }}
          tone="radial-gradient(120% 90% at 70% 0%, rgba(24,193,107,.18), transparent 55%), linear-gradient(160deg,#26332E,#0A0F0E)"
        />
        <div className="wrap" style={{ position: "relative", zIndex: 2, paddingBottom: 64, paddingTop: 130 }}>
          <Eyebrow style={{ color: "var(--pitch-400)" }}>{a.hero.eyebrow}</Eyebrow>
          <h1 className="t-display" style={{ color: "#fff", margin: "18px 0 0", maxWidth: "18ch" }}>{a.hero.heading}</h1>
        </div>
      </section>

      <section className="section band-bone">
        <div className="wrap-tight">
          <p className="t-quote" style={{ color: "var(--slate-900)", margin: 0 }}>
            &ldquo;{a.intro.quote}&rdquo;
          </p>
          {a.intro.paragraphs.map((p, i) => (
            <p key={i} style={{ color: "var(--slate-700)", fontSize: 19, lineHeight: 1.7, marginTop: i === 0 ? 28 : 18 }}>{p}</p>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <Eyebrow>{a.guides.eyebrow}</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>{a.guides.heading}</h2>
          </div>
          <div className="values">
            {a.guides.cards.map((v) => (
              <div className="value" key={v.n}>
                <img className="value-bg" src={v.img} alt="" loading="lazy" />
                <div className="value-in">
                  <div className="vn">{v.n}</div>
                  <h4>{v.title}</h4>
                  <p>{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 28 }}>
            <Eyebrow>{a.partnersEyebrow}</Eyebrow>
          </div>
          <div className="partners">
            {a.partners.map((p) => (
              <div className="partner" key={p.name} title={p.name}>
                <img className="partner-logo" src={p.logo} alt={p.name} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
