import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';

/**
 * M15 Notices & Announcements.
 *
 * The current notice implementation still lives in the legacy
 * `communications` package. This boundary keeps existing controllers,
 * routes, data and imports compatible while new work targets a precise
 * Notices domain instead of the former catch-all Communication module.
 *
 * Do not add chat responsibilities here. Chat is deferred and remains
 * fail-closed behind `feature.chat.enabled`.
 */
@Module({
  imports: [CommunicationsModule],
  exports: [CommunicationsModule],
})
export class NoticesModule {}
