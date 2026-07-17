'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { getAssignableUserRoles, requiresResponsiblePerson, resolveUserFormRole, roleLabels } from '@/lib/authz';
import type { ResponsiblePerson, UserRole, UserSummary } from '@/lib/types';
import { Button, Checkbox, ErrorState, FormField, Input, LoadingState, Modal, Select } from '@/components/ui';
import { fullName, getErrorMessage } from '@/components/common';
import { usersService } from './users.service';

export function UserFormModal({ mode, user, onClose, onSaved }: {
  mode: 'users' | 'mvoUsers';
  user: UserSummary | null;
  onClose: () => void;
  onSaved: (temporaryPassword?: string) => void;
}) {
  const [username, setUsername] = useState(user?.username ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'MVO');
  const [responsiblePersonId, setResponsiblePersonId] = useState(user?.responsiblePersonId ?? '');
  const [mustChangePassword, setMustChangePassword] = useState(user?.mustChangePassword ?? true);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ownerMode = mode === 'users';

  useEffect(() => {
    fetchAllPages((pagination) => usersService.responsiblePersons({ ...pagination, isActive: true }))
      .then(setPersons).catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoadingPersons(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const selectedRole = resolveUserFormRole(mode, role);
    try {
      if (user) {
        await usersService.updateUser(user.id, { username: username.trim(), role: selectedRole, responsiblePersonId: responsiblePersonId || null, mustChangePassword });
        onSaved();
      } else {
        const response = await usersService.createUser({ username: username.trim(), role: selectedRole, responsiblePersonId: responsiblePersonId || undefined });
        onSaved(response.temporaryPassword);
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const footer = <><Button variant="outline" type="button" onClick={onClose}>Скасувати</Button><Button disabled={saving || loadingPersons} form="user-form" type="submit">{saving ? 'Збереження…' : 'Зберегти'}</Button></>;
  return (
    <Modal closeOnEscape={!saving} footer={footer} title={user ? 'Редагування користувача' : 'Новий користувач'} onClose={onClose}>
      <form className="grid gap-4" id="user-form" onSubmit={submit}>
        {error ? <ErrorState message={error} /> : null}
        {loadingPersons ? <LoadingState label="Завантаження реєстру МВО…" /> : null}
        <FormField label="Логін" required><Input autoFocus minLength={3} value={username} onChange={(event) => setUsername(event.target.value)} /></FormField>
        <FormField label="Роль" required>
          {ownerMode ? <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>{getAssignableUserRoles(mode, user?.role).map((option) => <option key={option} value={option}>{roleLabels[option]}</option>)}</Select> : <Input readOnly value={roleLabels.MVO} />}
        </FormField>
        <FormField label="Пов’язаний МВО" required={requiresResponsiblePerson(role)}>
          <Select value={responsiblePersonId} onChange={(event) => setResponsiblePersonId(event.target.value)}>
            <option value="">Без прив’язки</option>
            {persons.map((person) => <option key={person.id} value={person.id}>{person.personnelNumber} — {fullName(person)}</option>)}
          </Select>
        </FormField>
        <FormField label="Пароль"><Checkbox checked={mustChangePassword} label="Вимагати зміну пароля під час наступного входу" onChange={(event) => setMustChangePassword(event.target.checked)} /></FormField>
      </form>
    </Modal>
  );
}
