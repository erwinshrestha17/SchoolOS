import { redirectToPlatformRoute } from '../../_components/platform-route-redirect';

export default function PlansRedirect() {
  redirectToPlatformRoute('/platform/settings?tab=plans');
}
