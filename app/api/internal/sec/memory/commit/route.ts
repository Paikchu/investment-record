export async function POST() {
  return Response.json({ error: "旧站 SEC Pipeline 已停用。" }, { status: 410 });
}
