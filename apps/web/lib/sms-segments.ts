/**
 * Client-side SMS length estimate using the standard GSM 03.38 / UCS-2
 * segmentation rules (3GPP TS 23.038). This is a universal telecom-encoding
 * calculation, not tenant business data, so it is safe to compute in the
 * browser purely as a sender-facing estimate — it must never be presented as
 * the guaranteed segment count or cost, since the actual provider may apply
 * its own rules on delivery.
 *
 * A single non-GSM character (e.g. Devanagari script) forces the *entire*
 * message into UCS-2 encoding, which drops the single-segment limit from 160
 * to 70 characters. Assuming plain ASCII/160 for a Nepal-first product would
 * silently understate SMS cost for any Nepali-language notice.
 */

const GSM_7BIT_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_7BIT_EXTENDED = '^{}\\[~]|€';

export type SmsEncoding = 'GSM-7' | 'UCS-2';

export type SmsSegmentEstimate = {
  /** Number of SMS segments this text would take if sent as-is. 0 for empty text. */
  segments: number;
  /** Which standard encoding applies to the whole message. */
  encoding: SmsEncoding;
  /** Character budget for a single (non-concatenated) segment under this encoding. */
  singleSegmentLimit: number;
};

export function estimateSmsSegments(text: string): SmsSegmentEstimate {
  const characters = Array.from(text);

  if (characters.length === 0) {
    return { segments: 0, encoding: 'GSM-7', singleSegmentLimit: 160 };
  }

  const isGsm7 = characters.every(
    (char) => GSM_7BIT_BASIC.includes(char) || GSM_7BIT_EXTENDED.includes(char),
  );

  if (isGsm7) {
    // Extended-table characters consume an escape septet, so they count double.
    const septetLength = characters.reduce(
      (total, char) => total + (GSM_7BIT_EXTENDED.includes(char) ? 2 : 1),
      0,
    );
    const singleSegmentLimit = 160;
    const concatenatedSegmentLimit = 153;
    const segments =
      septetLength <= singleSegmentLimit
        ? 1
        : Math.ceil(septetLength / concatenatedSegmentLimit);
    return { segments, encoding: 'GSM-7', singleSegmentLimit };
  }

  const singleSegmentLimit = 70;
  const concatenatedSegmentLimit = 67;
  const segments =
    characters.length <= singleSegmentLimit
      ? 1
      : Math.ceil(characters.length / concatenatedSegmentLimit);
  return { segments, encoding: 'UCS-2', singleSegmentLimit };
}
