export async function POST() {
  return Response.json({ error: "旧站 SEC 模型密钥桥接已停用。" }, { status: 410 });
}
