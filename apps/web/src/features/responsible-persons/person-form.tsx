'use client';

import { FormEvent, useEffect, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import type { CreateResponsiblePersonDto, Management, ResponsiblePerson, Service, Unit } from '@/lib/types';
import {
  ErrorMessage,
  Field,
  FormActions,
  Modal,
  Select,
  getErrorMessage,
  normalizePersonForm,
} from '@/components/common';
import { PersonOperationsTab, PersonStockTab } from './person-stock-tabs';


const emptyPersonForm: CreateResponsiblePersonDto = {
  "lastName": "",
  "firstName": "",
  "middleName": "",
  "personnelNumber": "",
  "position": "",
  "phone": "",
  "email": "",
  "managementId": "",
  "serviceId": "",
  "unitId": "",
  "appointmentOrderNumber": "",
  "appointmentDate": "",
  "isActive": true
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
          appointmentDate: person.appointmentDate
            ? person.appointmentDate.slice(0, 10)
            : '',
          isActive: person.isActive,
        }
      : emptyPersonForm,
  );
  const [managements, setManagements] = useState<Management[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [personTab, setPersonTab] = useState<
    'general' | 'stock' | 'operations'
  >('general');

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

    const payload: CreateResponsiblePersonDto = normalizePersonForm(form);

    try {
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
    <Modal title={person ? 'Редагувати МВО' : 'Додати МВО'} onClose={onClose}>
      {person ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['general', 'Загальні дані'],
            ['stock', 'Залишки'],
            ['operations', 'Операції'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                personTab === id
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-slate-300 text-slate-700'
              }`}
              type="button"
              onClick={() =>
                setPersonTab(id as 'general' | 'stock' | 'operations')
              }
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {personTab === 'general' ? (
        <form className="grid gap-3" onSubmit={submit}>
          {error ? <ErrorMessage message={error} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Прізвище">
              <input
                required
                className="input"
                value={form.lastName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Ім’я">
              <input
                required
                className="input"
                value={form.firstName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="По батькові">
              <input
                className="input"
                value={form.middleName ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    middleName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Табельний номер">
              <input
                required
                className="input"
                value={form.personnelNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    personnelNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Посада">
              <input
                className="input"
                value={form.position ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    position: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Телефон">
              <input
                className="input"
                value={form.phone ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={form.email ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Управління">
              <Select
                required
                value={form.managementId}
                onChange={(managementId) =>
                  setForm((current) => ({
                    ...current,
                    managementId,
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
            </Field>
            <Field label="Служба">
              <Select
                required
                value={form.serviceId}
                onChange={(serviceId) =>
                  setForm((current) => ({ ...current, serviceId, unitId: '' }))
                }
              >
                <option value="">Оберіть службу</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Підрозділ">
              <Select
                value={form.unitId ?? ''}
                onChange={(unitId) =>
                  setForm((current) => ({ ...current, unitId }))
                }
              >
                <option value="">Без підрозділу</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Номер наказу">
              <input
                className="input"
                value={form.appointmentOrderNumber ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    appointmentOrderNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Дата призначення">
              <input
                className="input"
                type="date"
                value={form.appointmentDate ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    appointmentDate: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={form.isActive ?? true}
              type="checkbox"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            Активний запис
          </label>
          <FormActions saving={saving} onClose={onClose} />
        </form>
      ) : null}
      {person && personTab === 'stock' ? (
        <PersonStockTab personId={person.id} />
      ) : null}
      {person && personTab === 'operations' ? (
        <PersonOperationsTab personId={person.id} />
      ) : null}
    </Modal>
  );
}


