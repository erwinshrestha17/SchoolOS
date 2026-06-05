import { redirectToPlatformRoute } from '../../_components/platform-route-redirect';

export default function PlatformHealthRedirect() {
  redirectToPlatformRoute('/platform/settings?tab=health');
}
