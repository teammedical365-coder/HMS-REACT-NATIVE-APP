/**
 * networkStatus.js — Reactive Online/Offline Connectivity Detection for React Native HMS
 * Unifies network status handling across HMS by delegating directly to the primary
 * offline networkStatus service layer.
 */

export {
  getNetworkState,
  isOnline,
  pingServer,
  checkOnlineStatus,
  subscribeNetworkStatus,
  useNetworkStatus,
} from '../services/offline/networkStatus';

import networkStatus from '../services/offline/networkStatus';
export default networkStatus;

