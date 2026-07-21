import type { AuthUser, ResponsiblePerson } from '../../lib/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { profilePresentation } from './profile-model';

describe('profile presentation', () => {
  it('shows the correct localized role', () => {
    const user: AuthUser = { id: '1', username: 'auditor', role: 'AUDITOR', isActive: true, mustChangePassword: false, responsiblePersonId: null };
    expect(profilePresentation(user, null).role).toBe('Аудитор');
  });

  it('показує дані картки MVO у профілі', () => {
    const user: AuthUser = { id: '1', username: 'mvo', role: 'MVO', isActive: true, mustChangePassword: false, responsiblePersonId: 'person-1' };
    const person = {
      personnelNumber: '003', lastName: 'Левіс', firstName: 'Артур', middleName: 'Сергійович',
      management: { name: 'Управління' }, service: { name: 'Служба' }, unit: { name: 'Підрозділ' },
    } as ResponsiblePerson;
    expect(profilePresentation(user, person)).toMatchObject({
      personnelNumber: '003', fullName: 'Левіс Артур Сергійович', management: 'Управління',
      service: 'Служба', unit: 'Підрозділ', accountState: 'Активний',
    });
  });

  it('рендерить організаційні дані MVO лише для читання', () => {
    const view = readFileSync(join(__dirname, 'profile-view.tsx'), 'utf8');
    expect(view).toContain('Дані матеріально відповідальної особи');
    expect(view).toContain('data-read-only="true"');
    expect(view).toContain('<dt>Номер МВО</dt>');
    expect(view).toContain('<dt>Управління</dt>');
    expect(view).toContain('<dt>Служба</dt>');
    expect(view).toContain('<dt>Підрозділ</dt>');
    expect(view).toContain('Ці дані доступні лише для перегляду');
  });
});
