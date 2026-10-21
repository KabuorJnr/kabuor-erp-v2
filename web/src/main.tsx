import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router';
import './index.css';
import { registerShell } from './lib/offline';
import { reportError, startMonitoring } from './lib/monitoring';
import { can, getSession, useSession, type Permission } from './lib/api';
import Shell from './components/Shell';
import { ChooseOwnPassword, SignIn, SignUp } from './pages/Auth';
import Today from './pages/Today';
import { InvoiceList } from './pages/Invoices';
import InvoiceEditor from './pages/InvoiceEditor';
import InvoiceView from './pages/InvoiceView';
import { CustomerList, CustomerView } from './pages/Customers';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { PurchaseList } from './pages/Purchases';
import PurchaseEditor from './pages/PurchaseEditor';
import PurchaseView from './pages/PurchaseView';
import { SupplierList, SupplierView } from './pages/Suppliers';
import Stock from './pages/Stock';
import { EmployeeList, EmployeeView } from './pages/Employees';
import Leave from './pages/Leave';
import { PayrollList, PayrollRun } from './pages/Payroll';
import { LeadView, Pipeline } from './pages/Pipeline';
import Production from './pages/Production';
import { CampaignEditor, CampaignList, CampaignView } from './pages/Campaigns';

import Pos from './pages/Pos';
import Intelligence from './pages/Intelligence';
import Inquiries from './pages/Inquiries';
import Links from './pages/Links';
import Shop from './pages/Shop';
import { Privacy, Terms } from './pages/Legal';
import MyPortal from './pages/MyPortal';
import Agents from './pages/Agents';
import Security from './pages/Security';
import Reconcile from './pages/Reconcile';
import EtimsInbox from './pages/EtimsInbox';

/** A page outside this person's role: say so plainly instead of showing a half-loaded screen. */
function Need({ p, children }: { p: Permission; children: React.ReactNode }) {
  if (can(getSession(), p)) return <>{children}</>;
  return (
    <div className="card mx-auto mt-10 max-w-md px-6 py-10 text-center">
      <p className="font-semibold">This isn’t part of your role</p>
      <p className="mt-1 text-sm text-muted">Ask the owner to change your role in Settings if you need it.</p>
      <Link to="/" className="btn btn-primary mt-4">Back to Today</Link>
    </div>
  );
}

function App() {
  const session = useSession();
  if (!session)
    return (
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/s/:slug" element={<Shop />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<SignIn />} />
      </Routes>
    );
  if (session.user.mustChangePassword) return <ChooseOwnPassword session={session} />;
  return (
    <Routes>
      <Route path="privacy" element={<Privacy />} />
      <Route path="s/:slug" element={<Shop />} />
      <Route path="terms" element={<Terms />} />
      <Route element={<Shell session={session} />}>
        <Route
          index
          element={
            session.user.role === 'Employee' ? (
              <Navigate to="/portal" replace />
            ) : session.user.role === 'Sales' ? (
              <Navigate to="/pos" replace />
            ) : (
              <Today />
            )
          }
        />
        <Route path="pos" element={<Need p="pos"><Pos /></Need>} />
        <Route path="portal" element={<MyPortal />} />
        <Route path="invoices" element={<Need p="sales.view"><InvoiceList kind="Invoice" /></Need>} />
        <Route path="quotes" element={<Need p="sales.view"><InvoiceList kind="Quote" /></Need>} />
        <Route path="invoices/new" element={<Need p="sell"><InvoiceEditor kind="Invoice" /></Need>} />
        <Route path="quotes/new" element={<Need p="sell"><InvoiceEditor kind="Quote" /></Need>} />
        <Route path="sales/:id" element={<Need p="sales.view"><InvoiceView /></Need>} />
        <Route path="sales/:id/edit" element={<Need p="sell"><InvoiceEditor kind="Invoice" /></Need>} />
        <Route path="customers" element={<Need p="sales.view"><CustomerList /></Need>} />
        <Route path="customers/:id" element={<Need p="sales.view"><CustomerView /></Need>} />
        <Route path="purchases" element={<Need p="buy.view"><PurchaseList /></Need>} />
        <Route path="purchases/new" element={<Need p="buy.view"><PurchaseEditor /></Need>} />
        <Route path="purchases/:id" element={<Need p="buy.view"><PurchaseView /></Need>} />
        <Route path="purchases/:id/edit" element={<Need p="buy.view"><PurchaseEditor /></Need>} />
        <Route path="suppliers" element={<Need p="buy.view"><SupplierList /></Need>} />
        <Route path="suppliers/:id" element={<Need p="buy.view"><SupplierView /></Need>} />
        <Route path="stock" element={<Need p="stock.view"><Stock /></Need>} />
        <Route path="people" element={<Need p="people"><EmployeeList /></Need>} />
        <Route path="people/:id" element={<Need p="people"><EmployeeView /></Need>} />
        <Route path="leave" element={<Need p="people"><Leave /></Need>} />
        <Route path="payroll" element={<Need p="people"><PayrollList /></Need>} />
        <Route path="payroll/:id" element={<Need p="people"><PayrollRun /></Need>} />
        <Route path="pipeline" element={<Need p="crm"><Pipeline /></Need>} />
        <Route path="pipeline/:id" element={<Need p="crm"><LeadView /></Need>} />
        <Route path="production" element={<Need p="make"><Production /></Need>} />
        <Route path="campaigns" element={<Need p="crm"><CampaignList /></Need>} />
        <Route path="intelligence" element={<Need p="reports"><Intelligence /></Need>} />
        <Route path="inquiries" element={<Need p="sales.view"><Inquiries /></Need>} />
        <Route path="links" element={<Need p="crm"><Links /></Need>} />
        <Route path="campaigns/new" element={<Need p="crm"><CampaignEditor /></Need>} />
        <Route path="campaigns/:id" element={<Need p="crm"><CampaignView /></Need>} />
        <Route path="money-in" element={<Need p="sales.view"><Payments /></Need>} />
        <Route path="reports" element={<Need p="reports"><Reports /></Need>} />
        <Route path="agents" element={<Agents />} />
        <Route path="security" element={<Security />} />
        <Route path="purchases/etims" element={<Need p="finance"><EtimsInbox /></Need>} />
        <Route path="reconcile" element={<Need p="finance"><Reconcile /></Need>} />
        <Route path="settings" element={<Need p="admin"><Settings /></Need>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

registerShell();
startMonitoring();
createRoot(document.getElementById('root')!, { onUncaughtError: (e) => (reportError(e), console.error(e)), onCaughtError: (e) => reportError(e) }).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
