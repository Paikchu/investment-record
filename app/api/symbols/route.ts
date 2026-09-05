import { getChatGPTUser } from "@/app/chatgpt-auth";
import { buildPortfolioViewModel } from "@/lib/portfolio-view-model";
import { currentPortfolioSnapshot, symbolDirectory } from "@/lib/site-data";
import { searchSecurities, type SymbolDirectoryEntry } from "@/lib/symbol-directory";

export async function GET(request: Request) {
  const portfolioViewModel = buildPortfolioViewModel(await currentPortfolioSnapshot());
  if (!await getChatGPTUser()) return Response.json({ error: "未登录。" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const heldSymbols = new Set(portfolioViewModel.positionGroups.map((group) => group.symbol));
  const directorySymbols = new Set(symbolDirectory.securities.map((security) => security.symbol));
  const searchEntries = [
    ...symbolDirectory.securities,
    ...portfolioViewModel.positionGroups
      .filter((group) => !directorySymbols.has(group.symbol))
      .map((group): SymbolDirectoryEntry => ({ symbol: group.symbol, name: group.name, exchange: "IBKR", type: "stock" })),
  ];
  return Response.json({
    results: searchSecurities(searchEntries, query, heldSymbols, 10),
    directoryUpdatedAt: symbolDirectory.generatedAt,
  });
}
