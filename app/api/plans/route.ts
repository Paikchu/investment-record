import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1 } from "@/db";
import { listHoldingPlans } from "@/lib/holding-plan-store";

export async function GET() {
  const user = await getChatGPTUser();
  const headers = { "Cache-Control": "private, no-store" };
  if (!user) return Response.json({ plans: [] }, { headers });
  try {
    const plans = await listHoldingPlans(await getD1(), user.email);
    return Response.json({ plans }, { headers });
  } catch {
    return Response.json({ error: "计划暂时无法读取，请稍后重试。" }, { status: 500, headers });
  }
}
