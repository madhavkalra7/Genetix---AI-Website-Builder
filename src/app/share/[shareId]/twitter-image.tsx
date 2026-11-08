// X/Twitter card for /share/[shareId]: same artwork as the OpenGraph image.
// Route segment config must be declared literally in each file (it can't be re-exported).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "A project made with Genetix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export { default } from "./opengraph-image";
