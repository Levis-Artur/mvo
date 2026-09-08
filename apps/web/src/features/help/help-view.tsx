'use client';

import { useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui';
import type { AuthUser } from '@/lib/types';
import {
  commonHelpSection,
  faqHelpSection,
  getHelpGuides,
  type HelpContentBlock,
  type HelpSection,
} from './help-content';

function HelpBlock({ block }: { block: HelpContentBlock }) {
  if (block.type === 'paragraph') {
    return <p>{block.text}</p>;
  }

  if (block.type === 'warning') {
    return (
      <div className="ui-alert" data-tone="warning">
        <p>{block.text}</p>
        {block.items ? <ul className="list-disc space-y-1 pl-5">{block.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      </div>
    );
  }

  const List = block.ordered ? 'ol' : 'ul';
  return (
    <List className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}>
      {block.items.map((item) => <li key={item}>{item}</li>)}
    </List>
  );
}

function HelpAccordion({ section }: { section: HelpSection }) {
  return (
    <details className="ui-card" id={section.id}>
      <summary className="cursor-pointer px-4 py-3 font-semibold">{section.title}</summary>
      <div className="grid gap-3 border-t border-[var(--color-border-light)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        {section.blocks.map((block, index) => <HelpBlock block={block} key={`${section.id}-${index}`} />)}
      </div>
    </details>
  );
}

export function HelpView({ user }: { user: AuthUser }) {
  const guides = getHelpGuides(user);

  useEffect(() => {
    function revealHashTarget() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.scrollIntoView({ block: 'start' });
    }

    revealHashTarget();
    window.addEventListener('hashchange', revealHashTarget);
    return () => window.removeEventListener('hashchange', revealHashTarget);
  }, []);

  const guideAnchor = (guideId: string) => `${guideId}-guide`;

  return (
    <div className="grid gap-4">
      <PageHeader
        icon="journal"
        title="Посібник користувача"
        description="Короткі підказки щодо доступних вам розділів і основних сценаріїв роботи."
      />

      <Card title="Швидкий старт">
        <div className="grid gap-4 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <div className="grid content-start gap-2" key={guide.id}>
              <h2 className="font-semibold text-[var(--color-text)]">{guide.title}</h2>
              <ol className="list-decimal space-y-1 pl-5">
                {guide.quickStart.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Зміст">
        <nav aria-label="Зміст посібника" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid content-start gap-1">
            <a className="font-semibold text-[var(--color-primary)]" href={`#${commonHelpSection.id}`}>
              {commonHelpSection.title}
            </a>
          </div>
          {guides.map((guide) => (
            <div className="grid content-start gap-1" key={guide.id}>
              <a className="font-semibold text-[var(--color-primary)]" href={`#${guideAnchor(guide.id)}`}>
                {guide.title}
              </a>
              {guide.sections.map((section) => (
                <a className="text-sm text-[var(--color-text-secondary)]" href={`#${section.id}`} key={section.id}>
                  {section.title}
                </a>
              ))}
            </div>
          ))}
          <div className="grid content-start gap-1">
            <a className="font-semibold text-[var(--color-primary)]" href={`#${faqHelpSection.id}`}>
              {faqHelpSection.title}
            </a>
          </div>
        </nav>
      </Card>

      <HelpAccordion section={commonHelpSection} />

      {guides.map((guide) => (
        <section className="grid gap-3" id={guideAnchor(guide.id)} key={guide.id}>
          <div>
            <h2 className="text-xl font-bold">{guide.title}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{guide.introduction}</p>
          </div>
          {guide.sections.map((section) => <HelpAccordion key={section.id} section={section} />)}
        </section>
      ))}

      <HelpAccordion section={faqHelpSection} />
    </div>
  );
}
