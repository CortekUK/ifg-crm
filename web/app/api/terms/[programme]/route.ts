import { NextResponse } from "next/server";
import { getProgrammeTerms, termsProgrammeKey } from "@/lib/content";

/**
 * Whether a programme has published Terms & Conditions, for the deposit
 * dialogue's tick box.
 *
 * The dialogue needs to know three things before it can ask anyone to agree:
 * that terms exist, where they are, and which version is being agreed to. It
 * does NOT need the text, so this returns none of it — the customer reads that
 * on the terms page itself.
 *
 * `published: false` means the tick box is not shown at all. Requiring
 * agreement to a document that has not been written would either block every
 * payment or link to a page that 404s.
 */
// Never cached: this answer decides whether the payment dialogue shows a
// required tick box, and three separately-cached responses from three
// different moments is how one programme reported published while another
// reported draft.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ programme: string }> },
) {
  const { programme } = await context.params;

  // `programme` here is the deposit key (residency/university), but the terms
  // pages are addressed by slug, so accept either.
  const slug =
    termsProgrammeKey(programme) !== null
      ? programme
      : programme === "residency"
        ? "summer-residency"
        : programme === "gapyear"
          ? "gap-year"
          : programme;

  const terms = await getProgrammeTerms(slug);

  if (!terms) {
    return NextResponse.json({ published: false });
  }

  return NextResponse.json({
    published: true,
    version: terms.version,
    url: `/terms/${slug}`,
    title: terms.title,
  });
}
