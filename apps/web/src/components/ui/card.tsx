export function Card({ title, icon, children, className = '' }: { title?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`ui-card ${className}`}>{title ? <header className="ui-card__header">{icon}{title}</header> : null}<div className="ui-card__body">{children}</div></section>;
}
