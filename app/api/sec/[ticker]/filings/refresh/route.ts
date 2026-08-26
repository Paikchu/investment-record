import { getChatGPTUser } from "@/app/chatgpt-auth";

export async function POST(_request: Request, context: { params: Promise<{ ticker: string }> }) {
  if (!await getChatGPTUser()) return Response.json({ error: "登录状态已失效。" }, { status: 401 });
  await context.params;
  return Response.json({ error: "旧站 SEC 写入已停用。" }, { status: 410 });
}
