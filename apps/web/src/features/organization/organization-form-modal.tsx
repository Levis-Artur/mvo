'use client';

import { FormEvent, useMemo, useState } from 'react';
import type {
  CreateManagementDto,
  CreateServiceDto,
  CreateUnitDto,
  Management,
} from '@/lib/types';
import {
  Button,
  Checkbox,
  ErrorState,
  FormField,
  Input,
  Modal,
  Select,
} from '@/components/ui';
import { organizationService as apiClient } from './organization.service';
import {
  allOrganizationServices,
  organizationFormError,
  refreshAfterOrganizationMutation,
  type OrgForm,
} from './organization-model';

function formTitle(form: OrgForm) {
  const action = form.data ? 'Редагувати' : 'Створити';
  if (form.type === 'management') return `${action} управління`;
  if (form.type === 'service') return `${action} службу`;
  return `${action} підрозділ`;
}

export function OrganizationFormModal({
  form,
  managements,
  onClose,
  onSaved,
}: {
  form: OrgForm;
  managements: Management[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const services = useMemo(
    () => allOrganizationServices(managements),
    [managements],
  );
  const [name, setName] = useState(form.data?.name ?? '');
  const [shortName, setShortName] = useState(
    form.type === 'management' ? (form.data?.shortName ?? '') : '',
  );
  const [code, setCode] = useState(form.data?.code ?? '');
  const [isActive, setActive] = useState(form.data?.isActive ?? true);
  const [managementId, setManagementId] = useState(
    form.type === 'service'
      ? (form.data?.managementId ?? form.managementId)
      : '',
  );
  const [serviceId, setServiceId] = useState(
    form.type === 'unit' ? (form.data?.serviceId ?? form.serviceId) : '',
  );
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
        if (form.data) await apiClient.updateManagement(form.data.id, payload);
        else await apiClient.createManagement(payload);
      } else if (form.type === 'service') {
        const payload: CreateServiceDto = {
          name,
          code,
          managementId,
          isActive,
        };
        if (form.data) await apiClient.updateService(form.data.id, payload);
        else await apiClient.createService(payload);
      } else {
        const payload: CreateUnitDto = { name, code, serviceId, isActive };
        if (form.data) await apiClient.updateUnit(form.data.id, payload);
        else await apiClient.createUnit(payload);
      }
      await refreshAfterOrganizationMutation(onSaved);
    } catch (reason) {
      setError(organizationFormError(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      closeOnEscape={!saving}
      footer={
        <>
          <Button disabled={saving} variant="outline" type="button" onClick={onClose}>
            Скасувати
          </Button>
          <Button disabled={saving} form="organization-form" type="submit">
            {saving ? 'Збереження…' : 'Зберегти'}
          </Button>
        </>
      }
      onClose={onClose}
      title={formTitle(form)}
    >
      <form className="grid gap-4" id="organization-form" onSubmit={submit}>
        {error ? <ErrorState message={error} /> : null}
        <FormField label="Назва" required>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        {form.type === 'management' ? (
          <FormField label="Коротка назва">
            <Input
              value={shortName}
              onChange={(event) => setShortName(event.target.value)}
            />
          </FormField>
        ) : null}
        <FormField label="Код" required>
          <Input value={code} onChange={(event) => setCode(event.target.value)} />
        </FormField>
        {form.type === 'service' ? (
          <FormField
            hint={form.data ? 'Зміна управління перемістить службу.' : undefined}
            label="Управління"
            required
          >
            <Select
              value={managementId}
              onChange={(event) => setManagementId(event.target.value)}
            >
              <option value="">Оберіть управління</option>
              {managements.map((management) => (
                <option key={management.id} value={management.id}>
                  {management.name}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
        {form.type === 'unit' ? (
          <FormField
            hint={form.data ? 'Зміна служби перемістить підрозділ.' : undefined}
            label="Служба"
            required
          >
            <Select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="">Оберіть службу</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
        <Checkbox
          checked={isActive}
          label="Активний запис"
          onChange={(event) => setActive(event.target.checked)}
        />
      </form>
    </Modal>
  );
}
