"use client";

import { useCallback } from "react";
import type { RemoteLookupPage } from "@schoolos/core";
import {
  canteenApi,
  type CanteenSupplier,
} from "../../lib/canteen-api";
import { RemoteCombobox } from "../ui/remote-combobox";

const SUPPLIER_OPTIONS_QUERY_KEY = ["remote-canteen-suppliers"] as const;

type RemoteCanteenSupplierSelectorProps = {
  value: string;
  onChange: (supplierId: string, option: CanteenSupplier | null) => void;
  selectedOption?: CanteenSupplier | null;
  selectedLabel?: string;
  label?: string;
  disabled?: boolean;
  clearable?: boolean;
};

export function RemoteCanteenSupplierSelector({
  value,
  onChange,
  selectedOption,
  selectedLabel,
  label = "Supplier",
  disabled,
  clearable,
}: RemoteCanteenSupplierSelectorProps) {
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
    }): Promise<RemoteLookupPage<CanteenSupplier>> => {
      const result = await canteenApi.listSuppliers(
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
      queryKey={SUPPLIER_OPTIONS_QUERY_KEY}
      loadPage={loadPage}
      getOptionLabel={(option) => option.name}
      getOptionDescription={(option) =>
        [option.contactName, option.phone].filter(Boolean).join(" · ")
      }
      label={label}
      placeholder="Search for a supplier"
      searchPlaceholder="Type a supplier name…"
      noResultsMessage="No suppliers match this search."
      errorMessage="Suppliers could not be loaded."
      disabled={disabled}
      clearable={clearable}
    />
  );
}
