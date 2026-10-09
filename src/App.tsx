import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider, useSession } from "./auth";
import { Loading } from "./components/Feedback";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Notifications } from "./pages/Notifications";
import { Catalogs } from "./pages/coordinator/Catalogs";
import { Dashboard } from "./pages/coordinator/Dashboard";
import { Fleet } from "./pages/coordinator/Fleet";
import { Intelligence } from "./pages/coordinator/Intelligence";
import { Audit, Incidents, Structures } from "./pages/coordinator/Monitoring";
import { RoutesPage } from "./pages/coordinator/RoutesPage";
import { Students } from "./pages/coordinator/Students";
import { Trips } from "./pages/coordinator/Trips";
import { Users } from "./pages/coordinator/Users";
import { DriverTrip } from "./pages/driver/DriverTrip";
import { GuardianHome } from "./pages/guardian/GuardianHome";

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  );
}

function AppRoutes() {
  const { user, checking } = useSession();

  if (checking) return <Loading text="Abriendo RutaSegura…" />;
  if (!user) return <Login />;
  const role = user.role.code;

  return (
    <Routes>
      <Route element={<Layout />}>
        {role === "coordinator" && (
          <>
            <Route index element={<Dashboard />} />
            <Route path="estudiantes" element={<Students />} />
            <Route path="rutas" element={<RoutesPage />} />
            <Route path="recorridos" element={<Trips />} />
            <Route path="usuarios" element={<Users />} />
            <Route path="flota" element={<Fleet />} />
            <Route path="catalogos" element={<Catalogs />} />
            <Route path="inteligencia" element={<Intelligence />} />
            <Route path="incidentes" element={<Incidents />} />
            <Route path="estructuras" element={<Structures />} />
            <Route path="auditoria" element={<Audit />} />
          </>
        )}
        {(role === "driver" || role === "monitor") && (
          <>
            <Route index element={<DriverTrip />} />
            <Route path="inteligencia" element={<Intelligence />} />
          </>
        )}
        {role === "guardian" && <Route index element={<GuardianHome />} />}
        <Route path="notificaciones" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
