"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import type { RemoteLookupPage } from "@schoolos/core";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

const REMOTE_SEARCH_DEBOUNCE_MS = 350;

type RemoteComboboxPageRequest = {
  search: string;
  page: number;
  limit: number;
  signal: AbortSignal;
};

type RemoteComboboxProps<TOption extends { id: string }> = {
  value: string;
  selectedOption?: TOption | null;
  selectedLabel?: string;
  onChange: (value: string, option: TOption | null) => void;
  queryKey: QueryKey;
  loadPage: (
    request: RemoteComboboxPageRequest,
  ) => Promise<RemoteLookupPage<TOption>>;
  getOptionLabel: (option: TOption) => string;
  getOptionDescription?: (option: TOption) => string | null;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  noResultsMessage: string;
  errorMessage: string;
  disabled?: boolean;
  clearable?: boolean;
  hideLabel?: boolean;
  className?: string;
  minimumSearchLength?: number;
  pageSize?: number;
};

export function RemoteCombobox<TOption extends { id: string }>({
  value,
  selectedOption,
  selectedLabel,
  onChange,
  queryKey,
  loadPage,
  getOptionLabel,
  getOptionDescription,
  label,
  placeholder,
  searchPlaceholder,
  noResultsMessage,
  errorMessage,
  disabled = false,
  clearable = true,
  hideLabel = false,
  className,
  minimumSearchLength = 2,
  pageSize = 25,
}: RemoteComboboxProps<TOption>) {
  const instanceId = useId();
  const triggerId = `${instanceId}-trigger`;
  const searchId = `${instanceId}-search`;
  const listboxId = `${instanceId}-listbox`;
  const statusId = `${instanceId}-status`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [retainedOption, setRetainedOption] = useState<TOption | null>(
    selectedOption ?? null,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      REMOTE_SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const canSearch = debouncedSearch.length >= minimumSearchLength;
  const optionsQuery = useInfiniteQuery({
    queryKey: [...queryKey, debouncedSearch],
    queryFn: ({ pageParam, signal }) =>
      loadPage({
        search: debouncedSearch,
        page: pageParam,
        limit: pageSize,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    enabled: isOpen && canSearch,
    retry: false,
    staleTime: 30_000,
  });

  const options = useMemo(
    () => optionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [optionsQuery.data],
  );

  useEffect(() => {
    if (!value) {
      setRetainedOption(null);
      return;
    }

    if (selectedOption?.id === value) {
      setRetainedOption(selectedOption);
      return;
    }

    const matchingOption = options.find((option) => option.id === value);
    if (matchingOption) {
      setRetainedOption(matchingOption);
    }
  }, [options, selectedOption, value]);

  const currentOption =
    retainedOption?.id === value
      ? retainedOption
      : selectedOption?.id === value
        ? selectedOption
        : null;
  const activeOption = options[activeIndex] ?? null;

  function openCombobox() {
    if (disabled) return;
    setSearch("");
    setDebouncedSearch("");
    setActiveIndex(0);
    setIsOpen(true);
  }

  function closeCombobox() {
    setIsOpen(false);
    setSearch("");
    setDebouncedSearch("");
  }

  function selectOption(option: TOption) {
    setRetainedOption(option);
    onChange(option.id, option);
    closeCombobox();
    triggerRef.current?.focus();
  }

  function clearSelection() {
    setRetainedOption(null);
    onChange("", null);
    closeCombobox();
    triggerRef.current?.focus();
  }

  function handleContainerBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      closeCombobox();
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openCombobox();
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        options.length === 0 ? 0 : Math.min(current + 1, options.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      selectOption(activeOption);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeCombobox();
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      className={cn("relative space-y-1.5", className)}
      onBlur={handleContainerBlur}
    >
      <label
        htmlFor={triggerId}
        className={cn(
          "text-sm font-semibold text-slate-700",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>

      <div className="relative">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          onClick={() => (isOpen ? closeCombobox() : openCombobox())}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm transition focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            clearable && value ? "pr-20" : "pr-10",
          )}
        >
          <span
            className={cn(
              "truncate",
              !currentOption && !selectedLabel && "text-slate-400",
            )}
          >
            {currentOption
              ? getOptionLabel(currentOption)
              : value && selectedLabel
                ? selectedLabel
                : placeholder}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "absolute right-3 h-4 w-4 text-slate-400 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>

        {clearable && value && !disabled ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={clearSelection}
            className="absolute right-10 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="absolute left-0 right-0 z-40 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={searchInputRef}
              id={searchId}
              role="combobox"
              aria-label={`Search ${label.toLowerCase()}`}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={options.length > 0 ? listboxId : statusId}
              aria-activedescendant={
                activeOption ? `${listboxId}-option-${activeIndex}` : undefined
              }
              aria-describedby={statusId}
              aria-busy={optionsQuery.isFetching}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-[var(--primary)] focus:bg-white focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>

          <div id={statusId} aria-live="polite" className="sr-only">
            {!canSearch
              ? `Type at least ${minimumSearchLength} characters to search.`
              : optionsQuery.isPending
                ? "Loading results."
                : optionsQuery.isError
                  ? errorMessage
                  : `${options.length} results loaded.`}
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto">
            {!canSearch ? (
              <p className="px-3 py-6 text-center text-xs font-semibold text-slate-500">
                Type at least {minimumSearchLength} characters to search.
              </p>
            ) : optionsQuery.isPending ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs font-semibold text-slate-500">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Loading results…
              </div>
            ) : optionsQuery.isError ? (
              <div role="alert" className="space-y-3 px-3 py-5 text-center">
                <p className="text-xs font-semibold text-red-700">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={() => void optionsQuery.refetch()}
                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                >
                  Retry
                </button>
              </div>
            ) : options.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs font-semibold text-slate-500">
                {noResultsMessage}
              </p>
            ) : (
              <>
                <div id={listboxId} role="listbox" aria-label={label}>
                  {options.map((option, index) => {
                    const isSelected = option.id === value;
                    const description = getOptionDescription?.(option);
                    return (
                      <button
                        key={option.id}
                        id={`${listboxId}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectOption(option)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition hover:bg-slate-50 focus:bg-slate-50",
                          activeIndex === index && "bg-slate-50",
                          isSelected &&
                            "bg-[var(--primary-soft)] text-[var(--primary-dark)]",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">
                            {getOptionLabel(option)}
                          </span>
                          {description ? (
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {description}
                            </span>
                          ) : null}
                        </span>
                        {isSelected ? (
                          <Check
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {optionsQuery.hasNextPage ? (
                  <button
                    type="button"
                    disabled={optionsQuery.isFetchingNextPage}
                    onClick={() => void optionsQuery.fetchNextPage()}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {optionsQuery.isFetchingNextPage ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : null}
                    {optionsQuery.isFetchingNextPage
                      ? "Loading more…"
                      : "Load more results"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
