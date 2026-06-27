import { useSubscriptionContext } from '../components/SubscriptionProvider';

export function useSubscription() {
  return useSubscriptionContext();
}
