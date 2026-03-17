import { formatUnits } from 'viem';

/** WLF (18 dec bigint) or any 18-dec value → human string */
export function fmt18(raw: bigint | undefined, decimals = 2): string {
  if (raw === undefined) return '—';
  return Number(formatUnits(raw, 18)).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
}

/** USDT (6 dec bigint) → human USD string */
export function fmtUSDT(val: bigint, decimals = 2): string {
  return Number(formatUnits(val, 6)).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
}

/** WLF (18 dec bigint) → human WLF string */
export function fmtWLF(val: bigint, decimals = 4): string {
  return Number(formatUnits(val, 18)).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
}

/** User-entered $/month string → USDT wei per hour (6 dec) */
export function monthlyUSDToHourlyWei(monthlyUSD: string): bigint {
  const parsed = parseFloat(monthlyUSD);
  if (isNaN(parsed) || parsed <= 0) return 0n;
  return BigInt(Math.round(parsed * 1_000_000)) / 730n;
}

/** USDT wei per hour (6 dec) → human $/month string */
export function hourlyWeiToMonthlyUSD(hourlyWei: bigint): string {
  return (Number(hourlyWei * 730n) / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

/** Format months count as human string, e.g. 14 → "1yr 2mo" */
export function fmtMonths(months: number): string {
  if (months <= 0) return '0 months';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years}yr ${rem}mo`;
}

/** USDT wei (6 dec) → WLF (18 dec). wlfPrice is 18-dec-scaled from TokenSale. */
export function usdtToWlf(usdtWei: bigint, wlfPrice: bigint): bigint {
  if (wlfPrice === 0n || usdtWei === 0n) return 0n;
  return (usdtWei * 10n ** 30n) / wlfPrice;
}
