import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * Cloud Function to activate a subscription
 */
export const activateSubscription = functions.https.onCall(async (request) => {
  const { orgId, planId, userId } = request.data;
  
  if (!orgId || !planId || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
  }

  try {
    const db = admin.firestore();
    
    // Logic to activate subscription in Firestore
    await db.doc(`organizations/${orgId}/settings/subscription`).set({
      planId,
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Error activating subscription:', error);
    throw new functions.https.HttpsError('internal', 'Unable to activate subscription.');
  }
});

/**
 * Cloud Function for Asaas Webhook
 */
export const asaasWebhook = functions.https.onRequest(async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).send('Method Not Allowed');
    return;
  }

  const { event, payment } = request.body;
  console.log('Asaas Webhook received:', event, payment);

  // Logic to process webhook
  // ...

  response.status(200).send('Webhook processed');
});
