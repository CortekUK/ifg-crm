import type { CSSProperties, ReactNode, MouseEvent } from "react";
import { Icon } from "./icons";

type BtnProps = {
  variant?: "primary" | "ghost" | "solid";
  size?: "lg" | "sm";
  icon?: string;
  iconRight?: string;
  children?: ReactNode;
  onClick?: (e: MouseEvent) => void;
  as?: "button" | "a";
  href?: string;
};

export function Button({ variant = "primary", size, icon, iconRight, children, onClick, as = "button", href }: BtnProps) {
  const cls = ["btn", "btn-" + variant, size ? "btn-" + size : ""].join(" ").trim();
  const inner = (
    <>
      {icon && <Icon name={icon} className="ic" size={size === "lg" ? 20 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} className="ic" size={size === "lg" ? 20 : 18} />}
    </>
  );
  if (as === "a") return <a className={cls} href={href} onClick={onClick}>{inner}</a>;
  return <button className={cls} onClick={onClick}>{inner}</button>;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span className="eyebrow" style={style}>{children}</span>;
}

export function PhotoPlate({
  className = "",
  children,
  src,
  tone,
  label = "",
  overlay = true,
  style = {},
}: {
  className?: string;
  children?: ReactNode;
  src?: string;
  tone?: string;
  label?: string;
  overlay?: boolean;
  style?: CSSProperties;
}) {
  const toneStyle: CSSProperties = tone ? { background: tone } : {};
  return (
    <div className={"photo " + className} style={{ ...toneStyle, ...style }}>
      {src && <img className="ph-img" src={src} alt="" loading="lazy" />}
      {children}
      {overlay && <div className="protect" />}
      {label && <span className="ph-note">{label}</span>}
    </div>
  );
}

export function PlayBadge({ size = 64, onClick }: { size?: number; onClick?: (e: MouseEvent) => void }) {
  return (
    <button className="play-badge" onClick={onClick} style={{ width: size, height: size }} aria-label="Play video">
      <Icon name="play" size={size * 0.36} />
    </button>
  );
}
