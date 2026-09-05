"use client";

import { useRef, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function InvestmentSettingsDialog({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  value: number;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValue = inputRef.current?.valueAsNumber ?? Number.NaN;
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      inputRef.current?.setCustomValidity("请输入大于或等于 0 的有效金额。");
      inputRef.current?.reportValidity();
      return;
    }
    onSave(Math.round(nextValue * 100) / 100);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent onCloseAutoFocus={(event) => {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>('[aria-label="调整净入金"]')?.focus();
      }}>
        <DialogHeader>
          <DialogTitle>调整净入金</DialogTitle>
          <DialogDescription>净入金用于计算累计盈亏和收益率。该设置仅保存在当前设备，不会修改 IBKR 持仓。</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <FieldGroup><Field>
            <FieldLabel htmlFor="net-deposits">当前净入金</FieldLabel>
            <InputGroup>
              <InputGroupAddon>$</InputGroupAddon>
              <InputGroupInput id="net-deposits" autoFocus defaultValue={value.toFixed(2)} inputMode="decimal" min="0" ref={inputRef} required step="0.01" type="number" onInput={() => inputRef.current?.setCustomValidity("")} />
            </InputGroup>
          </Field></FieldGroup>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>取消</Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
