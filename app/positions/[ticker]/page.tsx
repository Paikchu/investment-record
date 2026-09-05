import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getD1 } from "@/db";
import { getHoldingPlan, type HoldingPlanRecord } from "@/lib/holding-plan-store";
import { findSecurity, portfolioViewModel } from "@/lib/site-data";
import { normalizeTicker } from "@/lib/symbol-directory";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { PositionDetailContent } from "./PositionDetailContent";

export const dynamic = "force-dynamic";

export default async function PositionPage({ params }: { params: Promise<{ ticker: string }> }) {
  const ticker = normalizeTicker((await params).ticker);
  const security = findSecurity(ticker);
  if (!security) notFound();
  const user = await requireChatGPTUser(`/positions/${encodeURIComponent(ticker)}`);
  const position = portfolioViewModel.positionGroups.find((group) => group.symbol === ticker);
  let plan: HoldingPlanRecord | null = null;
  let planUnavailable = false;
  try {
    plan = await getHoldingPlan(await getD1(), user.email, ticker);
  } catch {
    planUnavailable = true;
  }

  return (
    <main className="detail-shell">
      <Button variant="ghost" asChild className="mb-4"><Link href="/#ledger-title">← 返回投资账本</Link></Button>
      <PositionDetailContent
        companyName={security.name}
        plan={plan}
        planStatus={planUnavailable ? "unavailable" : "ready"}
        position={position}
        ticker={ticker}
      />
    </main>
  );
}
