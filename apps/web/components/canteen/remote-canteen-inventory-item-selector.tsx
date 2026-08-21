"use client";

import { useCallback } from "react";
import type { RemoteLookupPage } from "@schoolos/core";
import {
  canteenApi,
  type CanteenInventoryItem,
} from "../../lib/canteen-api";
import { RemoteCombobox } from "../ui/remote-combobox";

const INVENTORY_OPTIONS_QUERY_KEY = ["remote-canteen-inventory-items"] as const;

type RemoteCanteenInventoryItemSelectorProps = {
  value: string;
  onChange: (
    inventoryItemId: string,
    option: CanteenInventoryItem | null,
  ) => void;
  selectedOption?: CanteenInventoryItem | null;
  selectedLabel?: string;
  label?: string;
  disabled?: boolean;
  clearable?: boolean;
};

export function RemoteCanteenInventoryItemSelector({
  value,
  onChange,
  selectedOption,
  selectedLabel,
  label = "Stock item",
  disabled,
  clearable,
}: RemoteCanteenInventoryItemSelectorProps) {
  const loadPage = useCallback(
    async ({
      search,
      page,
      limit,
      signal,
    }: {
      search: string;
      page: number;
      limit: number;
      signal: AbortSignal;
    }): Promise<RemoteLookupPage<CanteenInventoryItem>> => {
      const result = await canteenApi.listInventoryItems(
        { query: search, page, limit },
        signal,
      );
      const responsePage = result.meta?.page ?? page;
      const responseLimit = result.meta?.limit ?? limit;
      const total = result.meta?.total ?? result.items.length;
      return {
        items: result.items,
        page: responsePage,
        limit: responseLimit,
        total,
        hasNextPage: responsePage * responseLimit < total,
      };
    },
    [],
  );

  return (
    <RemoteCombobox
      value={value}
      selectedOption={selectedOption}
      selectedLabel={selectedLabel}
      onChange={onChange}
      queryKey={INVENTORY_OPTIONS_QUERY_KEY}
      loadPage={loadPage}
      getOptionLabel={(option) => option.name}
      getOptionDescription={(option) =>
        [option.sku, option.category, option.unit].filter(Boolean).join(" · ")
      }
      label={label}
      placeholder="Search for a stock item"
      searchPlaceholder="Type an item name or SKU…"
      noResultsMessage="No stock items match this search."
      errorMessage="Stock items could not be loaded."
      disabled={disabled}
      clearable={clearable}
    />
  );
}
