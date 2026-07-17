import type { ReactNode } from 'react';

export function AuthPageShell({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <header className="auth-panel__header">
          <div className="auth-panel__brand" aria-label="Облік майна МВО">
            <span className="auth-panel__mark" aria-hidden="true">МВО</span>
            <div>
              <strong>Облік майна МВО</strong>
              <span>Інформаційна система обліку майна</span>
            </div>
          </div>
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </header>
        <div className="auth-panel__body">{children}</div>
      </section>
    </main>
  );
}
