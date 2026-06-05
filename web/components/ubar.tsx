import Link from "next/link";
import { Icon, SocialIcon } from "./icons";
import { SOCIALS } from "@/lib/data";

export function Ubar() {
  return (
    <div className="ubar">
      <div className="wrap ubar-in">
        <a className="left-extra" href="mailto:info@theinternationalfootballgroup.com">
          <Icon name="mail" size={14} className="le-ic" />
          <strong style={{ color: "var(--fg)" }}>IFG Office:</strong> info@theinternationalfootballgroup.com
        </a>
        <Link className="ubar-ann" href="/contact">
          <span className="ann-live"><i />Now enrolling</span>
          <span className="ann-text">2026/27 programmes are open — secure your place</span>
          <Icon name="arrow-right" size={13} className="ann-go" />
        </Link>
        <div className="soc">
          <span className="soc-label">Follow us</span>
          {SOCIALS.map(([name, icon, , href]) => (
            <a key={name} href={href} target="_blank" rel="noreferrer" title={name} aria-label={name} className="soc-ic">
              <SocialIcon name={icon} size={15} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
