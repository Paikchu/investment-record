export async function POST() {
  return Response.json({ error: "旧站 SEC 写入已停用。" }, { status: 410 });
}
