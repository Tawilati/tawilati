"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, TextField } from "@/components/ui";
import type { Category } from "./menuApi";

// Add, rename and delete categories. `onChange` runs the call and returns an error sentence (or null when it worked).
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
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string>();
  const [renaming, setRenaming] = useState<{
    id: string;
    name: string;
    error?: string;
  } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!newName.trim())
      return setAddError("Enter a category name, like Hot drinks.");
    setBusy(true);
    const error = await onAdd(newName.trim());
    setBusy(false);
    setAddError(error ?? undefined);
    if (!error) setNewName("");
  }

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!renaming) return;
    if (!renaming.name.trim())
      return setRenaming({ ...renaming, error: "Enter a category name." });
    setBusy(true);
    const error = await onRename(renaming.id, renaming.name.trim());
    setBusy(false);
    if (error) setRenaming({ ...renaming, error });
    else setRenaming(null);
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    const error = await onDelete(id);
    setBusy(false);
    if (!error) setConfirmingDelete(null);
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Categories</h2>
      <p className="text-sm text-ink-muted">Only empty categories can be deleted. Item counts include archived items.</p>
      <fieldset disabled={busy} className="contents">

      {categories.length === 0 && (
        <p className="text-sm text-ink-muted">
          Add your first category, then put items in it.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-border-subtle">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex flex-wrap items-center gap-2 py-2"
          >
            {renaming?.id === category.id ? (
              <form
                onSubmit={rename}
                className="flex w-full flex-wrap items-end gap-2"
              >
                <TextField
                  label="Category name"
                  className="min-w-0 flex-1"
                  value={renaming.name}
                  error={renaming.error}
                  maxLength={50}
                  autoFocus
                  onChange={(e) =>
                    setRenaming({ id: category.id, name: e.target.value })
                  }
                />
                <Button type="submit" size="sm" loading={busy}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRenaming(null)}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {category.name}
                </span>
                <span className="text-sm text-ink-muted">
                  {category.itemCount}{" "}
                  {category.itemCount === 1 ? "item" : "items"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRenaming({ id: category.id, name: category.name })
                  }
                >
                  Rename
                </Button>
                {category.itemCount === 0 &&
                  (confirmingDelete === category.id ? (
                    <>
                    <Button
                      size="sm"
                      variant="accent"
                      loading={busy}
                      onClick={() => remove(category.id)}
                    >
                      Confirm delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmingDelete(category.id)}
                    >
                      Delete
                    </Button>
                  ))}
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <TextField
          label="New category"
          className="min-w-0 flex-1"
          value={newName}
          error={addError}
          maxLength={50}
          placeholder="Hot drinks"
          onChange={(e) => {
            setNewName(e.target.value);
            setAddError(undefined);
          }}
        />
        <Button type="submit" loading={busy}>
          Add category
        </Button>
      </form>
      </fieldset>
    </Card>
  );
}
