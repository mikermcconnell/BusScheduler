import { useEffect, useMemo, useState } from 'react';

/**
 * Maintains a symmetric +/- domain for surplus/deficit charts that only expands
 * when larger differences appear. This prevents the axis from shrinking each
 * time data updates so visual comparisons remain stable.
 */
export function useStableDifferenceDomain(values: number[], minimum = 3): [number, number] {
  const [range, setRange] = useState(minimum);

  useEffect(() => {
    if (values.length === 0) {
      return;
    }
    const maxAbs = values.reduce((max, value) => Math.max(max, Math.abs(value)), minimum);
    setRange((previous) => (maxAbs > previous ? maxAbs : previous));
  }, [values, minimum]);

  return useMemo(() => [-range, range] as [number, number], [range]);
}
