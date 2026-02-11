/**
 * Sync Queue Processor Service
 *
 * Processes queued offline operations (messages, etc.) when the socket reconnects.
 * Triggered by: socket reconnect, network online event, app foreground.
 */

import { cacheManager } from '../database/CacheManager';
import { sendMessageViaSocketAsync, sendTemplateViaSocketAsync, isSocketConnected } from './socketService';
import { updateQueuedMessageStatus } from '../redux/slices/inboxSlice';

let isProcessing = false;


/**
 * Process all pending items in the sync queue.
 * @param {Function} dispatch - Redux dispatch function
 */
export async function processSyncQueue(dispatch) {
  if (isProcessing) {
    return;
  }
  if (!isSocketConnected()) {
    return;
  }

  isProcessing = true;

  try {
    const pendingOps = await cacheManager.getPendingSyncOperations();

    if (!pendingOps || pendingOps.length === 0) {
      return;
    }

    for (const op of pendingOps) {
      // Stop if socket disconnects mid-processing
      if (!isSocketConnected()) {
        break;
      }

      try {
        const data = JSON.parse(op.data);

        if (op.operation === 'sendMessage') {
          // await ensures we wait for server ack (or timeout) before next message
          const sent = await sendMessageViaSocketAsync(data.socketData);

          if (sent) {
            await cacheManager.markSyncCompleted(op.id);
            // Update the optimistic message status from 'queued' back to 'pending'
            // Socket handlers will update to 'sent' when server confirms
            if (dispatch && data.chatId && data.tempId) {
              dispatch(updateQueuedMessageStatus({
                chatId: data.chatId,
                tempId: data.tempId,
                status: 'pending',
              }));
            }
          } else {
            await cacheManager.markSyncFailed(op.id, 'Socket not connected');
          }
        } else if (op.operation === 'sendTemplate') {
          // await ensures we wait for server ack (or timeout) before next template
          const sent = await sendTemplateViaSocketAsync(data.socketData);

          if (sent) {
            await cacheManager.markSyncCompleted(op.id);
            if (dispatch && data.chatId && data.tempId) {
              dispatch(updateQueuedMessageStatus({
                chatId: data.chatId,
                tempId: data.tempId,
                status: 'pending',
              }));
            }
          } else {
            await cacheManager.markSyncFailed(op.id, 'Socket not connected');
          }
        }
        // Future: handle other operation types (update, delete)

      } catch (opError) {
        await cacheManager.markSyncFailed(op.id, opError.message || 'Processing error');
      }
    }

    // Cleanup completed and old failed operations
    try {
      await cacheManager.cleanupSyncQueue();
    } catch (cleanupError) {
      // Non-critical — ignore cleanup errors
    }
  } catch (e) {
    // Queue processing error — will retry on next trigger
  } finally {
    isProcessing = false;
  }
}
