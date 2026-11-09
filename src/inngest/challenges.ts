import { inngest } from "./client";
import {
    awardChallenge,
    ensureCurrentChallenge,
    findUnawardedEndedChallenges,
} from "@/modules/challenges/server/service";

/**
 * Hourly: make sure this week's challenge exists, then pay out any ended, un-awarded challenges.
 * Each payout is idempotent (claimed via `awardedAt` inside a transaction), so retries and
 * overlapping runs are safe.
 */
export const challengesCronFunction = inngest.createFunction(
    { id: "weekly-challenges-cron", concurrency: { limit: 1 } },
    { cron: "TZ=UTC 5 * * * *" },
    async ({ step }) => {
        const current = await step.run("ensure-current-challenge", async () => {
            const challenge = await ensureCurrentChallenge();
            return { id: challenge.id, slug: challenge.slug };
        });

        const ended = await step.run("find-ended-challenges", () => findUnawardedEndedChallenges());

        const results = [];
        for (const challenge of ended) {
            results.push(
                await step.run(`award-${challenge.slug}`, () => awardChallenge(challenge.id))
            );
        }

        return { current, awarded: results };
    }
);
