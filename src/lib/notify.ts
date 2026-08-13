import type { SubmissionPayload, SubmissionMeta } from './validation';
import type { CreatedSubmission } from './submissions';

/**
 * Notifies n8n that a submission is waiting. n8n owns the Discord approval card
 * and calls back into /api/submissions/:id to approve or reject.
 *
 * Fire-and-forget on purpose: a submitter should never see their car rejected
 * by a webhook outage. Failures are logged and the submission still lands in
 * the queue, where it stays visible to the admin view regardless.
 */
export function notifyNewSubmission(
  submission: CreatedSubmission,
  payload: SubmissionPayload,
  meta: SubmissionMeta,
  siteUrl: string
): void {
  const url = process.env.N8N_SUBMISSION_WEBHOOK_URL;
  if (!url) return; // Unconfigured in development — nothing to do.

  const body = {
    submissionId: submission.id,
    kind: submission.kind,
    targetPublicRef: submission.targetPublicRef,
    chassisNumber: payload.chassisNumber,
    eraCode: payload.eraCode,
    modelYear: payload.modelYear,
    // Submitter contact goes to moderators only, never to a public surface.
    submitterName: meta.submitterName,
    submitterEmail: meta.submitterEmail,
    submitterNote: meta.submitterNote,
    reviewUrl: `${siteUrl}/admin/submissions`,
    approveUrl: `${siteUrl}/api/submissions/${submission.id}`,
  };

  const timeout = AbortSignal.timeout(5000);

  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeout,
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`[notify] n8n webhook returned ${res.status} for ${submission.id}`);
      }
    })
    .catch((err) => {
      console.error(`[notify] n8n webhook failed for ${submission.id}:`, err.message);
    });
}
