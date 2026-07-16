'use client';

import { FormEvent, useEffect, useState } from 'react';
import { usersService as apiClient } from './users.service';
import { getAssignableUserRoles, requiresResponsiblePerson, resolveUserFormRole, roleLabels } from '@/lib/authz';
import type { ResponsiblePerson, UserRole, UserSummary } from '@/lib/types';
import {
  ErrorMessage,
  Field,
  FormActions,
  Modal,
  Select,
  fullName,
  getErrorMessage,
} from '@/components/common';
export function UserFormModal({
  mode,
  user,
  onClose,
  onSaved,
}: {
  mode: 'users' | 'mvoUsers';
  user: UserSummary | null;
  onClose: () => void;
  onSaved: (temporaryPassword?: string) => void;
}) {
  const ownerMode = mode === 'users';
  const [username, setUsername] = useState(user?.username ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'MVO');
  const [responsiblePersonId, setResponsiblePersonId] = useState(
    user?.responsiblePersonId ?? '',
  );
  const [mustChangePassword, setMustChangePassword] = useState(
    user?.mustChangePassword ?? true,
  );
  const roleOptions = getAssignableUserRoles(mode, user?.role);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .responsiblePersons({ page: 1, limit: 200, isActive: true })
      .then((response) => setPersons(response.items))
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const selectedRole = resolveUserFormRole(mode, role);

    try {
      if (user) {
        await apiClient.updateUser(user.id, {
          username,
          role: selectedRole,
          responsiblePersonId: responsiblePersonId || null,
          mustChangePassword,
        });
        onSaved();
      } else {
        const response = await apiClient.createUser({
          username,
          role: selectedRole,
          responsiblePersonId: responsiblePersonId || undefined,
        });
        onSaved(response.temporaryPassword);
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={user ? 'Редагувати користувача' : 'Створити користувача'} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <Field label="Логін">
          <input
            required
            className="input"
            minLength={3}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>
        <Field label="Роль">
          {ownerMode ? (
            <Select
              value={role}
              onChange={(value) => setRole(value as UserRole)}
            >
              {roleOptions.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {roleLabels[roleOption]}
                </option>
              ))}
            </Select>
          ) : (
            <input readOnly className="input" value={roleLabels.MVO} />
          )}
        </Field>
        <Field label="МВО">
          <Select
            required={requiresResponsiblePerson(role)}
            value={responsiblePersonId}
            onChange={setResponsiblePersonId}
          >
            <option value="">Без прив’язки</option>
            {persons.map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)} В· {person.personnelNumber}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            checked={mustChangePassword}
            type="checkbox"
            onChange={(event) => setMustChangePassword(event.target.checked)}
          />
          Вимагати зміну пароля
        </label>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}



