export default function BecomeABuyerPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Become a Buyer</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>Apply for access to the Lead Exchange.</h1>
        <p>
          Applications are reviewed by Halo Strategic before any account is approved. We don&rsquo;t grant
          lead inventory access automatically &mdash; this form starts a conversation, not an instant
          sign-up.
        </p>

        <div className="form-card">
          {/*
            Netlify Forms, same mechanism used elsewhere on halostrategic.com. This intentionally does
            NOT write to a database yet — Phase 2 scope is the public application form only. Phase 3
            replaces this with a real buyer-approval workflow backed by the leads/buyers schema once
            the database layer is built and approved.
          */}
          <form name="become-a-buyer" method="POST" data-netlify="true" netlify-honeypot="bot-field">
            <input type="hidden" name="form-name" value="become-a-buyer" />
            <p style={{ display: 'none' }}>
              <label>
                Don&rsquo;t fill this out if you&rsquo;re human: <input name="bot-field" />
              </label>
            </p>

            <div className="form-row">
              <label htmlFor="business-name">Business name</label>
              <input type="text" id="business-name" name="business_name" required />
            </div>
            <div className="form-row">
              <label htmlFor="contact-name">Contact name</label>
              <input type="text" id="contact-name" name="contact_name" required />
            </div>
            <div className="form-row">
              <label htmlFor="business-email">Business email</label>
              <input type="email" id="business-email" name="business_email" required />
            </div>
            <div className="form-row">
              <label htmlFor="telephone">Telephone</label>
              <input type="tel" id="telephone" name="telephone" required />
            </div>
            <div className="form-row">
              <label htmlFor="website">Website</label>
              <input type="url" id="website" name="website" />
            </div>
            <div className="form-row">
              <label htmlFor="service-categories">Service categories</label>
              <input
                type="text"
                id="service-categories"
                name="service_categories"
                placeholder="e.g. Spray foam removal"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="coverage">Geographic coverage</label>
              <input
                type="text"
                id="coverage"
                name="geographic_coverage"
                placeholder="e.g. Essex, Kent, South East"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="capability">Installation/removal capability</label>
              <textarea
                id="capability"
                name="capability"
                placeholder="Briefly describe your current capability and capacity"
              />
            </div>
            <div className="form-row">
              <label htmlFor="current-requirements">Current lead requirements</label>
              <textarea id="current-requirements" name="current_requirements" />
            </div>
            <div className="form-row">
              <label htmlFor="expected-volume">Expected monthly lead volume</label>
              <input type="text" id="expected-volume" name="expected_volume" />
            </div>
            <div className="form-row">
              <label htmlFor="preferred-contact">Preferred contact method</label>
              <select id="preferred-contact" name="preferred_contact_method" required>
                <option value="">Select one</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="verification">
                Business verification information <span style={{ fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="verification"
                name="verification_info"
                placeholder="e.g. Companies House number, trade accreditations"
              />
            </div>

            <button type="submit" className="btn btn-bronze btn-wide">
              Submit Application
            </button>
            <p className="form-note">
              Submitting this form does not grant access to lead inventory. We&rsquo;ll review your
              application and respond by your preferred contact method.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
