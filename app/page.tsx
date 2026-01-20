import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <header className="nav">
        <div className="brand">Poultry Layer Daily Log</div>
        <nav className="nav-links">
          <Link href="/entry">Daily Entry</Link>
          <Link href="/analytics">Analytics</Link>
        </nav>
      </header>

      <section className="hero">
        <h1>Keep daily layer stats tidy, even on the farm floor.</h1>
        <p>
          Capture egg counts, damaged eggs, and mortality in seconds. Everything syncs
          to Google Sheets, and your dashboard stays ready for quick checks.
        </p>
        <div className="actions" style={{ marginTop: '18px' }}>
          <Link className="chip" href="/entry">
            Start today&apos;s log
          </Link>
          <Link className="chip" href="/analytics">
            View analytics
          </Link>
        </div>
      </section>
    </main>
  );
}
