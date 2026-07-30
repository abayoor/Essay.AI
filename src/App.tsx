import { Route, Switch } from 'wouter';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { AuthPage } from './pages/AuthPage';
import { BikesPage } from './pages/BikesPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { ConversationPage } from './pages/ConversationPage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { DashboardPage } from './pages/DashboardPage';
import { FeedPage } from './pages/FeedPage';
import { HomePage } from './pages/HomePage';
import { MessagesPage } from './pages/MessagesPage';
import { MapPage } from './pages/MapPage';
import { MarketplaceListingPage } from './pages/MarketplaceListingPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { NewMarketplaceListingPage } from './pages/NewMarketplaceListingPage';
import { NewPostPage } from './pages/NewPostPage';
import { NewRoutePage } from './pages/NewRoutePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProfilePage } from './pages/ProfilePage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { RecordPage } from './pages/RecordPage';
import { RideDetailPage } from './pages/RideDetailPage';
import { RidesPage } from './pages/RidesPage';
import { RouteDetailPage } from './pages/RouteDetailPage';
import { RoutesPage } from './pages/RoutesPage';
import { SettingsPage } from './pages/SettingsPage';

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
      <Route path="/feed" component={FeedPage} />
      <Route path="/map" component={MapPage} />
      <Route path="/marketplace/new" component={NewMarketplaceListingPage} />
      <Route path="/marketplace/:id" component={MarketplaceListingPage} />
      <Route path="/marketplace" component={MarketplacePage} />
      <Route path="/competitions" component={CompetitionsPage} />
      <Route path="/record" component={RecordPage} />
      <Route path="/rides/:id" component={RideDetailPage} />
      <Route path="/rides" component={RidesPage} />
      <Route path="/posts/new" component={NewPostPage} />
      <Route path="/messages/:id" component={ConversationPage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/routes/new" component={NewRoutePage} />
      <Route path="/routes/:id" component={RouteDetailPage} />
      <Route path="/routes" component={RoutesPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/u/:username" component={PublicProfilePage} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}
