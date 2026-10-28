"use client";

import { MinusIcon, PlusIcon } from "@/components/icons";

// Round green + shown before an item is in the cart. 44px for a comfortable thumb.
export function AddButton({ itemName, onClick, disabled }: { itemName: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="tw-add" aria-label={`Add ${itemName}`} onClick={onClick} disabled={disabled}>
      <PlusIcon className="size-6" />
    </button>
  );
}

// − 2 + once the item is in the cart. Going below 1 is the caller's "remove from cart".
export function QuantityStepper({
  itemName,
  value,
  max = 99,
  onDecrease,
  onIncrease,
}: {
  itemName: string;
  value: number;
  max?: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="tw-stepper">
      <button type="button" className="tw-stepper__btn" aria-label={`One less ${itemName}`} onClick={onDecrease}>
        <MinusIcon className="size-5" />
      </button>
      <span className="tw-stepper__value" aria-live="polite" aria-label={`${value} × ${itemName}`}>
        {value}
      </span>
      <button
        type="button"
        className="tw-stepper__btn"
        aria-label={`One more ${itemName}`}
        onClick={onIncrease}
        disabled={value >= max}
      >
        <PlusIcon className="size-5" />
      </button>
    </div>
  );
}
