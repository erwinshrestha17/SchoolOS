const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function parseApiErrorMessage(text: string) {
  if (!text) {
    return '';
  }

  try {
    const payload = JSON.parse(text) as {
      message?: string | string[];
      error?: string;
    };
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message;

    return message || payload.error || text;
  } catch {
    return text;
  }
}

async function openValidatedPdfBlob(response: Response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      parseApiErrorMessage(text) || `Request failed with status ${response.status}`,
    );
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (!contentType.includes('application/pdf')) {
    const text = await response.text();
    throw new Error(
      parseApiErrorMessage(text) ||
        'The server did not return a PDF document. Please try again or contact support.',
    );
  }

  const blob = await response.blob();

  if (blob.size === 0) {
    throw new Error('The server returned an empty PDF document.');
  }

  const header = await blob.slice(0, 5).text();

  if (header !== '%PDF-') {
    throw new Error('The server returned an invalid PDF document.');
  }

  window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
}

export async function openApprovedSalarySlipPdf(runId: string, lineId: string) {
  const response = await fetch(
    `${API_BASE_URL}/payroll/runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(lineId)}/salary-slip.pdf`,
    {
      credentials: 'include',
    },
  );

  await openValidatedPdfBlob(response);
}
