import Link from "next/link";
import { SocialIcon } from "./icons";
import { SOCIALS } from "@/lib/data";

export function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr-grid">
          <div>
            <img src="/assets/logo/ifg-wordmark-white.webp" alt="IFG" style={{ height: 56, marginBottom: 18 }} />
            <p style={{ color: "var(--fg-muted)", maxWidth: 320, fontSize: 15, margin: 0 }}>
              World-class football education and experiences — integrating degrees with the methodologies of world-renowned clubs.
            </p>
            <div className="social">
              {SOCIALS.map(([name, icon, , href]) => (
                <a key={name} href={href} target="_blank" rel="noreferrer" title={name} aria-label={name}>
                  <SocialIcon name={icon} size={17} />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h5>Programmes</h5>
            <Link href="/programmes/juventus">Juventus Training Experience</Link>
            <Link href="/programmes/macclesfield">Macclesfield Football Education</Link>
            <Link href="/programmes/phoenix">Phoenix City UAE</Link>
          </div>
          <div>
            <h5>Media</h5>
            <Link href="/news">Latest News</Link>
            <Link href="/ifg-tv">IFG TV</Link>
            <Link href="/gallery">Gallery</Link>
            <Link href="/success-stories">Success Stories</Link>
          </div>
          <div>
            <h5>Group</h5>
            <Link href="/about">About</Link>
            <Link href="/contact">Get in touch</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
        <div className="ftr-base">
          <span>© {new Date().getFullYear()} The International Football Group</span>
          <span>#IFG · World-class football education</span>
        </div>
      </div>
    </footer>
  );
}
