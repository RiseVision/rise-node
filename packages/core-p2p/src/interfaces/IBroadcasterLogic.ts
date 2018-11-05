import { PeerType } from '@risevision/core-types';
import { BroadcastFilters, BroadcastTask } from '../broadcaster';
import { BaseTransportMethod, SingleTransportPayload } from '../requests';

export interface IBroadcasterLogic {
  /**
   * Checks if object is entitled for being broadcasted. If so it will enqueue the object.
   * @param payload payload object to broadcast
   * @param method
   * @param filters eventual filters.
   */
  maybeEnqueue<Body, Query, Out>(
    payload: SingleTransportPayload<Body & { relays?: number }, Query>,
    method: BaseTransportMethod<Body, Query, Out>,
    filters?: BroadcastFilters
  ): boolean;

  enqueue<Body, Query, Out>(
    payload: SingleTransportPayload<Body, Query>,
    method: BaseTransportMethod<Body, Query, Out>,
    filters?: BroadcastFilters
  ): number;

  broadcast(task: BroadcastTask<any, any, any>): Promise<{ peer: PeerType[] }>;

  /**
   * Count relays, eventually increment by one and return true if broadcast is exhausted
   */
  maxRelays(): number;
}
