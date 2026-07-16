'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { organizationService as apiClient } from './organization.service';
import { useAuth } from '@/app/ui/auth-context';
import { can } from '@/lib/authz';
import type { CreateManagementDto, CreateServiceDto, CreateUnitDto, Management, Service, Unit } from '@/lib/types';
import {
  EmptyState,
  ErrorMessage,
  Field,
  FormActions,
  LoadingMessage,
  Modal,
  PageHeader,
  SimpleTable,
  StatusBadge,
  getErrorMessage,
} from '@/components/common';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';


type OrgForm =
  | { type: 'management'; data?: Management }
  | { type: 'service'; managementId: string; data?: Service }
  | { type: 'unit'; serviceId: string; data?: Unit };

export function StructureView() {
  const { user } = useAuth();
  const canWriteStructure = can(user, 'write', 'organization');
  const [managements, setManagements] = useState<Management[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orgForm, setOrgForm] = useState<OrgForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setManagements(await apiClient.managements());
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'structure') return;

      if (detail.action === 'create-management' && canWriteStructure) {
        setOrgForm({ type: 'management' });
      }

      if (detail.action === 'refresh') {
        void load();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [canWriteStructure, load]);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Організаційна структура"
        description="Управління, служби та підрозділи."
        action={
          canWriteStructure ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setOrgForm({ type: 'management' })}
          >
            Створити управління
          </button>
          ) : undefined
        }
      />
      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingMessage /> : null}
      {!loading && managements.length === 0 ? (
        <EmptyState message="Організаційну структуру ще не створено." />
      ) : null}
      <div className="grid min-h-[420px] gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="erp-panel overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--toolbar-background)] px-2 py-1.5 text-xs font-semibold">
            Дерево структури
          </div>
          <div className="compact-scrollbar max-h-[560px] overflow-auto p-2 text-[13px]">
            {managements.map((management) => (
              <div key={management.id} className="grid gap-1">
                <button
                  className="flex h-8 items-center justify-between gap-2 rounded px-2 text-left hover:bg-[var(--hover-row)]"
                  type="button"
                  onClick={() =>
                    canWriteStructure
                      ? setOrgForm({ type: 'management', data: management })
                      : undefined
                  }
                >
                  <span className="truncate">в–ѕ {management.name}</span>
                  <StatusBadge active={management.isActive} />
                </button>
                <div className="ml-4 border-l border-[var(--border)] pl-2">
                  {canWriteStructure ? (
                    <button
                      className="btn btn-ghost !min-h-7 !w-fit !px-0"
                      type="button"
                      onClick={() =>
                        setOrgForm({
                          type: 'service',
                          managementId: management.id,
                        })
                      }
                    >
                      + служба
                    </button>
                  ) : null}
                  {management.services?.map((service) => (
                    <div key={service.id}>
                      <button
                        className="flex h-8 w-full items-center justify-between gap-2 rounded px-2 text-left hover:bg-[var(--hover-row)]"
                        type="button"
                        onClick={() =>
                          canWriteStructure
                            ? setOrgForm({
                                type: 'service',
                                managementId: management.id,
                                data: service,
                              })
                            : undefined
                        }
                      >
                        <span className="truncate">в–ѕ {service.name}</span>
                        <span className="font-mono text-xs text-[var(--text-secondary)]">
                          {service.code}
                        </span>
                      </button>
                      <div className="ml-4 border-l border-[var(--border-light)] pl-2">
                        {canWriteStructure ? (
                          <button
                            className="btn btn-ghost !min-h-7 !w-fit !px-0"
                            type="button"
                            onClick={() =>
                              setOrgForm({
                                type: 'unit',
                                serviceId: service.id,
                              })
                            }
                          >
                            + підрозділ
                          </button>
                        ) : null}
                        {service.units?.map((unit) => (
                          <button
                            key={unit.id}
                            className="flex h-8 w-full items-center justify-between gap-2 rounded px-2 text-left hover:bg-[var(--hover-row)]"
                            type="button"
                            onClick={() =>
                              canWriteStructure
                                ? setOrgForm({
                                    type: 'unit',
                                    serviceId: service.id,
                                    data: unit,
                                  })
                                : undefined
                            }
                          >
                            <span className="truncate">{unit.name}</span>
                            <span className="font-mono text-xs text-[var(--text-secondary)]">
                              {unit.code}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <SimpleTable
          headers={['Тип', 'Назва', 'Код', 'Статус']}
          rows={managements.flatMap((management) => [
            [
              'Управління',
              management.name,
              management.code,
              <StatusBadge key={`${management.id}-status`} active={management.isActive} />,
            ],
            ...(management.services ?? []).flatMap((service) => [
              [
                'Служба',
                service.name,
                service.code,
                <StatusBadge key={`${service.id}-status`} active={service.isActive} />,
              ],
              ...(service.units ?? []).map((unit) => [
                'Підрозділ',
                unit.name,
                unit.code,
                <StatusBadge key={`${unit.id}-status`} active={unit.isActive} />,
              ]),
            ]),
          ])}
        />
      </div>
      {orgForm ? (
        <OrgFormModal
          form={orgForm}
          onClose={() => setOrgForm(null)}
          onSaved={() => {
            setOrgForm(null);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

export function OrgFormModal({
  form,
  onClose,
  onSaved,
}: {
  form: OrgForm;
  onClose: () => void;
  onSaved: () => void;
}) {
  const title =
    form.type === 'management'
      ? form.data
        ? 'Редагувати управління'
        : 'Створити управління'
      : form.type === 'service'
        ? form.data
          ? 'Редагувати службу'
          : 'Створити службу'
        : form.data
          ? 'Редагувати підрозділ'
          : 'Створити підрозділ';
  const [name, setName] = useState(form.data?.name ?? '');
  const [shortName, setShortName] = useState(
    form.type === 'management' ? (form.data?.shortName ?? '') : '',
  );
  const [code, setCode] = useState(form.data?.code ?? '');
  const [isActive, setActive] = useState(form.data?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (form.type === 'management') {
        const payload: CreateManagementDto = {
          name,
          shortName: shortName || null,
          code,
          isActive,
        };
        if (form.data) {
          await apiClient.updateManagement(form.data.id, payload);
        } else {
          await apiClient.createManagement(payload);
        }
      } else if (form.type === 'service') {
        const payload: CreateServiceDto = {
          name,
          code,
          managementId: form.managementId,
          isActive,
        };
        if (form.data) {
          await apiClient.updateService(form.data.id, payload);
        } else {
          await apiClient.createService(payload);
        }
      } else {
        const payload: CreateUnitDto = {
          name,
          code,
          serviceId: form.serviceId,
          isActive,
        };
        if (form.data) {
          await apiClient.updateUnit(form.data.id, payload);
        } else {
          await apiClient.createUnit(payload);
        }
      }
      onSaved();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <Field label="Назва">
          <input
            required
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {form.type === 'management' ? (
          <Field label="Коротка назва">
            <input
              className="input"
              value={shortName}
              onChange={(event) => setShortName(event.target.value)}
            />
          </Field>
        ) : null}
        <Field label="Код">
          <input
            required
            className="input"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            checked={isActive}
            type="checkbox"
            onChange={(event) => setActive(event.target.checked)}
          />
          Активний запис
        </label>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}


