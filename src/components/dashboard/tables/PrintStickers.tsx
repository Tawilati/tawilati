"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, PrinterIcon } from "@/components/icons";
import { Button, Card, Toast } from "@/components/ui";
import { stickerUrl, tableSentenceFor, tablesApi, type DiningTable } from "./tablesApi";

// Six stickers per A4 sheet (2 x 3), with dashed lines to cut along.
const PER_SHEET = 6;

// Print all: every table that takes orders, as A4 sheets of stickers. The browser's Print window prints them or
// saves a PDF. The staff menus are hidden when printing (print:!hidden in StaffShell), so only the sheets come out.
export function PrintStickers() {
  const [tables, setTables] = useState<DiningTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    let current = true;
    tablesApi
      .list()
      .then((list) => current && setTables(list.filter((table) => !table.isDisabled)))
      .catch((failure) => current && setError(tableSentenceFor(failure)));
    return () => {
      current = false;
    };
  }, []);

  const sheets: DiningTable[][] = [];
  for (let i = 0; tables && i < tables.length; i += PER_SHEET) sheets.push(tables.slice(i, i + PER_SHEET));
  // Print only once every sticker has arrived, or the sheet comes out with blank spots.
  const ready = !!tables && tables.length > 0 && loaded >= tables.length;

  return (
    <div className="flex flex-col gap-6">
      {/* A4 with 10 mm margins; each sheet is one page. */}
      <style>{`@page { size: A4; margin: 10mm; }`}</style>

      <div className="flex flex-col gap-4 print:hidden">
        <Link href="/dashboard/tables" className="flex min-h-11 items-center gap-2 self-start font-semibold text-primary">
          <ArrowLeftIcon className="size-5" /> Back to tables
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-xl flex-col gap-1">
            <h1 className="text-2xl font-bold">Print table stickers</h1>
            <p className="text-[15px] text-ink-muted">
              Six stickers per A4 page. Cut along the dashed lines. Disabled tables are left out. To get a PDF instead,
              choose &ldquo;Save as PDF&rdquo; in the Print window.
            </p>
          </div>
          <Button onClick={() => window.print()} disabled={!ready} className="w-full sm:w-auto">
            <PrinterIcon className="size-5" /> {ready || !tables ? "Print" : `Preparing ${loaded} of ${tables.length}…`}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="flex flex-col items-start gap-3 print:hidden">
          <Toast tone="error" title={error} />
        </Card>
      )}
      {!tables && !error && (
        <p role="status" className="text-sm text-ink-muted print:hidden">
          Loading your tables…
        </p>
      )}
      {tables?.length === 0 && (
        <Card className="print:hidden">
          <p className="text-sm text-ink-muted">
            No tables are taking orders, so there&apos;s nothing to print. Add a table or enable one first.
          </p>
        </Card>
      )}

      {sheets.map((sheet, index) => (
        <section
          key={index}
          aria-label={`Page ${index + 1} of ${sheets.length}`}
          className="mx-auto grid aspect-[190/277] w-full max-w-[640px] grid-cols-2 grid-rows-3 border border-dashed border-border-strong bg-surface shadow-[var(--shadow-raised)] print:aspect-auto print:h-[277mm] print:w-[190mm] print:max-w-none print:break-after-page print:shadow-none print:last:break-after-auto"
        >
          {sheet.map((table) => (
            <div key={table.id} className="flex items-center justify-center border-r border-b border-dashed border-border-strong p-[4%] print:p-0 [&:nth-child(2n)]:border-r-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- a PNG made by our API, printed as-is */}
              <img
                src={stickerUrl(table)}
                alt={`QR sticker for ${table.label}`}
                className="h-full max-h-full w-auto object-contain print:h-[84mm]"
                onLoad={() => setLoaded((count) => count + 1)}
                onError={() => setError("A sticker didn't load. Refresh the page to try again.")}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
