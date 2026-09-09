import { getD1 } from "@/db";
import { listHoldingPlans } from "@/lib/holding-plan-store";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const plans = await listHoldingPlans(await getD1());
    return Response.json({ plans }, { headers });
  } catch {
    return Response.json({ error: "计划暂时无法读取，请稍后重试。" }, { status: 500, headers });
  }
}
