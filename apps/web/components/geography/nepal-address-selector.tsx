'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { GeographyLocale } from '../../lib/api/geography';
import { GeoCombobox } from './geo-combobox';
import { cn } from '../../lib/utils';

export interface NepalAddressValue {
  localLevelId?: number | null;
  wardNumber?: string | null;
  tole?: string | null;
  streetAddress?: string | null;
  landmark?: string | null;
}

interface NepalAddressSelectorProps {
  value: NepalAddressValue;
  onChange: (value: NepalAddressValue) => void;
  disabled?: boolean;
  required?: boolean;
  idPrefix?: string;
  className?: string;
}

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Reusable Province -> District -> Local Level -> Ward -> Tole/Street/Landmark
 * address selector backed by the Nepal geography reference API
 * (GET /api/v1/reference/nepal/*). Only `localLevelId` (plus the free-text
 * ward/tole/street/landmark fields) is ever emitted -- province/district ids
 * are UI scaffolding used to drive the cascade, never persisted directly,
 * per the "don't duplicate province/district onto every address row" rule.
 *
 * Restoring a saved value: if `value.localLevelId` is set but this component
 * has no province/district context yet (e.g. an edit form's first render),
 * it fetches that single local level to hydrate the cascade so the saved
 * selection displays correctly instead of resetting to empty.
 */
export function NepalAddressSelector({
  value,
  onChange,
  disabled,
  required,
  idPrefix = 'nepal-address',
  className,
}: NepalAddressSelectorProps) {
  const [locale, setLocale] = useState<GeographyLocale>('en');
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [hydratedForLocalLevelId, setHydratedForLocalLevelId] = useState<
    number | null
  >(null);

  const localLevelId = value.localLevelId ?? null;

  // Hydrate province/district context from a previously saved localLevelId.
  const hydrationQuery = useQuery({
    queryKey: ['geo-local-level', localLevelId],
    queryFn: () => api.getLocalLevel(localLevelId as number),
    enabled: localLevelId != null && hydratedForLocalLevelId !== localLevelId,
    staleTime: ONE_DAY,
  });

  useEffect(() => {
    if (hydrationQuery.data && localLevelId != null) {
      setProvinceId(hydrationQuery.data.province.id);
      setDistrictId(hydrationQuery.data.district.id);
      setHydratedForLocalLevelId(localLevelId);
    }
  }, [hydrationQuery.data, localLevelId]);

  useEffect(() => {
    if (localLevelId == null) {
      setHydratedForLocalLevelId(null);
    }
  }, [localLevelId]);

  const provincesQuery = useQuery({
    queryKey: ['geo-provinces', locale],
    queryFn: () => api.listProvinces(locale),
    staleTime: ONE_DAY,
  });

  const districtsQuery = useQuery({
    queryKey: ['geo-districts', provinceId, locale],
    queryFn: () => api.listDistricts(provinceId as number, locale),
    enabled: provinceId != null,
    staleTime: ONE_DAY,
  });

  const localLevelsQuery = useQuery({
    queryKey: ['geo-local-levels', districtId, locale],
    queryFn: () => api.listLocalLevels(districtId as number, undefined, locale),
    enabled: districtId != null,
    staleTime: FIVE_MINUTES,
  });

  const provinceOptions = useMemo(
    () => (provincesQuery.data ?? []).map((p) => ({ id: p.id, label: p.label })),
    [provincesQuery.data],
  );
  const districtOptions = useMemo(
    () => (districtsQuery.data ?? []).map((d) => ({ id: d.id, label: d.label })),
    [districtsQuery.data],
  );
  const localLevelOptions = useMemo(
    () => (localLevelsQuery.data ?? []).map((l) => ({ id: l.id, label: l.label })),
    [localLevelsQuery.data],
  );

  function handleProvinceChange(nextProvinceId: number | null) {
    setProvinceId(nextProvinceId);
    setDistrictId(null);
    // Changing an upper level always clears everything below it -- a
    // district/local-level combination from the old province is never valid.
    onChange({ ...value, localLevelId: null });
  }

  function handleDistrictChange(nextDistrictId: number | null) {
    setDistrictId(nextDistrictId);
    onChange({ ...value, localLevelId: null });
  }

  function handleLocalLevelChange(nextLocalLevelId: number | null) {
    onChange({ ...value, localLevelId: nextLocalLevelId });
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-500">
        <span id={`${idPrefix}-locale-label`}>Labels:</span>
        <div role="group" aria-labelledby={`${idPrefix}-locale-label`} className="flex overflow-hidden rounded-lg border border-slate-200">
          {(['en', 'ne'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={locale === option}
              onClick={() => setLocale(option)}
              className={cn(
                'px-2 py-1 transition',
                locale === option
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              {option === 'en' ? 'English' : 'नेपाली'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <GeoCombobox
          id={`${idPrefix}-province`}
          label="Province"
          required={required}
          disabled={disabled}
          isLoading={provincesQuery.isLoading}
          options={provinceOptions}
          selectedId={provinceId}
          onSelect={handleProvinceChange}
          placeholder="Select province"
          emptyMessage="No provinces found"
        />
        <GeoCombobox
          id={`${idPrefix}-district`}
          label="District"
          required={required}
          disabled={disabled || provinceId == null}
          isLoading={districtsQuery.isLoading}
          options={districtOptions}
          selectedId={districtId}
          onSelect={handleDistrictChange}
          placeholder={provinceId == null ? 'Select province first' : 'Select district'}
          emptyMessage="No districts found"
        />
        <GeoCombobox
          id={`${idPrefix}-local-level`}
          label="Local Level"
          required={required}
          disabled={disabled || districtId == null}
          isLoading={localLevelsQuery.isLoading}
          options={localLevelOptions}
          selectedId={localLevelId}
          onSelect={handleLocalLevelChange}
          placeholder={districtId == null ? 'Select district first' : 'Select local level'}
          emptyMessage="No local levels found"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-ward`} className="text-sm font-semibold text-slate-700">
            Ward Number
          </label>
          <input
            id={`${idPrefix}-ward`}
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={value.wardNumber ?? ''}
            onChange={(e) => onChange({ ...value, wardNumber: e.target.value })}
            placeholder="e.g. 4"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-tole`} className="text-sm font-semibold text-slate-700">
            Tole / Locality
          </label>
          <input
            id={`${idPrefix}-tole`}
            type="text"
            disabled={disabled}
            value={value.tole ?? ''}
            onChange={(e) => onChange({ ...value, tole: e.target.value })}
            placeholder="e.g. Amarpath"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-street`} className="text-sm font-semibold text-slate-700">
            Street Address
          </label>
          <input
            id={`${idPrefix}-street`}
            type="text"
            disabled={disabled}
            value={value.streetAddress ?? ''}
            onChange={(e) => onChange({ ...value, streetAddress: e.target.value })}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-landmark`} className="text-sm font-semibold text-slate-700">
            Landmark
          </label>
          <input
            id={`${idPrefix}-landmark`}
            type="text"
            disabled={disabled}
            value={value.landmark ?? ''}
            onChange={(e) => onChange({ ...value, landmark: e.target.value })}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
      </div>
    </div>
  );
}
