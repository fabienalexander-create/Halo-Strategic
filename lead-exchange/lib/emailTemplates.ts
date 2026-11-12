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

// Internal notification to admin_users -- never sent to the applicant. Deliberately minimal:
// just enough to prompt a login and review, not a substitute for actually reading the
// application in /admin/applications/[reference].
export function adminNewApplicationEmail(params: {
  companyName: string;
  contactName: string;
  industryLabel: string;
  applicationReference: string;
}): EmailContent {
  const company = escapeHtml(params.companyName);
  const contact = escapeHtml(params.contactName);
  const industry = escapeHtml(params.industryLabel);
  const reference = escapeHtml(params.applicationReference);
  return {
    subject: `New ${params.industryLabel} buyer application: ${params.companyName}`,
    text: `A new buyer application has been submitted.

Company: ${params.companyName}
Contact: ${params.contactName}
Industry: ${params.industryLabel}
Application reference: ${params.applicationReference}

Review it in the admin panel under Applications.`,
    html: `<p>A new buyer application has been submitted.</p>
<p>
Company: ${company}<br>
Contact: ${contact}<br>
Industry: ${industry}<br>
Application reference: ${reference}
</p>
<p>Review it in the admin panel under Applications.</p>`,
  };
}

// First part of a UK postcode only (e.g. 'SW1A' from 'SW1A 1AA') -- the "general location" the
// marketing pages (spray-foam-removal, solar-battery, roofing) promise in the pre-payment
// preview. Never the full postcode -- that's homeowner contact detail, released only after
// payment (or package cover) via leadUnlockedEmail below.
function outwardPostcode(postcode: string): string {
  return postcode.trim().split(/\s+/)[0] || postcode;
}

// Sent to the buyer when an allocation is created. Deliberately carries no homeowner contact
// detail -- only what the marketing pages already promise pre-payment (area, property type,
// service requirement) -- same redaction boundary as leads.homeowner_contact's own "never exposed
// pre-payment" comment in the schema.
export function leadOfferEmail(params: {
  leadReference: string;
  industryLabel: string;
  postcode: string;
  propertyType: string;
  serviceRequirement: string;
  currency: string;
  price: number | null; // null when packageCovered
  packageCovered: boolean;
  paymentReference: string | null; // quote this when paying; null when packageCovered
}): EmailContent {
  const reference = escapeHtml(params.leadReference);
  const industry = escapeHtml(params.industryLabel);
  const area = escapeHtml(outwardPostcode(params.postcode));
  const propertyType = escapeHtml(params.propertyType);
  const serviceRequirement = escapeHtml(params.serviceRequirement);

  const paymentText = params.packageCovered
    ? `This lead is covered by your package -- no payment is needed. We'll confirm once it's released.`
    : `Price: ${params.currency} ${params.price?.toFixed(2)}
To release the homeowner's contact details, pay by bank transfer and quote reference ${params.paymentReference} so we can match your payment. We'll confirm by email once it's verified.`;
  const paymentHtml = params.packageCovered
    ? `<p>This lead is covered by your package — no payment is needed. We'll confirm once it's released.</p>`
    : `<p>Price: ${escapeHtml(params.currency)} ${escapeHtml(params.price?.toFixed(2) ?? '')}<br>
To release the homeowner's contact details, pay by bank transfer and quote reference <strong>${escapeHtml(params.paymentReference ?? '')}</strong> so we can match your payment. We'll confirm by email once it's verified.</p>`;

  return {
    subject: `New ${params.industryLabel} lead available: ${params.leadReference}`,
    text: `Hi,

A new lead is available for you.

Reference: ${params.leadReference}
Industry: ${params.industryLabel}
Area: ${outwardPostcode(params.postcode)}
Property type: ${params.propertyType}
Service required: ${params.serviceRequirement}

${paymentText}

Kind regards,
Halo Strategic`,
    html: `<p>Hi,</p>
<p>A new lead is available for you.</p>
<p>
Reference: ${reference}<br>
Industry: ${industry}<br>
Area: ${area}<br>
Property type: ${propertyType}<br>
Service required: ${serviceRequirement}
</p>
${paymentHtml}
<p>Kind regards,<br>Halo Strategic</p>`,
  };
}

