"use client";

import { useState, type FormEvent } from "react";
import { Button, SelectField, TextField, useModalGuard } from "@/components/ui";
import {
  parsePriceUSD,
  priceHint,
  type Category,
  type ItemInput,
  type MenuItem,
} from "./menuApi";

// Add or edit one item. The LBP price is worked out by the server from the USD price and the business rate.
export function ItemForm({
  item,
  categories,
  defaultCategoryId,
  onSave,
}: {
  item: MenuItem | null;
  categories: Category[];
  defaultCategoryId?: string;
  onSave: (input: ItemInput) => Promise<string | null>;
}) {
  const initial = {
    name: item?.name ?? "",
    price: item ? Number(item.priceUSD).toFixed(2) : "",
    categoryId: item?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  };
  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState(initial.price);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [errors, setErrors] = useState<{
    name?: string;
    price?: string;
    category?: string;
    form?: string;
  }>({});
  const [pending, setPending] = useState(false);
  const requestClose = useModalGuard(
    name !== initial.name || price !== initial.price || categoryId !== initial.categoryId,
  );

  // Shown while typing; on submit the same field also catches an empty price.
  const livePriceError = priceHint(price);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const priceUSD = parsePriceUSD(price);
    const next = {
      name: name.trim() ? undefined : "Enter the item name, like Flat white.",
      price: priceUSD ? undefined : "Enter a price in USD, like 3.50.",
      category: categories.some((category) => category.id === categoryId) ? undefined : "Pick a category.",
    };
    if (next.name || next.price || next.category) return setErrors(next);

    setPending(true);
    const error = await onSave({
      name: name.trim(),
      categoryId,
      priceUSD: priceUSD!,
    });
    setPending(false);
    setErrors({ form: error ?? undefined });
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <fieldset disabled={pending} className="contents">
        <TextField
          label="Name"
          value={name}
          error={errors.name}
          maxLength={100}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((current) => ({ ...current, name: undefined, form: undefined }));
          }}
        />
        <TextField
          label="Price (USD)"
          inputMode="decimal"
          value={price}
          error={livePriceError ?? errors.price}
          hint="The Lebanese pound price follows your exchange rate."
          onChange={(e) => {
            setPrice(e.target.value);
            setErrors((current) => ({ ...current, price: undefined, form: undefined }));
          }}
        />
        <SelectField
          label="Category"
          value={categoryId}
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          error={errors.category}
          onChange={(id) => {
            setCategoryId(id);
            setErrors((current) => ({ ...current, category: undefined, form: undefined }));
          }}
        />
        {errors.form && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {errors.form}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {item ? "Save changes" : "Add item"}
          </Button>
          <Button variant="ghost" onClick={requestClose}>
            Cancel
          </Button>
        </div>
        </fieldset>
      </form>
    </>
  );
}
