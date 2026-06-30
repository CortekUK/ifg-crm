"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { useTheme } from "./theme";

const LINKS: [string, string][] = [
  ["/", "Home"],
  ["/programmes", "Programmes"],
  ["/success-stories", "Success Stories"],
  ["/id-clinics", "ID Clinics"],
  ["/ifg-tv", "IFG TV"],
  ["/news", "Latest News"],
];

// Prospect application (the 3 programme forms). Primary CTA for new visitors —
// same destination as the Macclesfield micro-site's "Apply Now".
const APPLY_HREF = "/programmes/macclesfield/apply";

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
