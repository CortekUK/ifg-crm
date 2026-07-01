"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { useTheme } from "./theme";
import { MACC_SUBPROGRAMMES } from "@/lib/data";

// Single, consistent site banner (used on every page). "Programmes" is a
// dropdown that goes straight to each programme. Success Stories / Facilities /
// Brochure mirror the banner IFG asked to standardise on.
const PROG_BASE = "/programmes/macclesfield";
const BROCHURE = "https://publuu.com/flip-book/448626/2075544";
const APPLY_HREF = `${PROG_BASE}/apply`;

// Top-level links after the Programmes dropdown. (FAQs lives in the footer.)
const LINKS: [string, string][] = [
  [`${PROG_BASE}/teams`, "Teams"],
  ["/success-stories", "Success Stories"],
  [`${PROG_BASE}/facilities`, "Facilities"],
  ["/news", "Latest News"],
];

export function Header() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [drop, setDrop] = useState(false);
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const subActive = MACC_SUBPROGRAMMES.some((s) => pathname === `${PROG_BASE}/${s.id}`);

  // Close the mobile drawer on route change.
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className={"hdr" + (open ? " menu-open" : "")}>
      <div className="wrap hdr-in">
        <Link href="/" aria-label="IFG home">
          <img className="logo" src="/assets/logo/ifg-wordmark-white.webp" alt="The International Football Group" />
        </Link>
        <nav className="hdr-nav">
          <Link href="/" className={active("/") ? "active" : ""}>Home</Link>
          <div className="nav-drop" onMouseEnter={() => setDrop(true)} onMouseLeave={() => setDrop(false)}>
            <button className={"nav-drop-btn" + (subActive ? " active" : "")} onClick={() => setDrop((d) => !d)} aria-haspopup="true" aria-expanded={drop}>
              Programmes <Icon name="chevron-down" size={15} className="nav-drop-caret" />
            </button>
            {drop && (
              <div className="nav-menu" role="menu">
                {MACC_SUBPROGRAMMES.map((s) => (
                  <Link key={s.id} href={`${PROG_BASE}/${s.id}`} role="menuitem" onClick={() => setDrop(false)}>{s.name}</Link>
                ))}
              </div>
            )}
          </div>
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={active(href) ? "active" : ""}>{label}</Link>
          ))}
          <a href={BROCHURE} target="_blank" rel="noreferrer">Brochure</a>
        </nav>
        <div className="spacer" />
        <div className="hdr-cta">
          <button className="theme-toggle" onClick={toggle} title={theme === "dark" ? "Switch to light" : "Switch to dark"} aria-label="Toggle theme">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          </button>
          <Link href="/contact" className="btn btn-ghost btn-sm hdr-only">Get in touch</Link>
          <Link href={APPLY_HREF} className="btn btn-primary btn-sm hdr-only">Apply Now<Icon name="arrow-right" className="ic" size={18} /></Link>
          <button className="hdr-burger" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            <Icon name={open ? "x" : "menu"} size={22} />
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      <div className={"hdr-drawer" + (open ? " open" : "")}>
        <nav>
          <Link href="/" className={active("/") ? "active" : ""}>Home</Link>
          <span className="hdr-drawer-label">Programmes</span>
          {MACC_SUBPROGRAMMES.map((s) => (
            <Link key={s.id} href={`${PROG_BASE}/${s.id}`} className={"hdr-drawer-sub" + (pathname === `${PROG_BASE}/${s.id}` ? " active" : "")}>{s.name}</Link>
          ))}
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={active(href) ? "active" : ""}>{label}</Link>
          ))}
          <a href={BROCHURE} target="_blank" rel="noreferrer">Brochure</a>
        </nav>
        <div className="hdr-drawer-cta">
          <Link href={APPLY_HREF} className="btn btn-primary">Apply Now<Icon name="arrow-right" className="ic" size={18} /></Link>
          <Link href="/contact" className="btn btn-ghost">Get in touch</Link>
        </div>
      </div>
    </header>
  );
}
