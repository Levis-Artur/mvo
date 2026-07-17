'use client';

import { FormEvent, useEffect, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import type {
  CreateResponsiblePersonDto,
  Management,
  ResponsiblePerson,
  Service,
  Unit,
} from '@/lib/types';
import { getErrorMessage, normalizePersonForm } from '@/components/common';
import {
  Button,
  Checkbox,
  ErrorState,
  FormField,
  Input,
  Modal,
  Select,
} from '@/components/ui';

const emptyPersonForm: CreateResponsiblePersonDto = {
  lastName: '',
  firstName: '',
  middleName: '',
  personnelNumber: '',
  position: '',
  phone: '',
  email: '',
  managementId: '',
  serviceId: '',
  unitId: '',
  appointmentOrderNumber: '',
  appointmentDate: '',
  isActive: true,
};

export function PersonForm({
  person,
  onClose,
  onSaved,
}: {
  person: ResponsiblePerson | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateResponsiblePersonDto>(() =>
    person
      ? {
          lastName: person.lastName,
          firstName: person.firstName,
          middleName: person.middleName ?? '',
          personnelNumber: person.personnelNumber,
          position: person.position ?? '',
          phone: person.phone ?? '',
          email: person.email ?? '',
          managementId: person.managementId,
          serviceId: person.serviceId,
          unitId: person.unitId ?? '',
          appointmentOrderNumber: person.appointmentOrderNumber ?? '',
          appointmentDate: person.appointmentDate?.slice(0, 10) ?? '',
          isActive: person.isActive,
        }
      : emptyPersonForm,
  );
  const [managements, setManagements] = useState<Management[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .managements()
      .then(setManagements)
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, []);

  useEffect(() => {
    if (!form.managementId) {
      setServices([]);
      return;
    }
    apiClient
      .services({ managementId: form.managementId })
      .then(setServices)
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [form.managementId]);

  useEffect(() => {
    if (!form.serviceId) {
      setUnits([]);
      return;
    }
    apiClient
      .units({ serviceId: form.serviceId })
      .then(setUnits)
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [form.serviceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = normalizePersonForm(form);
      if (person) {
        await apiClient.updateResponsiblePerson(person.id, payload);
      } else {
        await apiClient.createResponsiblePerson(payload);
      }
      onSaved();
    } catch (reason) {
      setError(getErrorMessage(reason));
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
          <Button disabled={saving} form="person-form" type="submit">
            {saving ? 'Збереження…' : 'Зберегти'}
          </Button>
        </>
      }
      onClose={onClose}
      size="large"
      title={person ? 'Редагувати МВО' : 'Додати МВО'}
    >
      <form className="grid gap-4" id="person-form" onSubmit={submit}>
        {error ? <ErrorState message={error} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Прізвище" required>
            <Input
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({ ...current, lastName: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Ім’я" required>
            <Input
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({ ...current, firstName: event.target.value }))
              }
            />
          </FormField>
          <FormField label="По батькові">
            <Input
              value={form.middleName ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, middleName: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Номер МВО" required>
            <Input
              value={form.personnelNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  personnelNumber: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Посада">
            <Input
              value={form.position ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, position: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Телефон">
            <Input
              value={form.phone ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={form.email ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Управління" required>
            <Select
              value={form.managementId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  managementId: event.target.value,
                  serviceId: '',
                  unitId: '',
                }))
              }
            >
              <option value="">Оберіть управління</option>
              {managements.map((management) => (
                <option key={management.id} value={management.id}>
                  {management.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Служба" required>
            <Select
              value={form.serviceId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  serviceId: event.target.value,
                  unitId: '',
                }))
              }
            >
              <option value="">Оберіть службу</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Підрозділ">
            <Select
              value={form.unitId ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, unitId: event.target.value }))
              }
            >
              <option value="">Без підрозділу</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Номер наказу">
            <Input
              value={form.appointmentOrderNumber ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  appointmentOrderNumber: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Дата призначення">
            <Input
              type="date"
              value={form.appointmentDate ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  appointmentDate: event.target.value,
                }))
              }
            />
          </FormField>
        </div>
        <Checkbox
          checked={form.isActive ?? true}
          label="Активний запис"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              isActive: event.target.checked,
            }))
          }
        />
      </form>
    </Modal>
  );
}
