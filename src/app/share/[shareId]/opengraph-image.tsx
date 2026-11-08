import { ImageResponse } from "next/og";
import { getSharedProjectSummary } from "@/modules/share/server/utils";

// Prisma needs Node.js — never run this on the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "A project made with Genetix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = { shareId: string };

const clamp = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`);

export default async function Image({ params }: { params: Promise<Params> | Params }) {
    const { shareId } = await params;

    let projectName = "Built with AI in minutes";
    let author: string | null = null;
    try {
        const summary = await getSharedProjectSummary(shareId);
        if (summary) {
            projectName = summary.projectName;
            author = summary.author;
        }
    } catch (error) {
        // Fall back to the generic card rather than failing the crawler request.
        console.error("[share og-image] lookup failed:", error);
    }

    const title = clamp(projectName, 70);
    const titleSize = title.length > 40 ? 58 : title.length > 22 ? 70 : 84;

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "56px 64px",
                    color: "white",
                    fontFamily: "sans-serif",
                    background:
                        "radial-gradient(circle at 15% 10%, rgba(168,85,247,0.55), transparent 45%), radial-gradient(circle at 90% 90%, rgba(59,130,246,0.45), transparent 50%), linear-gradient(135deg, #07030f 0%, #12082a 55%, #050510 100%)",
                }}
            >
                {/* Brand row */}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 26,
                            fontWeight: 800,
                            background: "linear-gradient(135deg, #a855f7, #6366f1)",
                        }}
                    >
                        G
                    </div>
                    <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>GENETIX</div>
                </div>

                {/* Browser-window frame with the project name */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 24,
                        border: "2px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,255,255,0.06)",
                        boxShadow: "0 30px 80px rgba(88,28,135,0.45)",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "16px 22px",
                            borderBottom: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(0,0,0,0.35)",
                        }}
                    >
                        <div style={{ width: 16, height: 16, borderRadius: 8, background: "#ff5f57" }} />
                        <div style={{ width: 16, height: 16, borderRadius: 8, background: "#febc2e" }} />
                        <div style={{ width: 16, height: 16, borderRadius: 8, background: "#28c840" }} />
                        <div
                            style={{
                                display: "flex",
                                marginLeft: 18,
                                padding: "6px 18px",
                                borderRadius: 999,
                                fontSize: 20,
                                color: "rgba(255,255,255,0.6)",
                                background: "rgba(255,255,255,0.08)",
                            }}
                        >
                            {`genetix/share/${shareId.slice(0, 12)}`}
                        </div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            minHeight: 250,
                            padding: "36px 44px",
                            fontSize: titleSize,
                            fontWeight: 800,
                            lineHeight: 1.1,
                            letterSpacing: -1,
                        }}
                    >
                        {title}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28 }}>
                    <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ color: "#c084fc", fontWeight: 700 }}>Made with Genetix</span>
                        {author ? <span style={{ color: "rgba(255,255,255,0.7)" }}>{`· by ${clamp(author, 30)}`}</span> : null}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            padding: "10px 24px",
                            borderRadius: 999,
                            fontSize: 24,
                            fontWeight: 700,
                            background: "linear-gradient(90deg, #a855f7, #6366f1)",
                        }}
                    >
                        View &amp; remix →
                    </div>
                </div>
            </div>
        ),
        size
    );
}
