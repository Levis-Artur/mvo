'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { getAssignableUserRoles, requiresResponsiblePerson, resolveUserFormRole, roleLabels } from '@/lib/authz';
import type {
  Management,
  ResponsiblePerson,
  Service,
  UserAccessScopeInput,
  UserRole,
  UserSummary,
} from '@/lib/types';
import { Button, Checkbox, ErrorState, FormField, Input, LoadingState, Modal, Select } from '@/components/ui';
import { fullName, getErrorMessage } from '@/components/common';
import { usersService } from './users.service';
import { serviceCodeLabel, serviceCodesForScope } from './user-model';

type AccessScopeDraft = UserAccessScopeInput & { key: string };

let nextScopeKey = 0;

function scopeDraft(
  scope: UserAccessScopeInput = { managementId: null, serviceCode: null },
): AccessScopeDraft {
  nextScopeKey += 1;
  return { ...scope, key: `access-scope-${nextScopeKey}` };
}

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
  const [managements, setManagements] = useState<Management[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [accessScopes, setAccessScopes] = useState<AccessScopeDraft[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ownerMode = mode === 'users';
  const selectedRole = resolveUserFormRole(mode, role);
  const isManager = selectedRole === 'ORG_MANAGER';
  const hasAccessScopes = ownerMode && (isManager || selectedRole === 'MVO');

  useEffect(() => {
    Promise.all([
      fetchAllPages((pagination) => usersService.responsiblePersons({ ...pagination, isActive: true })),
      usersService.managements(),
      usersService.services(),
      ownerMode && (user?.role === 'ORG_MANAGER' || user?.role === 'MVO')
        ? usersService.userAccessScopes(user.id)
        : Promise.resolve([]),
    ])
      .then(([nextPersons, nextManagements, nextServices, nextScopes]) => {
        setPersons(nextPersons);
        setManagements(nextManagements.filter((item) => item.isActive));
        setServices(nextServices.filter((item) => item.isActive));
        setAccessScopes(nextScopes.map((scope) => scopeDraft(scope)));
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoadingPersons(false));
  }, [user]);

  function serviceCodesFor(managementId: string | null) {
    return serviceCodesForScope(services, managementId);
  }

  function updateScope(
    key: string,
    patch: Partial<UserAccessScopeInput>,
  ) {
    setAccessScopes((current) =>
      current.map((scope) =>
        scope.key === key ? { ...scope, ...patch } : scope,
      ),
    );
  }

  function normalizedScopes(): UserAccessScopeInput[] | null {
    const scopes = accessScopes.map(({ managementId, serviceCode }) => ({
      managementId: managementId || null,
      serviceCode: serviceCode || null,
    }));
    if (scopes.some((scope) => !scope.managementId && !scope.serviceCode)) {
      setError('Для кожної області виберіть управління або службу. Глобальний доступ менеджеру не дозволено.');
      return null;
    }
    const keys = scopes.map(
      (scope) => `${scope.managementId ?? ''}\u0000${scope.serviceCode ?? ''}`,
    );
    if (new Set(keys).size !== keys.length) {
      setError('Однакові області доступу не можна додавати двічі.');
      return null;
    }
    return scopes;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const selectedResponsiblePersonId = requiresResponsiblePerson(selectedRole)
      ? responsiblePersonId || null
      : null;
    const scopes = hasAccessScopes ? normalizedScopes() : [];
    if (hasAccessScopes && !scopes) {
      setSaving(false);
      return;
    }
    try {
      if (user) {
        await usersService.updateUser(user.id, { username: username.trim(), role: selectedRole, responsiblePersonId: selectedResponsiblePersonId, mustChangePassword });
        if (hasAccessScopes) {
          await usersService.replaceUserAccessScopes(user.id, scopes ?? []);
        }
        onSaved();
      } else {
        const response = await usersService.createUser({
          username: username.trim(),
          role: selectedRole,
          responsiblePersonId: selectedResponsiblePersonId ?? undefined,
        });
        if (hasAccessScopes) {
          await usersService.replaceUserAccessScopes(response.user.id, scopes ?? []);
        }
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
    <Modal closeOnEscape={!saving} footer={footer} size={hasAccessScopes ? 'large' : 'medium'} title={user ? 'Редагування користувача' : 'Новий користувач'} onClose={onClose}>
      <form className="grid gap-4" id="user-form" onSubmit={submit}>
        {error ? <ErrorState message={error} /> : null}
        {loadingPersons ? <LoadingState label="Завантаження реєстру МВО…" /> : null}
        <FormField label="Логін" required><Input autoFocus minLength={3} value={username} onChange={(event) => setUsername(event.target.value)} /></FormField>
        <FormField label="Роль" required>
          {ownerMode ? <Select value={role} onChange={(event) => {
            const nextRole = event.target.value as UserRole;
            setRole(nextRole);
            if (!requiresResponsiblePerson(nextRole)) setResponsiblePersonId('');
          }}>{getAssignableUserRoles(mode, user?.role).map((option) => <option key={option} value={option}>{roleLabels[option]}</option>)}</Select> : <Input readOnly value={roleLabels.MVO} />}
        </FormField>
        <FormField label="Пов’язаний МВО" required={requiresResponsiblePerson(role)}>
          <Select disabled={!requiresResponsiblePerson(role)} value={responsiblePersonId} onChange={(event) => setResponsiblePersonId(event.target.value)}>
            <option value="">Без прив’язки</option>
            {persons.map((person) => <option key={person.id} value={person.id}>{person.externalAccountingCode ?? 'Не вказано'} — {fullName(person)}</option>)}
          </Select>
        </FormField>
        {hasAccessScopes ? (
          <section aria-labelledby="access-scopes-title" className="user-access-scopes">
            <div className="user-access-scopes__header">
              <div>
                <h3 id="access-scopes-title">{isManager ? 'Області доступу' : 'Додатковий доступ для перегляду'}</h3>
                <p>{isManager ? 'Менеджер має право переглядати дані МВО лише в зазначених областях доступу.' : 'Лише перегляд інших МВО. Операції залишаються доступними тільки від імені пов’язаного МВО.'}</p>
              </div>
              <Button
                size="compact"
                type="button"
                variant="outline"
                onClick={() => setAccessScopes((current) => [...current, scopeDraft()])}
              >
                + Додати область
              </Button>
            </div>
            {accessScopes.length ? (
              <div className="user-access-scopes__list">
                {accessScopes.map((scope, index) => {
                  const management = managements.find(
                    (item) => item.id === scope.managementId,
                  );
                  const serviceCodes = serviceCodesFor(scope.managementId);
                  const description = scope.managementId
                    ? scope.serviceCode
                      ? `${serviceCodeLabel(scope.serviceCode)} — ${management?.name ?? 'обране управління'}`
                      : `Усі служби — ${management?.name ?? 'обране управління'}`
                    : scope.serviceCode
                      ? `${serviceCodeLabel(scope.serviceCode)} — усі управління`
                      : 'Виберіть управління або службу';
                  return (
                    <div className="user-access-scope-row" key={scope.key}>
                      <FormField label="Управління" hint={description}>
                        <Select
                          value={scope.managementId ?? ''}
                          onChange={(event) => {
                            const managementId = event.target.value || null;
                            const nextServiceCodes = serviceCodesFor(managementId);
                            updateScope(scope.key, {
                              managementId,
                              serviceCode:
                                scope.serviceCode &&
                                !nextServiceCodes.includes(scope.serviceCode)
                                  ? null
                                  : scope.serviceCode,
                            });
                          }}
                        >
                          <option value="">Усі управління</option>
                          {managements.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Служба">
                        <Select
                          value={scope.serviceCode ?? ''}
                          onChange={(event) =>
                            updateScope(scope.key, {
                              serviceCode: event.target.value || null,
                            })
                          }
                        >
                          <option value="">Усі служби</option>
                          {serviceCodes.map((code) => (
                            <option key={code} value={code}>{serviceCodeLabel(code)}</option>
                          ))}
                        </Select>
                      </FormField>
                      <Button
                        aria-label={`Видалити область ${index + 1}`}
                        size="compact"
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setAccessScopes((current) =>
                            current.filter((item) => item.key !== scope.key),
                          )
                        }
                      >
                        Видалити
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="user-access-scopes__empty">Області доступу ще не додано.</p>
            )}
          </section>
        ) : null}
        <FormField label="Пароль"><Checkbox checked={mustChangePassword} label="Вимагати зміну пароля під час наступного входу" onChange={(event) => setMustChangePassword(event.target.checked)} /></FormField>
      </form>
    </Modal>
  );
}
