"use client";

import { useLanguage } from "@/app/language-provider";
import { Badge } from "@/components/ui/badge";
import { number } from "@/lib/portfolio-format";
import { daysToExpiry, optionMoneyness, optionSide, parseOptionContract, strikeLabel } from "@/lib/option-contract";

/**
 * One contract written as instrument, level and clock instead of a broker string:
 * `PUT $180  2027-01-15 128天  卖出 1 张`.
 * Colour stays reserved for profit and loss, so type and side read through shape and weight;
 * the expiry turns red only inside its final week, and the moneyness flag appears only when in the money.
 * `quantity` adds the side chip, `asOf` adds the countdown, and an unparsed label falls back to the raw string.
 */
export function OptionContractLabel({ contract, quantity, underlyingPrice, asOf }: {
  contract: string;
  quantity?: number;
  underlyingPrice?: number;
  asOf?: string;
}) {
  const { t } = useLanguage();
  const detail = parseOptionContract(contract);
  const size = quantity === undefined ? null : (
    <span className="option-size" data-side={optionSide(quantity)}>
      <b>{optionSide(quantity) === "short" ? t("卖出") : t("买入")}</b>
      {number(Math.abs(quantity), 0, 4)}{t(" 张")}
    </span>
  );

  if (!detail) return <span className="option-contract"><strong>{contract}</strong>{size}</span>;

  const remaining = asOf ? daysToExpiry(detail.expiry, asOf) : null;
  return (
    <span className="option-contract">
      <Badge variant="secondary" className="option-right">{detail.right === "put" ? "PUT" : "CALL"}</Badge>
      <strong className="option-strike">{strikeLabel(detail.strike)}</strong>
      <span className="option-expiry" data-near={remaining !== null && remaining <= 7 ? "true" : undefined}>
        {detail.expiry}
        {remaining !== null && <small>{remaining < 0 ? t("已到期") : `${number(remaining, 0, 0)}${t("天")}`}</small>}
      </span>
      {optionMoneyness(detail, underlyingPrice) === "itm" && <Badge variant="outline" className="option-moneyness">{t("价内")}</Badge>}
      {size}
    </span>
  );
}
