"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { useTheme } from "./theme";
import { MACC_SUBPROGRAMMES } from "@/lib/data";

// Single, consistent site banner (used on every page). Two clean dropdowns keep
// the bar uncluttered: "Programmes" (the three programmes only) and "Explore"
// (supporting pages). Brochure + FAQs live in the footer.
const PROG_BASE = "/programmes/macclesfield";
const APPLY_HREF = `${PROG_BASE}/apply`;

const PROGRAMMES: [string, string][] = MACC_SUBPROGRAMMES.map((s) => [`${PROG_BASE}/${s.id}`, s.name]);
const EXPLORE: [string, string][] = [
  [`${PROG_BASE}/teams`, "Teams"],
  [`${PROG_BASE}/facilities`, "Facilities"],
  ["/gallery", "Gallery"],
];
// Top-level links after the two dropdowns.
const LINKS: [string, string][] = [
  ["/success-stories", "Success Stories"],
  ["/news", "Latest News"],
];

// Desktop hover/click dropdown.
function NavDropdown({ label, items, pathname }: { label: string; items: [string, string][]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const active = items.some(([href]) => pathname === href || pathname.startsWith(href + "/"));
  return (
    <div className="nav-drop" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className={"nav-drop-btn" + (active ? " active" : "")} onClick={() => setOpen((d) => !d)} aria-haspopup="true" aria-expanded={open}>
        {label} <Icon name="chevron-down" size={15} className="nav-drop-caret" />
      </button>
      {open && (
        <div className="nav-menu" role="menu">
          {items.map(([href, text]) => (
            <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)}>{text}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

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
          <NavDropdown label="Programmes" items={PROGRAMMES} pathname={pathname} />
          <NavDropdown label="Explore" items={EXPLORE} pathname={pathname} />
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={active(href) ? "active" : ""}>{label}</Link>
          ))}
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
          {PROGRAMMES.map(([href, text]) => (
            <Link key={href} href={href} className={"hdr-drawer-sub" + (pathname === href ? " active" : "")}>{text}</Link>
          ))}
          <span className="hdr-drawer-label">Explore</span>
          {EXPLORE.map(([href, text]) => (
            <Link key={href} href={href} className={"hdr-drawer-sub" + (active(href) ? " active" : "")}>{text}</Link>
          ))}
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={active(href) ? "active" : ""}>{label}</Link>
          ))}
        </nav>
        <div className="hdr-drawer-cta">
          <Link href={APPLY_HREF} className="btn btn-primary">Apply Now<Icon name="arrow-right" className="ic" size={18} /></Link>
          <Link href="/contact" className="btn btn-ghost">Get in touch</Link>
        </div>
      </div>
    </header>
  );
}
