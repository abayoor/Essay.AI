import { Route, Switch } from 'wouter';
import { AuthPage } from './pages/AuthPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { DashboardPage } from './pages/DashboardPage';
import { EssayEditorPage } from './pages/EssayEditorPage';
import { HomePage } from './pages/HomePage';
import { NewEssayPage } from './pages/NewEssayPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OnboardingPage } from './pages/OnboardingPage';

// Здесь живут только маршруты. Сами экраны складывай в src/pages/.
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
      <Route path="/essays/new" component={NewEssayPage} />
      <Route path="/essays/:id/edit" component={EssayEditorPage} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}
