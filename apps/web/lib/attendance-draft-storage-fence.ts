export type AttendanceDraftStorageTicket = Readonly<{
  generation: number;
}>;

export class AttendanceDraftStorageInvalidatedError extends Error {
  constructor() {
    super("Attendance draft storage authority changed");
    this.name = "AttendanceDraftStorageInvalidatedError";
  }
}

/**
 * Serializes browser-draft operations and fences work captured before an
 * identity teardown. Invalidation is synchronous: an old asynchronous write
 * can finish only ahead of the queued clear, and any old write queued after
 * that clear is rejected before it reaches storage.
 */
export class AttendanceDraftStorageFence {
  private generation = 0;
  private operationQueue: Promise<void> = Promise.resolve();

  captureTicket(): AttendanceDraftStorageTicket {
    return { generation: this.generation };
  }

  invalidate(): AttendanceDraftStorageTicket {
    this.generation += 1;
    return this.captureTicket();
  }

  isCurrent(ticket: AttendanceDraftStorageTicket): boolean {
    return ticket.generation === this.generation;
  }

  run<T>(
    ticket: AttendanceDraftStorageTicket,
    operation: () => Promise<T> | T,
  ): Promise<T> {
    const result = this.operationQueue.then(async () => {
      this.assertCurrent(ticket);
      const value = await operation();
      this.assertCurrent(ticket);
      return value;
    });

    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private assertCurrent(ticket: AttendanceDraftStorageTicket): void {
    if (!this.isCurrent(ticket)) {
      throw new AttendanceDraftStorageInvalidatedError();
    }
  }
}
