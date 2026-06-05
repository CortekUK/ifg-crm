import { Eyebrow, PhotoPlate } from "./primitives";
import { CTABand } from "./sections";
import { VALUES, PARTNERS, mkt } from "@/lib/data";

export function AboutView() {
  return (
    <div>
      <section style={{ position: "relative", minHeight: "56vh", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        <PhotoPlate
          src={mkt(43482)}
          style={{ position: "absolute", inset: 0 }}
          tone="radial-gradient(120% 90% at 70% 0%, rgba(24,193,107,.18), transparent 55%), linear-gradient(160deg,#26332E,#0A0F0E)"
        />
        <div className="wrap" style={{ position: "relative", zIndex: 2, paddingBottom: 64, paddingTop: 130 }}>
          <Eyebrow style={{ color: "var(--pitch-400)" }}>About the group</Eyebrow>
          <h1 className="t-display" style={{ color: "#fff", margin: "18px 0 0", maxWidth: "18ch" }}>Integrating education and football experience</h1>
        </div>
      </section>

      <section className="section band-bone">
        <div className="wrap-tight">
          <p className="t-quote" style={{ color: "var(--slate-900)", margin: 0 }}>
            &ldquo;The International Football Group is forging collaborations with the foremost names in global football.&rdquo;
          </p>
          <p style={{ color: "var(--slate-700)", fontSize: 19, lineHeight: 1.7, marginTop: 28 }}>
            We provide bachelor and master degrees within sport, offering diverse pathways that span football-specific pursuits and broader sports employment opportunities worldwide.
          </p>
          <p style={{ color: "var(--slate-700)", fontSize: 19, lineHeight: 1.7, marginTop: 18 }}>
            As part of our immersive approach, participants have the unique opportunity to explore and live in major European cities while engaging in the distinctive methodologies of world-renowned football clubs.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <Eyebrow>What guides us</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>The player, person, parent, coach &amp; club</h2>
          </div>
          <div className="values">
            {VALUES.map(([n, t, d, vimg]) => (
              <div className="value" key={n}>
                <img className="value-bg" src={vimg} alt="" loading="lazy" />
                <div className="value-in">
                  <div className="vn">{n}</div>
                  <h4>{t}</h4>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 28 }}>
            <Eyebrow>In collaboration with</Eyebrow>
          </div>
          <div className="partners">
            {PARTNERS.map((p) => (
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
