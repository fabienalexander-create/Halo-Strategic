export default function ContactPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Contact</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>Get in touch.</h1>

        <div className="form-card">
          <form name="lead-exchange-contact" method="POST" data-netlify="true" netlify-honeypot="bot-field">
            <input type="hidden" name="form-name" value="lead-exchange-contact" />
            <p style={{ display: 'none' }}>
              <label>
                Don&rsquo;t fill this out if you&rsquo;re human: <input name="bot-field" />
              </label>
            </p>
            <div className="form-row">
              <label htmlFor="contact-name">Name</label>
              <input type="text" id="contact-name" name="name" required />
            </div>
            <div className="form-row">
              <label htmlFor="contact-email">Email</label>
              <input type="email" id="contact-email" name="email" required />
            </div>
            <div className="form-row">
              <label htmlFor="contact-message">Message</label>
              <textarea id="contact-message" name="message" required />
            </div>
            <button type="submit" className="btn btn-bronze btn-wide">
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
