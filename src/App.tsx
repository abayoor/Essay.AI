import { lazy, Suspense } from 'react';
import { Route, Switch } from 'wouter';
import { BikeLoader } from './components/BikeLoader';
import { PersistentNavigationBar } from './components/PersistentNavigationBar';

const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })));
const BikesPage = lazy(() => import('./pages/BikesPage').then((module) => ({ default: module.BikesPage })));
const CoachPage = lazy(() => import('./pages/CoachPage').then((module) => ({ default: module.CoachPage })));
const CompetitionsPage = lazy(() => import('./pages/CompetitionsPage').then((module) => ({ default: module.CompetitionsPage })));
const ConfirmEmailPage = lazy(() => import('./pages/ConfirmEmailPage').then((module) => ({ default: module.ConfirmEmailPage })));
const ConversationPage = lazy(() => import('./pages/ConversationPage').then((module) => ({ default: module.ConversationPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const FeedPage = lazy(() => import('./pages/FeedPage').then((module) => ({ default: module.FeedPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const MapPage = lazy(() => import('./pages/MapPage').then((module) => ({ default: module.MapPage })));
const MarketplaceListingPage = lazy(() => import('./pages/MarketplaceListingPage').then((module) => ({ default: module.MarketplaceListingPage })));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage').then((module) => ({ default: module.MarketplacePage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then((module) => ({ default: module.MessagesPage })));
const NewMarketplaceListingPage = lazy(() => import('./pages/NewMarketplaceListingPage').then((module) => ({ default: module.NewMarketplaceListingPage })));
const NewPostPage = lazy(() => import('./pages/NewPostPage').then((module) => ({ default: module.NewPostPage })));
const NewRoutePage = lazy(() => import('./pages/NewRoutePage').then((module) => ({ default: module.NewRoutePage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage').then((module) => ({ default: module.PublicProfilePage })));
const RecordPage = lazy(() => import('./pages/RecordPage').then((module) => ({ default: module.RecordPage })));
const RideDetailPage = lazy(() => import('./pages/RideDetailPage').then((module) => ({ default: module.RideDetailPage })));
const RidesPage = lazy(() => import('./pages/RidesPage').then((module) => ({ default: module.RidesPage })));
const RouteDetailPage = lazy(() => import('./pages/RouteDetailPage').then((module) => ({ default: module.RouteDetailPage })));
const RoutesPage = lazy(() => import('./pages/RoutesPage').then((module) => ({ default: module.RoutesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

function PageFallback() {
  return <main className="route-loading"><BikeLoader label="" /></main>;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageFallback />}>
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
          <Route path="/coach" component={CoachPage} />
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
      </Suspense>
      <PersistentNavigationBar />
    </>
  );
}
