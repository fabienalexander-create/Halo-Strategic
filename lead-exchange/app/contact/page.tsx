import ContactForm from './ContactForm';

export default function ContactPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Contact</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>Get in touch.</h1>
        <ContactForm />
      </div>
    </section>
  );
}
