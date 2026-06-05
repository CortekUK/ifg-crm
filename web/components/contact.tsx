"use client";
import { useState } from "react";
import { Eyebrow, Button } from "./primitives";
import { Icon } from "./icons";
import { Select } from "./select";
import { PROGRAMMES, VIDEO_SRC, VIDEO_POSTER } from "@/lib/data";

const PROGRAMME_OPTIONS = [...PROGRAMMES.map((p) => p.name), "General enquiry"];

const EMAIL = "info@theinternationalfootballgroup.com";
const PHONE = "0161 808 0252";

type Form = { name: string; email: string; phone: string; programme: string; message: string };

export function ContactView() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState<Form>({ name: "", email: "", phone: "", programme: PROGRAMMES[0].name, message: "" });
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire to CRM / email endpoint. For now, confirm receipt locally.
    setSent(true);
  };

  return (
    <div>
      {/* hero */}
      <section className="c-hero">
        <video className="hero-video" data-hero-video src={VIDEO_SRC} poster={VIDEO_POSTER} autoPlay muted loop playsInline />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>Get in touch</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 14 }}>Get in touch</h1>
          <span className="c-hero-cue"><Icon name="arrow-right" size={22} style={{ transform: "rotate(90deg)" }} /></span>
        </div>
      </section>

      {/* details + form */}
      <section className="section">
        <div className="wrap contact-grid">
          <div data-anim="up">
            <Eyebrow>Contact us</Eyebrow>
            <h2 className="t-h1" style={{ margin: "14px 0 0" }}>Unforgettable football experiences</h2>
            <p style={{ color: "var(--fg-muted)", fontSize: 18, lineHeight: 1.7, marginTop: 20 }}>
              The International Football Group is forging collaborations with the foremost names in global football, integrating education and football experience.
            </p>
            <p style={{ color: "var(--fg-muted)", fontSize: 18, lineHeight: 1.7, marginTop: 14 }}>
              To hear more about our programmes please get in touch using the details below or the form.
            </p>
            <div className="contact-methods">
              <a className="cmethod" href={`mailto:${EMAIL}`}>
                <span className="cmethod-ic"><Icon name="mail" size={22} /></span>
                <span><span className="cmethod-l">Email now</span><span className="cmethod-v">{EMAIL}</span></span>
              </a>
              <a className="cmethod" href={`tel:${PHONE.replace(/\s/g, "")}`}>
                <span className="cmethod-ic"><Icon name="phone" size={22} /></span>
                <span><span className="cmethod-l">Call now</span><span className="cmethod-v">{PHONE}</span></span>
              </a>
            </div>
          </div>

          <div data-anim="up">
            {sent ? (
              <div className="contact-ok glass">
                <div className="contact-ok-ic"><Icon name="check" size={32} /></div>
                <h3 className="t-h2">Message sent</h3>
                <p style={{ color: "var(--fg-muted)", margin: "12px auto 0", maxWidth: "40ch" }}>
                  Thank you{form.name ? ", " + form.name.split(" ")[0] : ""}. Our team will be in touch shortly about the {form.programme}.
                </p>
              </div>
            ) : (
              <form className="contact-form glass" onSubmit={submit}>
                <div className="field"><label>Full name</label><input required value={form.name} placeholder="Marco Rossi" onChange={(e) => set("name", e.target.value)} /></div>
                <div className="grid-2" style={{ gap: 18 }}>
                  <div className="field"><label>Email</label><input required type="email" value={form.email} placeholder="you@email.com" onChange={(e) => set("email", e.target.value)} /></div>
                  <div className="field"><label>Phone</label><input value={form.phone} placeholder="+44 …" onChange={(e) => set("phone", e.target.value)} /></div>
                </div>
                <div className="field">
                  <label>Programme of interest</label>
                  <Select value={form.programme} options={PROGRAMME_OPTIONS} onChange={(v) => set("programme", v)} />
                </div>
                <div className="field"><label>Message</label><textarea required value={form.message} placeholder="Tell us a little about yourself and what you're interested in…" onChange={(e) => set("message", e.target.value)} /></div>
                <Button variant="primary" size="lg" iconRight="arrow-right">Send message</Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
