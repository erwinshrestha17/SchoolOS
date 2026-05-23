import { redirectToPlatformRoute } from '../../_components/platform-route-redirect';

export default function ProvidersRedirect() {
  redirectToPlatformRoute('/platform/settings?tab=providers');
}
