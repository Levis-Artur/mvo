'use client';

import { useCallback, useEffect, useState } from 'react';
import { usersService as apiClient } from './users.service';
import { useAuth } from '@/app/ui/auth-context';
import { can, getUserManagementResource } from '@/lib/authz';
import type { UserSummary } from '@/lib/types';
import {
  ErrorMessage,
  LoadingMessage,
  PageHeader,
  TemporaryPasswordModal,
  Toast,
  getErrorMessage,
} from '@/components/common';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';

import { UsersTable } from './users-table';
import { UserFormModal } from './user-form-modal';
import { DestructiveActionModal } from '@/features/admin/destructive-action-modal';
import { canShowDestructiveActions } from '@/features/admin/destructive-actions';
import { ResetTestDataModal } from '@/features/admin/reset-test-data-modal';
import { ADMIN_ENTITY_TYPES } from '@/features/admin/admin-entity-types';

export function UsersView() {
  const { user } = useAuth();
  const userResource = getUserManagementResource(user);
  const canWriteUsers = can(user, 'write', userResource);
  const canResetPasswords = can(user, 'resetPassword', userResource);
  const canRevokeSessions = can(user, 'revokeSessions', userResource);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [deletingUser, setDeletingUser] = useState<UserSummary | null>(null);
  const [toast, setToast] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const canDelete = canShowDestructiveActions(user?.role);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await apiClient.users());
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'users') return;

      if (detail.action === 'create' && canWriteUsers) {
        setEditingUser(null);
        setFormOpen(true);
      }

      if (detail.action === 'refresh') {
        void loadUsers();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [canWriteUsers, loadUsers]);

  async function runUserAction(
    action: () => Promise<unknown>,
    options: { reload?: boolean } = { reload: true },
  ) {
    setError('');
    try {
      await action();
      if (options.reload) {
        await loadUsers();
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }

  async function resetPassword(targetUser: UserSummary) {
    await runUserAction(async () => {
      const response = await apiClient.resetUserPassword(targetUser.id);
      setTemporaryPassword(response.temporaryPassword);
    });
  }

  return (
    <section className="grid gap-3">
      <PageHeader
        title={userResource === 'users' ? 'Користувачі' : 'Користувачі МВО'}
        description="Керування доступом до системи."
        action={
          canWriteUsers ? (
            <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setEditingUser(null);
                setFormOpen(true);
              }}
            >
              Створити користувача
            </button>
            {canDelete ? (
              <button className="btn btn-danger" type="button" onClick={() => setResetOpen(true)}>
                Очистити тестові дані
              </button>
            ) : null}
            </div>
          ) : undefined
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingMessage /> : null}
      {!loading ? (
        <UsersTable
          canDelete={canDelete}
          canResetPassword={canResetPasswords}
          canRevokeSessions={canRevokeSessions}
          canWrite={canWriteUsers}
          users={users}
          onActivate={(targetUser) =>
            void runUserAction(() => apiClient.activateUser(targetUser.id))
          }
          onBlock={(targetUser) =>
            void runUserAction(() => apiClient.blockUser(targetUser.id))
          }
          onDeactivate={(targetUser) =>
            void runUserAction(() => apiClient.deactivateUser(targetUser.id))
          }
          onEdit={(targetUser) => {
            setEditingUser(targetUser);
            setFormOpen(true);
          }}
          onResetPassword={(targetUser) => {
            void resetPassword(targetUser);
          }}
          onRevokeSessions={(targetUser) =>
            void runUserAction(() => apiClient.revokeUserSessions(targetUser.id))
          }
          onUnblock={(targetUser) =>
            void runUserAction(() => apiClient.unblockUser(targetUser.id))
          }
          onDelete={setDeletingUser}
        />
      ) : null}

      {isFormOpen ? (
        <UserFormModal
          mode={userResource}
          user={editingUser}
          onClose={() => setFormOpen(false)}
          onSaved={(password) => {
            setFormOpen(false);
            if (password) {
              setTemporaryPassword(password);
            }
            void loadUsers();
          }}
        />
      ) : null}

      {temporaryPassword ? (
        <TemporaryPasswordModal
          temporaryPassword={temporaryPassword}
          onClose={() => setTemporaryPassword('')}
        />
      ) : null}
      {deletingUser ? (
        <DestructiveActionModal
          entityType={ADMIN_ENTITY_TYPES.user}
          entityId={deletingUser.id}
          onClose={() => setDeletingUser(null)}
          onDeleted={async () => {
            await loadUsers();
            setToast('Користувача видалено.');
          }}
        />
      ) : null}
      {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}
      {resetOpen ? (
        <ResetTestDataModal
          onClose={() => setResetOpen(false)}
          onReset={async () => {
            await loadUsers();
            setToast('Тестові дані очищено.');
          }}
        />
      ) : null}
    </section>
  );
}


