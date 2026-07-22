import { ProtectedMvoApp } from '../../../ui/protected-mvo-app';

export default function AccountingMvoTransferExportsPage() {
  return (
    <ProtectedMvoApp
      initialAccountingTab="exports"
      initialView="accounting-transfers"
    />
  );
}
