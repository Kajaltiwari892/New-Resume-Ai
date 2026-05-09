"use client";
import Link from "next/link";
import { FileSearch } from "lucide-react";

type BrandMarkProps = {
  href?: string | null;
  className?: string;
  iconSize?: number;
  style?: React.CSSProperties;
};

/**
 * Shared brand glyph + "ResumeIQ" wordmark.
 * Pass `href={null}` to render as a non-clickable span (useful inside dashboards).
 */
export default function BrandMark({
  href = "/",
  className = "lp-brand",
  iconSize = 17,
  style,
}: BrandMarkProps) {
  const content = (
    <>
      <span className="lp-brand-icon" aria-hidden>
        <FileSearch size={iconSize} strokeWidth={1.8} />
      </span>
      ResumeIQ
    </>
  );

  if (!href) {
    return (
      <span className={className} style={style}>
        {content}
      </span>
    );
  }

  return (
    <Link className={className} href={href} style={style}>
      {content}
    </Link>
  );
}
