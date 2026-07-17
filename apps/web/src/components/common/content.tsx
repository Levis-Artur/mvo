export function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-[var(--text-secondary)]">{label}</dt>
      <dd className="break-words text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

