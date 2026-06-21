import { prisma } from "./prisma";
import { DEFAULT_THEME, type Branding } from "./branding-shared";

const KEYS = ["shop.name", "shop.logo", "theme.main", "theme.secondary", "theme.third"];

/**
 * Read branding directly from the DB. Called from the root server layout to
 * inline the theme + shop identity into the initial HTML, eliminating the
 * "default → custom" flick the client used to show while fetching
 * /api/branding after mount.
 *
 * Server-only — never import this from a "use client" file. The Prisma client
 * drags the Postgres driver (pg, which needs Node's `net`/`fs`) into the
 * browser bundle. Pure helpers live in `./branding-shared`.
 */
export async function getBranding(): Promise<Branding> {
  try {
    const rows = await prisma.systemConfig.findMany({ where: { key: { in: KEYS } } });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
      shopName: map["shop.name"] || "ร้านเสริมสวย",
      logoDataUrl: map["shop.logo"] || null,
      theme: {
        main: map["theme.main"] || DEFAULT_THEME.main,
        secondary: map["theme.secondary"] || DEFAULT_THEME.secondary,
        third: map["theme.third"] || DEFAULT_THEME.third,
      },
    };
  } catch {
    return { shopName: "ร้านเสริมสวย", logoDataUrl: null, theme: { ...DEFAULT_THEME } };
  }
}
