import { MessageNotifier } from './MessageNotifier'
import { notificationService } from './NotificationService'
import { pushDeliveryService } from './PushDeliveryService'

export function createMessageNotifier(): MessageNotifier {
  return new MessageNotifier({
    notificationService,
    pushDeliveryService,
  })
}
