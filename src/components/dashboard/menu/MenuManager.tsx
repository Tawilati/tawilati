"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PlusIcon, XIcon } from "@/components/icons";
import { Button, Card, StatusBadge, Toast } from "@/components/ui";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { CategoriesPanel } from "./CategoriesPanel";
import { ItemForm } from "./ItemForm";
import { ItemMenu } from "./ItemMenu";
import {
  formatLBP,
  formatUSD,
  menuApi,
  sentenceFor,
  type Category,
  type ItemInput,
  type MenuItem,
} from "./menuApi";

type Loaded = { categories: Category[]; items: MenuItem[] };
type Notice = { tone: "success" | "error"; title: string };

// The owner's menu screen: items grouped by category, with add/edit, sold-out and archive, plus category management.
export function MenuManager() {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [workingOn, setWorkingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [categories, items] = await Promise.all([
        menuApi.categories(),
        menuApi.items(),
      ]);
      setData({ categories, items });
      setLoadError(null);
    } catch (error) {
      setLoadError(sentenceFor(error));
    }
  }, []);

  useEffect(() => {
    let current = true;
    Promise.all([menuApi.categories(), menuApi.items()])
      .then(([categories, items]) => current && setData({ categories, items }))
      .catch((error) => current && setLoadError(sentenceFor(error)));
    return () => {
      current = false;
    };
  }, []);

  // Runs one change, reloads the lists, and reports the outcome. Returns the error sentence, or null when it worked.
  async function run(
    action: () => Promise<unknown>,
    done: string,
  ): Promise<string | null> {
    try {
      await action();
    } catch (error) {
      const sentence = sentenceFor(error);
      setNotice({ tone: "error", title: sentence });
      return sentence;
    }
    setNotice({ tone: "success", title: done });
    await load();
    return null;
  }

  async function onItemAction(
    item: MenuItem,
    action: () => Promise<unknown>,
    done: string,
  ) {
    setWorkingOn(item.id);
    await run(action, done);
    setWorkingOn(null);
  }

  async function saveItem(input: ItemInput): Promise<string | null> {
    const current = editing;
    const error =
      current && current !== "new"
        ? await run(() => menuApi.updateItem(current.id, input), "Item saved")
        : await run(() => menuApi.addItem(input), "Item added");
    if (!error) setEditing(null);
    return error;
  }

  // A notice fades away by itself: quickly for a success, a little slower for an error to read.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => setNotice(null),
      notice.tone === "error" ? 7000 : 3500,
    );
    return () => clearTimeout(timer);
  }, [notice]);

  // The page title, with the owner's two main actions on the same row (top right).
  const heading = (actions?: ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Menu</h1>
      {actions}
    </div>
  );

  if (loadError) {
    return (
      <div className="flex flex-col gap-6">
        {heading()}
        <Card className="flex flex-col items-start gap-3">
          <Toast tone="error" title={loadError} />
          <Button onClick={() => void load()}>Try again</Button>
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        {heading()}
        <p role="status" className="text-sm text-ink-muted">
          Loading your menu…
        </p>
      </div>
    );
  }

  const { categories, items } = data;
  const archivedCount = items.filter((item) => item.archivedAt).length;
  const visible = items.filter(
    (item) =>
      (showArchived || !item.archivedAt) &&
      (filter === "all" || item.categoryId === filter),
  );

  const panel = (
    <CategoriesPanel
      categories={categories}
      onAdd={(name) => run(() => menuApi.addCategory(name), "Category added")}
      onRename={(id, name) =>
        run(() => menuApi.renameCategory(id, name), "Category renamed")
      }
      onDelete={(id) =>
        run(() => menuApi.deleteCategory(id), "Category deleted")
      }
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {heading(
        categories.length > 0 && !editing && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              aria-expanded={showCategories}
              onClick={() => setShowCategories((open) => !open)}
            >
              Categories
            </Button>
            <Button
              onClick={() => {
                setNotice(null);
                setEditing("new");
              }}
            >
              <PlusIcon className="size-5" /> Add item
            </Button>
          </div>
        ),
      )}

      {notice && (
        <div
          className="fixed inset-x-3 z-50 sm:left-auto sm:right-6 sm:w-72"
          style={{ top: "max(12px, env(safe-area-inset-top, 0px))" }}
        >
          <div className="relative shadow-[var(--shadow-raised)] [&_.tw-toast]:items-center [&_.tw-toast]:gap-3 [&_.tw-toast]:py-2.5 [&_.tw-toast]:pl-3 [&_.tw-toast]:pr-10 [&_.tw-toast\_\_mark]:size-7! [&_.tw-toast\_\_mark_svg]:size-4! [&_.tw-toast\_\_title]:text-sm!">
            <Toast tone={notice.tone} title={notice.title} />
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setNotice(null)}
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>
      )}

      {deleting && (
        <Card
          className="flex flex-col gap-3"
          role="alertdialog"
          aria-label={`Delete ${deleting.name}`}
        >
          <p className="font-semibold">Delete {deleting.name}?</p>
          <p className="text-sm text-ink-muted">
            This removes it from the menu for good. If it has ever been ordered,
            archive it instead.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              loading={workingOn === deleting.id}
              onClick={async () => {
                const item = deleting;
                setWorkingOn(item.id);
                await run(() => menuApi.deleteItem(item.id), "Item deleted");
                setWorkingOn(null);
                setDeleting(null);
              }}
            >
              Delete item
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {categories.length === 0 && (
        <>
          <p className="text-ink-muted">
            Start by adding a category, like Hot drinks or Desserts. Then you
            can add items to it.
          </p>
          {panel}
        </>
      )}

      {categories.length === 0 ? null : editing ? (
        <ItemForm
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          categories={categories}
          defaultCategoryId={filter === "all" ? undefined : filter}
          onSave={saveItem}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <CategoryTabs
            categories={[{ id: "all", name: "All" }, ...categories]}
            activeId={filter}
            onSelect={setFilter}
          />
        </>
      )}

      {categories.length > 0 && showCategories && !editing && panel}

      {visible.length === 0 && categories.length > 0 && !editing && (
        <Card>
          <p className="text-sm text-ink-muted">
            No items here yet. Tap “Add item” to create one.
          </p>
        </Card>
      )}

      <ul
        role="tabpanel"
        id={`panel-${filter}`}
        aria-labelledby={`tab-${filter}`}
        className="flex flex-col gap-2.5"
      >
        {visible.map((item) => {
          const archived = item.archivedAt !== null;
          const busy = workingOn === item.id;
          return (
            <li
              key={item.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border-subtle p-4 ${
                item.soldOut || archived ? "bg-surface-muted" : "bg-surface"
              }`}
            >
              <div className="order-1 flex min-w-0 flex-1 basis-44 flex-col gap-0.5">
                <p
                  className={`text-base font-semibold ${item.soldOut || archived ? "text-ink-muted" : "text-ink"}`}
                >
                  {item.name}
                </p>
                <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                  <span
                    className={`text-[17px] font-bold ${item.soldOut || archived ? "text-ink-muted" : "text-ink"}`}
                  >
                    {formatUSD(item.priceUSD)}
                  </span>
                  <span className="text-[13px] text-ink-muted">
                    {formatLBP(item.priceLBP)}
                  </span>
                </p>
              </div>
              <div className="order-3 flex basis-full items-center justify-end gap-2 sm:order-2 sm:basis-auto">
                {item.soldOut && (
                  <StatusBadge status="SOLD_OUT" className="shrink-0" />
                )}
                {archived && (
                  <StatusBadge status="CLOSED" className="shrink-0">
                    Archived
                  </StatusBadge>
                )}
                {!archived && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-11 border-transparent! bg-primary-tint! hover:bg-[#D3E2D7]!"
                    loading={busy}
                    onClick={() =>
                      onItemAction(
                        item,
                        () =>
                          menuApi.updateItem(item.id, {
                            soldOut: !item.soldOut,
                          }),
                        item.soldOut
                          ? "Back on the menu"
                          : "Marked as sold out",
                      )
                    }
                  >
                    {item.soldOut ? "Back in stock" : "Mark sold out"}
                  </Button>
                )}
              </div>
              <div className="order-2 -mr-2 -mt-1 self-start sm:order-3 sm:m-0 sm:self-center">
                <ItemMenu
                  itemName={item.name}
                  actions={
                    archived
                      ? [
                          {
                            label: "Restore",
                            onSelect: () =>
                              onItemAction(
                                item,
                                () => menuApi.unarchiveItem(item.id),
                                "Item restored",
                              ),
                          },
                          {
                            danger: true,
                            label: "Delete",
                            onSelect: () => {
                              setNotice(null);
                              setDeleting(item);
                            },
                          },
                        ]
                      : [
                          {
                            label: "Edit",
                            onSelect: () => {
                              setNotice(null);
                              setEditing(item);
                            },
                          },
                          {
                            label: "Archive",
                            onSelect: () =>
                              onItemAction(
                                item,
                                () => menuApi.archiveItem(item.id),
                                "Item archived",
                              ),
                          },
                          {
                            danger: true,
                            label: "Delete",
                            onSelect: () => {
                              setNotice(null);
                              setDeleting(item);
                            },
                          },
                        ]
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>

      {archivedCount > 0 && (
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => setShowArchived((shown) => !shown)}
        >
          {showArchived
            ? "Hide archived items"
            : `Show archived items (${archivedCount})`}
        </Button>
      )}
    </div>
  );
}
