export function average(
  values,
) {
  const finite = values
    .map(Number)
    .filter(Number.isFinite);

  return finite.length
    ? finite.reduce(
      (total, value) => total + value,
      0,
    ) / finite.length
    : 0;
}

export function median(
  values,
) {
  return percentile(values, .5);
}

export function percentile(
  values,
  ratio,
) {
  const finite = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  if (!finite.length) return 0;
  if (finite.length === 1) return finite[0];

  const position = (
    Math.max(0, Math.min(1, ratio))
    * (finite.length - 1)
  );

  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return finite[lower];
  }

  const weight = position - lower;

  return (
    finite[lower] * (1 - weight)
    + finite[upper] * weight
  );
}

export function formatDuration(
  milliseconds,
) {
  const totalSeconds = Math.max(
    0,
    Math.round(
      Number(milliseconds) / 1000,
    ),
  );

  const hours = Math.floor(
    totalSeconds / 3600,
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );

  const seconds = (
    totalSeconds % 60
  );

  return hours > 0
    ? [
      hours,
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ].join(":")
    : [
      minutes,
      String(seconds).padStart(2, "0"),
    ].join(":");
}

export function csvEscape(
  value,
) {
  if (value == null) return "";

  const text = String(value);

  if (
    /[;"\r\n]/.test(text)
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function stableJson(
  value,
) {
  return `${JSON.stringify(
    value,
    null,
    2,
  )}\n`;
}

export function round(
  value,
  digits = 2,
) {
  const factor = 10 ** digits;

  return Math.round(
    Number(value || 0) * factor,
  ) / factor;
}
