"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { useTheme } from "./theme";
import { MACC_SUBPROGRAMMES } from "@/lib/data";

// Programme-scoped navigation (Macclesfield micro-site). Replaces the global
// header on /programmes/macclesfield routes. "Our Programmes" is a dropdown.
const BASE = "/programmes/macclesfield";
const LINKS: [string, string][] = [
  [BASE, "Home"],
  [`${BASE}/teams`, "Teams"],
  [`${BASE}/success-stories`, "Success Stories"],
  [`${BASE}/facilities`, "Facilities"],
  [`${BASE}/brochure`, "View Brochure"],
];

export function ProgrammeHeader() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [drop, setDrop] = useState(false);
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === BASE ? pathname === BASE : pathname.startsWith(href));
  const subActive = MACC_SUBPROGRAMMES.some((s) => pathname === `${BASE}/${s.id}`);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className={"hdr phdr" + (open ? " menu-open" : "")}>
      <div className="wrap hdr-in">
        <Link href="/" aria-label="IFG home" className="phdr-logos">
          <img className="logo" src="/assets/logo/ifg-wordmark-white.webp" alt="The International Football Group" />
          <span className="phdr-div" />
          <img className="phdr-partner" src="/assets/logo/partners-logos/maccles.png" alt="Macclesfield FC" />
        </Link>
        <nav className="hdr-nav">
          <Link href={BASE} className={active(BASE) ? "active" : ""}>Home</Link>
          <div className="nav-drop" onMouseEnter={() => setDrop(true)} onMouseLeave={() => setDrop(false)}>
            <button className={"nav-drop-btn" + (subActive ? " active" : "")} onClick={() => setDrop((d) => !d)} aria-haspopup="true" aria-expanded={drop}>
              Our Programmes <Icon name="chevron-down" size={15} className="nav-drop-caret" />
            </button>
            {drop && (
              <div className="nav-menu" role="menu">
                {MACC_SUBPROGRAMMES.map((s) => (
                  <Link key={s.id} href={`${BASE}/${s.id}`} role="menuitem" onClick={() => setDrop(false)}>{s.name}</Link>
                ))}
              </div>
            )}
          </div>
          {LINKS.slice(1).map(([href, label]) => (
            <Link key={href} href={href} className={active(href) ? "active" : ""}>{label}</Link>
          ))}
        </nav>
        <div className="spacer" />
        <div className="hdr-cta">
          <button className="theme-toggle" onClick={toggle} title={theme === "dark" ? "Switch to light" : "Switch to dark"} aria-label="Toggle theme">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          </button>
          <Link href={`${BASE}/apply`} className="btn btn-ghost btn-sm hdr-only">Apply Now</Link>
          <button className="hdr-burger" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            <Icon name={open ? "x" : "menu"} size={22} />
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      <div className={"hdr-drawer" + (open ? " open" : "")}>
        <nav>
          <Link href={BASE} className={active(BASE) ? "active" : ""}>Home</Link>
          <span className="hdr-drawer-label">Our Programmes</span>
          {MACC_SUBPROGRAMMES.map((s) => (
            <Link key={s.id} href={`${BASE}/${s.id}`} className={"hdr-drawer-sub" + (pathname === `${BASE}/${s.id}` ? " active" : "")}>{s.name}</Link>
          ))}
          {LINKS.slice(1).map(([href, label]) => (
            <Link key={href} href={href} className={active(href) ? "active" : ""}>{label}</Link>
          ))}
        </nav>
        <div className="hdr-drawer-cta">
          <Link href={`${BASE}/apply`} className="btn btn-primary">Apply Now</Link>
        </div>
      </div>
    </header>
  );
}
