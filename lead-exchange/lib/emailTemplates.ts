function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// Wording is Fabien's, verbatim -- not paraphrased or extended here.
export function applicationReceivedEmail(contactName: string): EmailContent {
  const name = escapeHtml(contactName);
  return {
    subject: "We've received your Halo Lead Exchange application",
    text: `Hi ${contactName},

Thanks for applying to join the Halo Strategic Lead Exchange.

We've received your application and our team will review your business details, service areas and requirements.

We'll be in touch with the next steps shortly.

Kind regards,
Halo Strategic`,
    html: `<p>Hi ${name},</p>
<p>Thanks for applying to join the Halo Strategic Lead Exchange.</p>
<p>We've received your application and our team will review your business details, service areas and requirements.</p>
<p>We'll be in touch with the next steps shortly.</p>
<p>Kind regards,<br>Halo Strategic</p>`,
  };
}

// Deliberately does not say the buyer is active -- approval here means approved to proceed
// to commercial discussion, not activation. Activation is a separate, later step.
export function applicationApprovedForCommercialReviewEmail(contactName: string): EmailContent {
  const name = escapeHtml(contactName);
  return {
    subject: 'Your Halo Lead Exchange application has progressed',
    text: `Hi ${contactName},

Good news — your application has been reviewed and approved to proceed to the commercial agreement stage.

We'll be in touch to confirm your service area, lead pricing, availability and purchasing arrangements.

Your buyer account is not yet active. We'll confirm activation once the commercial arrangements have been agreed.

Kind regards,
Halo Strategic`,
    html: `<p>Hi ${name},</p>
<p>Good news — your application has been reviewed and approved to proceed to the commercial agreement stage.</p>
<p>We'll be in touch to confirm your service area, lead pricing, availability and purchasing arrangements.</p>
<p>Your buyer account is not yet active. We'll confirm activation once the commercial arrangements have been agreed.</p>
<p>Kind regards,<br>Halo Strategic</p>`,
  };
}
