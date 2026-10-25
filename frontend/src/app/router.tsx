import { createBrowserRouter, Link, Navigate, Outlet } from 'react-router-dom';
import { Layout, Protected } from './Layout';
import { UnsavedChangesProvider } from './UnsavedChanges';
import { useAuth } from '../features/auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { PatientsPage } from '../features/patients/PatientsPage';
import { PatientPage } from '../features/patients/PatientPage';
import { OverviewPage } from '../features/users/OverviewPage';
import { UsersPage } from '../features/users/UsersPage';
import { Empty } from '../shared/ui';
function Home() {
  const { user } = useAuth();
  return <Navigate replace to={user?.role === 'Admin' ? '/admin/overview' : '/patients'} />;
}
function NotFound() {
  return (
    <Empty title="Táto stránka sa nenašla.">
      <Link className="text-link" to="/">
        Späť na úvod
      </Link>
    </Empty>
  );
}
export const router = createBrowserRouter([
  {
    element: (
      <UnsavedChangesProvider>
        <Outlet />
      </UnsavedChangesProvider>
    ),
    errorElement: (
      <Empty title="Stránku sa nepodarilo zobraziť.">
        <a className="text-link" href="/">
          Obnoviť aplikáciu
        </a>
      </Empty>
    ),
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <Protected />,
        children: [
          {
            element: <Layout />,
            children: [
              { index: true, element: <Home /> },
              { path: '/patients', element: <PatientsPage /> },
              { path: '/patients/:patientId', element: <PatientPage /> },
              {
                element: <Protected admin />,
                children: [
                  { path: '/admin/overview', element: <OverviewPage /> },
                  { path: '/admin/users', element: <UsersPage /> },
                ],
              },
              { path: '*', element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
]);
