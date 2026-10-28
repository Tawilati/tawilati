"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, TextField } from "@/components/ui";
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
  onCancel,
}: {
  item: MenuItem | null;
  categories: Category[];
  defaultCategoryId?: string;
  onSave: (input: ItemInput) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(
    item ? Number(item.priceUSD).toFixed(2) : "",
  );
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [errors, setErrors] = useState<{
    name?: string;
    price?: string;
    category?: string;
    form?: string;
  }>({});
  const [pending, setPending] = useState(false);

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
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">
        {item ? "Edit item" : "Add an item"}
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <fieldset disabled={pending} className="contents">
        <TextField
          label="Name"
          value={name}
          error={errors.name}
          maxLength={100}
          autoFocus
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
        <div className="tw-field">
          <label className="tw-field__label" htmlFor="item-category">
            Category
          </label>
          <div className="tw-field__control">
            <select
              id="item-category"
              className="tw-field__input"
              value={categoryId}
              aria-invalid={errors.category ? true : undefined}
              aria-describedby={errors.category ? "item-category-error" : undefined}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setErrors((current) => ({ ...current, category: undefined, form: undefined }));
              }}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          {errors.category && (
            <span id="item-category-error" className="tw-field__hint text-danger">
              {errors.category}
            </span>
          )}
        </div>
        {errors.form && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {errors.form}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {item ? "Save changes" : "Add item"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        </fieldset>
      </form>
    </Card>
  );
}
