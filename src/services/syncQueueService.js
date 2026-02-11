/**
 * Sync Queue Processor Service
 *
 * Processes queued offline operations (messages, etc.) when the socket reconnects.
 * Triggered by: socket reconnect, network online event, app foreground.
 */

import { cacheManager } from '../database/CacheManager';
import { sendMessageViaSocket, sendTemplateViaSocket, isSocketConnected } from './socketService';
import { updateQueuedMessageStatus } from '../redux/slices/inboxSlice';

let isProcessing = false;

/**
 * Process all pending items in the sync queue.
 * @param {Function} dispatch - Redux dispatch function
 */
export async function processSyncQueue(dispatch) {
  if (isProcessing) {
    console.log('[SyncQueue] Already processing — skipping');
    return;
  }
  if (!isSocketConnected()) {
    console.log('[SyncQueue] Socket not connected — skipping');
    return;
  }

  isProcessing = true;
  console.log('[SyncQueue] Starting queue processing...');

  try {
    const pendingOps = await cacheManager.getPendingSyncOperations();

    if (!pendingOps || pendingOps.length === 0) {
      console.log('[SyncQueue] No pending operations found');
      return;
    }

    console.log(`[SyncQueue] Found ${pendingOps.length} pending operation(s)`);

    for (const op of pendingOps) {
      // Stop if socket disconnects mid-processing
      if (!isSocketConnected()) {
        console.log('[SyncQueue] Socket disconnected mid-processing — stopping');
        break;
      }

      try {
        const data = JSON.parse(op.data);
        console.log(`[SyncQueue] Processing op: id=${op.id}, type=${op.operation}, tempId=${data.tempId}`);

        if (op.operation === 'sendMessage') {
          const sent = sendMessageViaSocket(data.socketData);

          if (sent) {
            console.log(`[SyncQueue] sendMessage sent successfully — marking completed (tempId=${data.tempId})`);
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
            console.log(`[SyncQueue] sendMessage failed — socket not connected (tempId=${data.tempId})`);
            await cacheManager.markSyncFailed(op.id, 'Socket not connected');
          }
        } else if (op.operation === 'sendTemplate') {
          const sent = sendTemplateViaSocket(data.socketData);

          if (sent) {
            console.log(`[SyncQueue] sendTemplate sent successfully — marking completed (tempId=${data.tempId})`);
            await cacheManager.markSyncCompleted(op.id);
            if (dispatch && data.chatId && data.tempId) {
              dispatch(updateQueuedMessageStatus({
                chatId: data.chatId,
                tempId: data.tempId,
                status: 'pending',
              }));
            }
          } else {
            console.log(`[SyncQueue] sendTemplate failed — socket not connected (tempId=${data.tempId})`);
            await cacheManager.markSyncFailed(op.id, 'Socket not connected');
          }
        }
        // Future: handle other operation types (update, delete)

      } catch (opError) {
        console.log(`[SyncQueue] Error processing op ${op.id}:`, opError.message);
        await cacheManager.markSyncFailed(op.id, opError.message || 'Processing error');
      }
    }

    // Cleanup completed and old failed operations
    try {
      await cacheManager.cleanupSyncQueue();
      console.log('[SyncQueue] Queue cleanup completed');
    } catch (cleanupError) {
      // Non-critical — ignore cleanup errors
    }
  } catch (error) {
    console.log('[SyncQueue] Queue processing error:', error.message);
    // Queue processing error — will retry on next trigger
  } finally {
    isProcessing = false;
    console.log('[SyncQueue] Queue processing finished');
  }
}
