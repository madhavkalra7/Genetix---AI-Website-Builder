import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppBaseUrl, getShareUrl, getSharedProjectView } from "@/modules/share/server/utils";
import { ShareView } from "@/modules/share/ui/share-view";

// Share state and the latest version change at any time — never serve a cached copy.
export const dynamic = "force-dynamic";

interface Props {
    params: Promise<{ shareId: string }>;
}

// Dedupes the DB lookup between generateMetadata and the page render.
const loadView = cache((shareId: string) => getSharedProjectView(shareId));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { shareId } = await params;
    const view = await loadView(shareId);
    if (!view) {
        return {
            title: "Project not found — Genetix",
            robots: { index: false, follow: false },
        };
    }

    const title = `${view.projectName} — made with Genetix`;
    const description = `"${view.projectName}" by ${view.author}. View it live and remix your own copy with Genetix, the AI website builder.`;

    return {
        metadataBase: new URL(getAppBaseUrl()),
        title,
        description,
        alternates: { canonical: getShareUrl(shareId) },
        openGraph: {
            type: "website",
            siteName: "Genetix",
            title,
            description,
            url: getShareUrl(shareId),
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
        },
    };
}

export default async function SharePage({ params }: Props) {
    const { shareId } = await params;
    const view = await loadView(shareId);
    if (!view) notFound();

    return (
        <ShareView
            shareId={shareId}
            projectName={view.projectName}
            author={view.author}
            techStack={view.techStack}
            files={view.files}
            hasVersion={view.hasVersion}
        />
    );
}
