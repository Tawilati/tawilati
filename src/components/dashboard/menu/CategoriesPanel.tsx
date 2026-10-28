"use client";

import { useState, type FormEvent } from "react";
import { Button, ConfirmDialog, Modal, TextField, useModalGuard } from "@/components/ui";
import { ItemMenu } from "./ItemMenu";
import type { Category } from "./menuApi";

// The categories as pills: name, item count and a three-dots menu (Rename, and Delete while the category is empty).
// Add, rename and delete each open their own pop-up. The `on…` callbacks run the call and return an error sentence,
// or null when it worked. The caller decides where this sits: inside a pop-up, or on the page while there are none yet.
export function CategoriesPanel({
  categories,
  onAdd,
  onRename,
  onDelete,
}: {
  categories: Category[];
  onAdd: (name: string) => Promise<string | null>;
  onRename: (id: string, name: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  function openNameForm(category: Category | null) {
    setRenaming(category);
    setAdding(category === null);
  }

  function closeNameForm() {
    setAdding(false);
    setRenaming(null);
  }

  // Returns the error sentence to show under the field, or null when it worked (and the pop-up closes).
  async function submitName(name: string): Promise<string | null> {
    if (busy) return null;
    setBusy(true);
    const error = renaming ? await onRename(renaming.id, name) : await onAdd(name);
    setBusy(false);
    if (!error) closeNameForm();
    return error;
  }

  async function confirmDelete(category: Category) {
    if (busy) return;
    setBusy(true);
    const error = await onDelete(category.id);
    setBusy(false);
    if (!error) setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        {categories.length === 0
          ? "Add your first category, then put items in it."
          : "Only empty categories can be deleted. Counts include archived items."}
      </p>

      <ul className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex min-h-11 max-w-full items-center gap-2 rounded-full bg-primary py-px pl-4 pr-1 text-on-primary"
          >
            <span className="min-w-0 truncate font-semibold">{category.name}</span>
            <span
              className={`rounded-full px-2 text-xs font-bold tabular-nums ${
                category.itemCount === 0 ? "bg-white/20 text-on-primary" : "bg-surface text-primary"
              }`}
              title={`${category.itemCount} ${category.itemCount === 1 ? "item" : "items"}`}
            >
              {category.itemCount}
            </span>
            <div className="[&_button[aria-haspopup]]:size-9 [&_button[aria-haspopup]]:text-on-primary [&_button[aria-haspopup]]:hover:bg-white/15">
              <ItemMenu
                itemName={category.name}
                actions={[
                  { label: "Rename", onSelect: () => openNameForm(category) },
                  ...(category.itemCount === 0
                    ? [{ label: "Delete", danger: true, onSelect: () => setDeleting(category) }]
                    : []),
                ]}
              />
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => openNameForm(null)}
            className="flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-dashed border-primary px-4 font-semibold text-primary hover:bg-primary-tint"
          >
            + Add category
          </button>
        </li>
      </ul>

      {(adding || renaming) && (
        <Modal title={renaming ? "Rename category" : "Add a category"} locked={busy} onClose={closeNameForm}>
          <NameForm
            initialName={renaming?.name ?? ""}
            submitLabel={renaming ? "Save" : "Add category"}
            busy={busy}
            onSubmit={submitName}
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete category"
          loading={busy}
          onConfirm={() => confirmDelete(deleting)}
          onCancel={() => setDeleting(null)}
        >
          It has no items, so nothing on your menu changes.
        </ConfirmDialog>
      )}
    </div>
  );
}

// The name field of the add and rename pop-ups.
function NameForm({
  initialName,
  submitLabel,
  busy,
  onSubmit,
}: {
  initialName: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();
  const requestClose = useModalGuard(name !== initialName);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError("Enter a category name, like Hot drinks.");
    setError((await onSubmit(name.trim())) ?? undefined);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextField
        label="Category name"
        value={name}
        error={error}
        maxLength={50}
        placeholder="Hot drinks"
        onChange={(e) => {
          setName(e.target.value);
          setError(undefined);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={requestClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