// Internal copy of leadOfferEmail, to the admin mailbox -- same redaction boundary (no homeowner
// contact detail yet), plus which buyer it went to, since the buyer-facing email doesn't name
// Halo Strategic's own records.
export function internalOfferCopyEmail(params: {
  leadReference: string;
  companyName: string;
  industryLabel: string;
  postcode: string;
  price: number | null;
  packageCovered: boolean;
}): EmailContent {
  const reference = escapeHtml(params.leadReference);
  const company = escapeHtml(params.companyName);
  const industry = escapeHtml(params.industryLabel);
  const area = escapeHtml(outwardPostcode(params.postcode));
  const priceLine = params.packageCovered ? 'Package-covered (no payment due)' : `${params.price?.toFixed(2) ?? ''} (awaiting verified payment)`;
  return {
    subject: `[Internal] Lead ${params.leadReference} offered to ${params.companyName}`,
    text: `Lead ${params.leadReference} (${params.industryLabel}, ${outwardPostcode(params.postcode)}) was offered to ${params.companyName}.

Price: ${priceLine}`,
    html: `<p>Lead ${reference} (${industry}, ${area}) was offered to ${company}.</p>
<p>Price: ${escapeHtml(priceLine)}</p>`,
  };
}

// Sent to the buyer once an allocation is released (paid and verified, or package-covered, with
// an un-withdrawn homeowner confirmation) -- the only point homeowner contact detail is ever
// emailed to a buyer. Only ever called after allocation_release_check has already passed at the
// database layer (see lib/leadDeliveryEmail.ts); this template itself does no gating.
export function leadUnlockedEmail(params: {
  leadReference: string;
  industryLabel: string;
  homeownerName: string;
  phone: string;
  email: string;
  postcode: string;
  propertyType: string;
  serviceRequirement: string;
}): EmailContent {
  const reference = escapeHtml(params.leadReference);
  const industry = escapeHtml(params.industryLabel);
  const name = escapeHtml(params.homeownerName);
  const phone = escapeHtml(params.phone);
  const email = escapeHtml(params.email);
  const postcode = escapeHtml(params.postcode);
  const propertyType = escapeHtml(params.propertyType);
  const serviceRequirement = escapeHtml(params.serviceRequirement);
  return {
    subject: `Lead ${params.leadReference} unlocked -- contact details enclosed`,
    text: `Hi,

Lead ${params.leadReference} is now unlocked. Here are the homeowner's details:

Name: ${params.homeownerName}
Phone: ${params.phone}
Email: ${params.email}
Postcode: ${params.postcode}
Property type: ${params.propertyType}
Service required: ${params.serviceRequirement}
Industry: ${params.industryLabel}

Please contact the homeowner promptly. If you're unable to reach them, see the Lead Replacement Policy for what to do next.

Kind regards,
Halo Strategic`,
    html: `<p>Hi,</p>
<p>Lead ${reference} is now unlocked. Here are the homeowner's details:</p>
<p>
Name: ${name}<br>
Phone: ${phone}<br>
Email: ${email}<br>
Postcode: ${postcode}<br>
Property type: ${propertyType}<br>
Service required: ${serviceRequirement}<br>
Industry: ${industry}
</p>
<p>Please contact the homeowner promptly. If you're unable to reach them, see the Lead Replacement Policy for what to do next.</p>
<p>Kind regards,<br>Halo Strategic</p>`,
  };
}

