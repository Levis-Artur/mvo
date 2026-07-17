import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('organization responsive layout', () => {
  it('prevents uncontrolled horizontal overflow on organization nodes', () => {
    const css = readFileSync(
      resolve(__dirname, '../../styles/components.css'),
      'utf8',
    );
    expect(css).toMatch(/\.organization-node\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.organization-node\s*\{[^}]*overflow:\s*hidden/);
  });

  it('stacks hierarchy content in the mobile breakpoint', () => {
    const css = readFileSync(
      resolve(__dirname, '../../styles/responsive.css'),
      'utf8',
    );
    expect(css).toMatch(
      /\.organization-node\s*>\s*summary[^}]*flex-direction:\s*column/,
    );
  });
});
