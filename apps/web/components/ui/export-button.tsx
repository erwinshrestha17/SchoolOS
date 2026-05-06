'use client';

import { Download } from 'lucide-react';
import { Button } from './button';

type ExportButtonProps = {
  label?: string;
  disabled?: boolean;
  isExporting?: boolean;
  onExport: () => void;
};

export function ExportButton({
  label = 'Export',
  disabled,
  isExporting,
  onExport,
}: ExportButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || isExporting}
      onClick={onExport}
    >
      <Download size={16} />
      {isExporting ? 'Exporting...' : label}
    </Button>
  );
}