// Internal copy of leadUnlockedEmail, to the admin mailbox -- same full detail, plus which buyer
// received it and how the release was earned (paid vs package-covered), for the audit trail.
export function internalReleaseCopyEmail(params: {
  leadReference: string;
  companyName: string;
  homeownerName: string;
  phone: string;
  email: string;
  postcode: string;
  packageCovered: boolean;
}): EmailContent {
  const reference = escapeHtml(params.leadReference);
  const company = escapeHtml(params.companyName);
  const name = escapeHtml(params.homeownerName);
  const phone = escapeHtml(params.phone);
  const email = escapeHtml(params.email);
  const postcode = escapeHtml(params.postcode);
  const releaseBasis = params.packageCovered ? 'package-covered' : 'verified payment';
  return {
    subject: `[Internal] Lead ${params.leadReference} released to ${params.companyName}`,
    text: `Lead ${params.leadReference} was released to ${params.companyName} (${releaseBasis}).

Homeowner: ${params.homeownerName}
Phone: ${params.phone}
Email: ${params.email}
Postcode: ${params.postcode}`,
    html: `<p>Lead ${reference} was released to ${company} (${escapeHtml(releaseBasis)}).</p>
<p>
Homeowner: ${name}<br>
Phone: ${phone}<br>
Email: ${email}<br>
Postcode: ${postcode}
</p>`,
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

// Five-step buyer prospect nurture sequence (lib/buyerProspectEmail.ts). Each step is a pure
// function of its position, taking only what it needs to personalise the greeting and the
// application link -- no pricing, volume or verification claims anywhere in this sequence,
// consistent with the rest of this file's "wording is Fabien's, never invented" discipline.
// Steps exit this sequence entirely once a prospect converts (see nurture_status = 'CONVERTED'),
// so there is no "stop emailing me, I already applied" message to write -- it's structurally
// impossible to receive step 3+ after converting.

export function prospectWelcomeEmail(params: { contactName: string; applyUrl: string }): EmailContent {
  const name = escapeHtml(params.contactName);
  return {
    subject: 'Thanks for your interest in the Halo Lead Exchange',
    text: `Hi ${params.contactName},

Thanks for registering your interest in the Halo Lead Exchange.

We connect businesses with relevant homeowner enquiries through a structured marketplace: enquiries are generated through targeted acquisition campaigns, checked against agreed criteria, and only offered to approved buyers.

Over the next few emails we'll walk through how the marketplace works, how enquiries are qualified, and what the application and onboarding process involves.

If you'd rather go straight to the full application, you can do that any time here: ${params.applyUrl}

Kind regards,
Halo Strategic`,
    html: `<p>Hi ${name},</p>
<p>Thanks for registering your interest in the Halo Lead Exchange.</p>
<p>We connect businesses with relevant homeowner enquiries through a structured marketplace: enquiries are generated through targeted acquisition campaigns, checked against agreed criteria, and only offered to approved buyers.</p>
<p>Over the next few emails we'll walk through how the marketplace works, how enquiries are qualified, and what the application and onboarding process involves.</p>
<p>If you'd rather go straight to the full application, you can do that any time here: <a href="${params.applyUrl}" style="color:#B08D57;">${params.applyUrl}</a></p>
<p>Kind regards,<br>Halo Strategic</p>`,
  };
}

export function prospectModelExplainerEmail(params: { contactName: string; applyUrl: string }): EmailContent {
  const name = escapeHtml(params.contactName);
  return {
    subject: 'How the Halo Lead Exchange actually works',
    text: `Hi ${params.contactName},

A quick explanation of the model behind the Lead Exchange.

A lead is an input into a commercial system, not the outcome on its own. That's why enquiries are checked against criteria agreed with each buyer before anything is offered, rather than sold as raw, unqualified volume.

Enquiries are only ever offered to a buyer whose approved coverage area and criteria match, and only once an application has been reviewed and an onboarding call completed.

Ready to apply? ${params.applyUrl}

Kind regards,
Halo Strategic`,
    html: `<p>Hi ${name},</p>
<p>A quick explanation of the model behind the Lead Exchange.</p>
<p>A lead is an input into a commercial system, not the outcome on its own. That's why enquiries are checked against criteria agreed with each buyer before anything is offered, rather than sold as raw, unqualified volume.</p>
<p>Enquiries are only ever offered to a buyer whose approved coverage area and criteria match, and only once an application has been reviewed and an onboarding call completed.</p>
<p>Ready to apply? <a href="${params.applyUrl}" style="color:#B08D57;">${params.applyUrl}</a></p>
<p>Kind regards,<br>Halo Strategic</p>`,
  };
}

export function prospectQualityApproachEmail(params: { contactName: string; applyUrl: string }): EmailContent {
  const name = escapeHtml(params.contactName);
  return {
    subject: 'How enquiries are qualified before they reach a buyer',
    text: `Hi ${params.contactName},

Before any enquiry reaches a buyer, it's checked against the criteria agreed with that buyer: things like coverage area, property type and the qualification questions relevant to that industry.

Buyers only ever see enquiries that are a genuine fit for their business. If there isn't a suitable match, the enquiry isn't shared with anyone.

This is also why onboarding matters: the criteria that make an enquiry a "fit" for your business are agreed with you directly, not assumed.

Apply here when you're ready: ${params.applyUrl}

Kind regards,
Halo Strategic`,
    html: `<p>Hi ${name},</p>
<p>Before any enquiry reaches a buyer, it's checked against the criteria agreed with that buyer: things like coverage area, property type and the qualification questions relevant to that industry.</p>
<p>Buyers only ever see enquiries that are a genuine fit for their business. If there isn't a suitable match, the enquiry isn't shared with anyone.</p>
<p>This is also why onboarding matters: the criteria that make an enquiry a &ldquo;fit&rdquo; for your business are agreed with you directly, not assumed.</p>
<p>Apply here when you're ready: <a href="${params.applyUrl}" style="color:#B08D57;">${params.applyUrl}</a></p>
<p>Kind regards,<br>Halo Strategic</p>`,
  };
}

export function prospectApplicationEmail(params: { contactName: string; applyUrl: string }): EmailContent {
  const name = escapeHtml(params.contactName);
  return {
    subject: 'Ready to apply to the Halo Lead Exchange?',
    text: `Hi ${params.contactName},

If the Lead Exchange looks like a fit so far, the next step is the full buyer application: your business details, coverage area and service capability.

Applications are reviewed individually -- access isn't automatic, and every approved applicant completes a mandatory onboarding call before any account is activated.

Start the application here: ${params.applyUrl}

Kind regards,
Halo Strategic`,
    html: `<p>Hi ${name},</p>
<p>If the Lead Exchange looks like a fit so far, the next step is the full buyer application: your business details, coverage area and service capability.</p>
<p>Applications are reviewed individually &mdash; access isn't automatic, and every approved applicant completes a mandatory onboarding call before any account is activated.</p>
<p>Start the application here: <a href="${params.applyUrl}" style="color:#B08D57;">${params.applyUrl}</a></p>
<p>Kind regards,<br>Halo Strategic</p>`,
  };
}

export function prospectNextStepsEmail(params: { contactName: string; applyUrl: string }): EmailContent {
  const name = escapeHtml(params.contactName);
  return {
    subject: 'What happens after you apply',
    text: `Hi ${params.contactName},

A quick summary of what happens once you submit the full application:

1. Halo reviews your application against agreed criteria.
2. If approved, you'll be invited to a mandatory onboarding call to agree coverage, criteria and commercial terms.
3. Once terms are agreed, your account is activated.

This is the last email in this introductory sequence. If you're ready, you can apply here: ${params.applyUrl}

Kind regards,
Halo Strategic`,
    html: `<p>Hi ${name},</p>
<p>A quick summary of what happens once you submit the full application:</p>
<ol>
<li>Halo reviews your application against agreed criteria.</li>
<li>If approved, you'll be invited to a mandatory onboarding call to agree coverage, criteria and commercial terms.</li>
<li>Once terms are agreed, your account is activated.</li>
</ol>
<p>This is the last email in this introductory sequence. If you're ready, you can apply here: <a href="${params.applyUrl}" style="color:#B08D57;">${params.applyUrl}</a></p>
<p>Kind regards,<br>Halo Strategic</p>`,
  };
}
