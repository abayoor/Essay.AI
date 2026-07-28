import { Route, Switch } from 'wouter';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { AuthPage } from './pages/AuthPage';
import { BikesPage } from './pages/BikesPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { NewRoutePage } from './pages/NewRoutePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProfilePage } from './pages/ProfilePage';
import { RouteDetailPage } from './pages/RouteDetailPage';
import { RoutesPage } from './pages/RoutesPage';

export default function App() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth/sign-in"><AuthPage mode="sign-in" /></Route>
      <Route path="/auth/sign-up"><AuthPage mode="sign-up" /></Route>
      <Route path="/auth/confirm" component={ConfirmEmailPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/bikes" component={BikesPage} />
      <Route path="/routes/new" component={NewRoutePage} />
      <Route path="/routes/:id" component={RouteDetailPage} />
      <Route path="/routes" component={RoutesPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}
