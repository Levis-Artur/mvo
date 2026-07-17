import type { AuthUser } from '../../lib/types';
import { profilePresentation } from './profile-model';

describe('profile presentation', () => {
  it('shows the correct localized role', () => {
    const user: AuthUser = { id: '1', username: 'auditor', role: 'AUDITOR', isActive: true, mustChangePassword: false, responsiblePersonId: null };
    expect(profilePresentation(user, null).role).toBe('Аудитор');
  });
});
