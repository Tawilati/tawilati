"use client";

import { useState } from "react";
import { PlusIcon } from "@/components/icons";
import { AddButton, Button, QuantityStepper } from "@/components/ui";

// The interactive pieces of the style guide: a button that shows its loading state, and a working stepper.
export function LoadingButtonDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      loading={loading}
      onClick={() => {
        setLoading(true);
        setTimeout(() => setLoading(false), 1500);
      }}
    >
      Send order
    </Button>
  );
}

export function StepperDemo() {
  const [quantity, setQuantity] = useState(0);
  return quantity === 0 ? (
    <AddButton itemName="Cappuccino" onClick={() => setQuantity(1)} />
  ) : (
    <QuantityStepper
      itemName="Cappuccino"
      value={quantity}
      onDecrease={() => setQuantity((q) => q - 1)}
      onIncrease={() => setQuantity((q) => q + 1)}
    />
  );
}

export function SmallIconButtonDemo() {
  return (
    <Button size="sm">
      <PlusIcon className="size-5" />
      New item
    </Button>
  );
}
