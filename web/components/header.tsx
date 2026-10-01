"use client";
import { useState, useEffect, useRef } from "react";
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
  ["/id-clinics", "ID Clinics"],
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

// Mobile drawer group: a tappable heading that expands to its sub-pages.
function DrawerGroup({ id, label, items, isOpen, onToggle, isActive }: {
  id: string; label: string; items: [string, string][];
  isOpen: boolean; onToggle: () => void; isActive: (href: string) => boolean;
}) {
  const current = items.some(([href]) => isActive(href));
  return (
    <div className={"hdr-drawer-group" + (isOpen ? " open" : "")}>
      <button className={"hdr-drawer-row" + (current ? " active" : "")} onClick={onToggle} aria-expanded={isOpen} aria-controls={id}>
        {label}
        <Icon name="chevron-down" size={18} className="hdr-drawer-caret" />
      </button>
      <div id={id} className="hdr-drawer-subs" hidden={!isOpen}>
        {items.map(([href, text]) => (
          <Link key={href} href={href} className={isActive(href) ? "active" : ""} aria-current={isActive(href) ? "page" : undefined}>{text}</Link>
        ))}
      </div>
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const inGroup = (items: [string, string][]) => items.some(([href]) => active(href));

  // Close the mobile drawer on route change.
  useEffect(() => { setOpen(false); }, [pathname]);

  // While the drawer is open: pin it from the header's bottom edge to the bottom of
  // the screen, freeze the page behind it (Lenis smooth-scroll ignores overflow,
  // so it is paused too), and let Escape close it.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const bottom = headerRef.current?.getBoundingClientRect().bottom ?? 0;
      document.documentElement.style.setProperty("--hdr-bottom", `${Math.max(0, bottom)}px`);
    };
    place();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("resize", place);
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("nav-open");
    window.__lenis?.stop();
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("nav-open");
      window.__lenis?.start();
    };
  }, [open]);

  const openMenu = () => {
    // Expand the group holding the current page so the user sees where they are.
    setGroup(inGroup(PROGRAMMES) ? "programmes" : inGroup(EXPLORE) ? "explore" : null);
    setOpen(true);
  };
  const toggleGroup = (g: string) => setGroup((cur) => (cur === g ? null : g));

  return (
    <header ref={headerRef} className={"hdr" + (open ? " menu-open" : "")}>
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
          <button className="hdr-burger" onClick={() => (open ? setOpen(false) : openMenu())} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="hdr-drawer">
            <Icon name={open ? "x" : "menu"} size={22} />
          </button>
        </div>
      </div>

      {/* mobile drawer: fills the screen below the header; the page behind stays still */}
      <div id="hdr-drawer" className={"hdr-drawer" + (open ? " open" : "")} aria-hidden={!open}>
        <div className="hdr-drawer-links" role="navigation" aria-label="Main" data-lenis-prevent>
          <Link href="/" className={"hdr-drawer-row" + (active("/") ? " active" : "")}>Home</Link>
          <DrawerGroup id="drawer-programmes" label="Programmes" items={PROGRAMMES} isOpen={group === "programmes"} onToggle={() => toggleGroup("programmes")} isActive={(h) => pathname === h || pathname.startsWith(h + "/")} />
          <DrawerGroup id="drawer-explore" label="Explore" items={EXPLORE} isOpen={group === "explore"} onToggle={() => toggleGroup("explore")} isActive={active} />
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={"hdr-drawer-row" + (active(href) ? " active" : "")}>{label}</Link>
          ))}
        </div>
      </div>
    </header>
  );
}
