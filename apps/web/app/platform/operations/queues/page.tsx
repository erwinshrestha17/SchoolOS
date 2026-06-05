import { redirectToPlatformRoute } from '../../_components/platform-route-redirect';

export default function PlatformQueuesRedirect() {
  redirectToPlatformRoute('/platform/settings?tab=queues');
}
