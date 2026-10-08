import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider, useSession } from "./auth";
import { Loading } from "./components/Feedback";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/coordinator/Dashboard";
import { Students } from "./pages/coordinator/Students";
import { RoutesPage } from "./pages/coordinator/RoutesPage";
import { Trips } from "./pages/coordinator/Trips";
import { Users } from "./pages/coordinator/Users";
import { DelayPrediction } from "./pages/coordinator/DelayPrediction";
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

  return (
    <Routes>
      <Route element={<Layout />}>
        {user.role === "coordinator" && (
          <>
            <Route index element={<Dashboard />} />
            <Route path="estudiantes" element={<Students />} />
            <Route path="rutas" element={<RoutesPage />} />
            <Route path="recorridos" element={<Trips />} />
            <Route path="usuarios" element={<Users />} />
            <Route path="retrasos" element={<DelayPrediction />} />
          </>
        )}
        {user.role === "driver" && (
          <>
            <Route index element={<DriverTrip />} />
            <Route path="retrasos" element={<DelayPrediction />} />
          </>
        )}
        {user.role === "monitor" && <Route index element={<DriverTrip />} />}
        {user.role === "guardian" && <Route index element={<GuardianHome />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
