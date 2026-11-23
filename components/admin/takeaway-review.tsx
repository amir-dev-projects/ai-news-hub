'use client';

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  KeyRound,
  LogOut,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

type Status = 'draft' | 'published' | 'discarded';
type Domain = 'Program Management' | 'Product Management' | 'Both';

type EvidenceItem = {
  title?: string;
  source?: string;
  url?: string;
  published_at?: string | null;
};

type Takeaway = {
  id: string;
  generated_for: string;
  title: string;
  domain: Domain;
  description: string;
  why_it_matters: string;
  what_to_learn: string;
  practical_application: string;
  learning_focus: string;
  suggested_resources: unknown;
  evidence: unknown;
  insight_key: string | null;
  status: Status;
  created_at: string;
  published_at: string | null;
};

type ReviewForm = {
  title: string;
  domain: Domain;
  description: string;
  why_it_matters: string;
  what_to_learn: string;
  practical_application: string;
  learning_focus: string;
  suggested_resources: string;
};

const emptyForm: ReviewForm = {
  title: '',
  domain: 'Both',
  description: '',
  why_it_matters: '',
  what_to_learn: '',
  practical_application: '',
  learning_focus: '',
  suggested_resources: '',
};

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 9,
  padding: '10px 12px',
  background: 'var(--background)',
  color: 'var(--foreground)',
  fontSize: 13,
  outline: 'none',
};

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 6,
  color: 'var(--muted)',
};

function getResources(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function getEvidence(value: unknown): EvidenceItem[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is EvidenceItem =>
          Boolean(item) && typeof item === 'object'
      )
    : [];
}

function formatDate(value: string) {
  if (!value) return 'Date unavailable';
  return new Date(value.length === 10 ? value + 'T12:00:00' : value)
    .toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
}

function statusLabel(status: Status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TakeawayReview() {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [takeaways, setTakeaways] = useState<Takeaway[]>([]);
  const [filter, setFilter] = useState<Status>('draft');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<ReviewForm>(emptyForm);

  const visibleTakeaways = useMemo(
    () => takeaways.filter((item) => item.status === filter),
    [takeaways, filter]
  );

  const counts = useMemo(
    () => ({
      draft: takeaways.filter((item) => item.status === 'draft').length,
      published: takeaways.filter((item) => item.status === 'published').length,
      discarded: takeaways.filter((item) => item.status === 'discarded').length,
    }),
    [takeaways]
  );

  async function requestTakeaways(token: string) {
    const response = await fetch('/api/admin/takeaways', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to load the review queue.');
    }

    return (result.takeaways || []) as Takeaway[];
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!secret.trim()) {
      setError('Enter the Admin secret to continue.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const rows = await requestTakeaways(secret.trim());
      setTakeaways(rows);
      setAuthenticated(true);
      setNotice('Review queue loaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshQueue() {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      setTakeaways(await requestTakeaways(secret.trim()));
      setNotice('Review queue refreshed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh the queue.');
    } finally {
      setLoading(false);
    }
  }

  function startEditing(item: Takeaway) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      domain: item.domain || 'Both',
      description: item.description || '',
      why_it_matters: item.why_it_matters || '',
      what_to_learn: item.what_to_learn || '',
      practical_application: item.practical_application || '',
      learning_focus: item.learning_focus || '',
      suggested_resources: getResources(item.suggested_resources).join('\n'),
    });
    setError('');
    setNotice('');
  }

  async function updateTakeaway(
    id: string,
    action: 'edit' | 'publish' | 'discard',
    extra: Record<string, unknown> = {}
  ) {
    setBusyId(id);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/admin/takeaways', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${secret.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'The change could not be saved.');
      }

      setTakeaways((current) =>
        current.map((item) =>
          item.id === id ? (result.takeaway as Takeaway) : item
        )
      );
      setEditingId('');
      setForm(emptyForm);
      setNotice(
        action === 'publish'
          ? 'Takeaway published.'
          : action === 'discard'
            ? 'Takeaway moved to Discarded.'
            : 'Changes saved.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the change.');
    } finally {
      setBusyId('');
    }
  }

  function saveEdits(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.why_it_matters.trim() ||
      !form.what_to_learn.trim() ||
      !form.practical_application.trim() ||
      !form.learning_focus.trim()
    ) {
      setError('Please complete all required fields before saving.');
      return;
    }

    void updateTakeaway(id, 'edit', {
      ...form,
      suggested_resources: form.suggested_resources
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5),
    });
  }

  function discardTakeaway(item: Takeaway) {
    const confirmed = window.confirm(
      `Move "${item.title}" to Discarded? It will be hidden from the public dashboard, but the record will be kept.`
    );
    if (confirmed) void updateTakeaway(item.id, 'discard');
  }

  function signOut() {
    setAuthenticated(false);
    setSecret('');
    setTakeaways([]);
    setEditingId('');
    setForm(emptyForm);
    setError('');
    setNotice('');
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--background)',
    color: 'var(--foreground)',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: '1px solid var(--border)',
    borderRadius: 9,
    padding: '9px 12px',
    background: 'var(--surface)',
    color: 'var(--foreground)',
    fontSize: 12,
    fontWeight: 700,
  };

  return (
    <main style={pageStyle}>
      <header
        style={{
          minHeight: 68,
          padding: '14px 28px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <a
          href="/"
          style={{
            color: 'var(--foreground)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            fontWeight: 750,
            fontSize: 14,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: 'linear-gradient(135deg, #7165e8, #3e8fc7)',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            AF
          </span>
          AI News Hub
          <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· Editorial</span>
        </a>

        {authenticated && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => void refreshQueue()}
              disabled={loading}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button type="button" style={buttonStyle} onClick={signOut}>
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </header>

      <div
        style={{
          maxWidth: 1040,
          margin: '0 auto',
          padding: '30px 18px 56px',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              color: 'var(--accent)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1.3,
              textTransform: 'uppercase',
            }}
          >
            <ShieldCheck size={13} />
            Editorial workspace
          </div>
          <h1
            style={{
              fontSize: 'clamp(25px, 4vw, 34px)',
              letterSpacing: -1,
              margin: '8px 0 7px',
            }}
          >
            Daily takeaway review
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Review AI-generated learning priorities before they appear on the public dashboard.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: 12,
              borderRadius: 9,
              border: '1px solid #d98282',
              background: 'rgba(217, 80, 80, 0.08)',
              color: 'var(--foreground)',
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            style={{
              padding: 12,
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--green)',
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            {notice}
          </div>
        )}

        {!authenticated ? (
          <section
            style={{
              maxWidth: 480,
              padding: 22,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              boxShadow: 'var(--shadow)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                marginBottom: 14,
              }}
            >
              <KeyRound size={19} />
            </div>
            <h2 style={{ fontSize: 17, margin: '0 0 7px' }}>Admin access</h2>
            <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6, margin: '0 0 17px' }}>
              Enter the dedicated Admin secret configured as TAKEAWAYS_ADMIN_SECRET in Vercel. It is used for this session only and is not saved in the browser.
            </p>
            <form onSubmit={signIn}>
              <label htmlFor="review-secret" style={fieldLabel}>Admin secret</label>
              <input
                id="review-secret"
                type="password"
                autoComplete="current-password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Enter your Admin secret"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...buttonStyle,
                  marginTop: 13,
                  width: '100%',
                  background: 'var(--accent)',
                  borderColor: 'var(--accent)',
                  color: '#fff',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <ShieldCheck size={14} />
                {loading ? 'Checking access...' : 'Open review queue'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                borderBottom: '1px solid var(--border)',
                marginBottom: 18,
              }}
            >
              {(['draft', 'published', 'discarded'] as Status[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  style={{
                    ...buttonStyle,
                    border: 0,
                    borderBottom: filter === status ? '2px solid var(--accent)' : '2px solid transparent',
                    borderRadius: 0,
                    background: 'transparent',
                    color: filter === status ? 'var(--accent)' : 'var(--muted)',
                    textTransform: 'capitalize',
                  }}
                >
                  {statusLabel(status)}
                  <span
                    style={{
                      minWidth: 19,
                      padding: '2px 5px',
                      borderRadius: 99,
                      background: 'var(--surface-muted)',
                      fontSize: 10,
                      textAlign: 'center',
                    }}
                  >
                    {counts[status]}
                  </span>
                </button>
              ))}
            </div>

            {loading && takeaways.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: 24 }}>
                Loading takeaways...
              </div>
            ) : visibleTakeaways.length === 0 ? (
              <section
                style={{
                  textAlign: 'center',
                  padding: '42px 20px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                }}
              >
                <FileText size={25} color="var(--muted)" style={{ margin: '0 auto 10px' }} />
                <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>No {filter} takeaways</h2>
                <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
                  {filter === 'draft'
                    ? 'New AI-generated takeaways will appear here for your review.'
                    : filter === 'published'
                      ? 'Takeaways you publish will be listed here.'
                      : 'Items you discard will stay here for reference.'}
                </p>
              </section>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {visibleTakeaways.map((item) => {
                  const isEditing = editingId === item.id;
                  const isBusy = busyId === item.id;
                  const resources = getResources(item.suggested_resources);
                  const evidence = getEvidence(item.evidence);

                  return (
                    <article
                      key={item.id}
                      style={{
                        padding: 19,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        boxShadow: 'var(--shadow)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 14,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 240 }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 7,
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              marginBottom: 9,
                            }}
                          >
                            <span className="tag">{item.domain}</span>
                            <span style={{ color: 'var(--muted)', fontSize: 10 }}>
                              Generated {formatDate(item.generated_for)}
                            </span>
                            <span style={{ color: 'var(--muted)', fontSize: 10 }}>
                              · {statusLabel(item.status)}
                            </span>
                          </div>
                          <h2 style={{ fontSize: 17, lineHeight: 1.4, margin: '0 0 8px' }}>
                            {item.title}
                          </h2>
                          <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.65, margin: 0 }}>
                            {item.description}
                          </p>
                        </div>
                        {!isEditing && (
                          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            <button type="button" style={buttonStyle} onClick={() => startEditing(item)}>
                              <Pencil size={13} />
                              Edit
                            </button>
                            {item.status === 'draft' && (
                              <button
                                type="button"
                                style={{
                                  ...buttonStyle,
                                  background: 'var(--green)',
                                  borderColor: 'var(--green)',
                                  color: '#fff',
                                }}
                                disabled={isBusy}
                                onClick={() => void updateTakeaway(item.id, 'publish')}
                              >
                                <Send size={13} />
                                Publish
                              </button>
                            )}
                            {item.status !== 'discarded' && (
                              <button
                                type="button"
                                style={buttonStyle}
                                disabled={isBusy}
                                onClick={() => discardTakeaway(item)}
                              >
                                <Trash2 size={13} />
                                Discard
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <form
                          onSubmit={(event) => saveEdits(event, item.id)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                            gap: 13,
                            borderTop: '1px solid var(--border)',
                            marginTop: 17,
                            paddingTop: 17,
                          }}
                        >
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={fieldLabel}>Title *</label>
                            <input
                              required
                              maxLength={180}
                              value={form.title}
                              onChange={(event) => setForm({ ...form, title: event.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={fieldLabel}>Domain *</label>
                            <select
                              value={form.domain}
                              onChange={(event) => setForm({ ...form, domain: event.target.value as Domain })}
                              style={inputStyle}
                            >
                              <option>Program Management</option>
                              <option>Product Management</option>
                              <option>Both</option>
                            </select>
                          </div>
                          <div>
                            <label style={fieldLabel}>Learning focus *</label>
                            <input
                              required
                              value={form.learning_focus}
                              onChange={(event) => setForm({ ...form, learning_focus: event.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={fieldLabel}>Description *</label>
                            <textarea
                              required
                              rows={2}
                              value={form.description}
                              onChange={(event) => setForm({ ...form, description: event.target.value })}
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          </div>
                          <div>
                            <label style={fieldLabel}>Why it matters *</label>
                            <textarea
                              required
                              rows={4}
                              value={form.why_it_matters}
                              onChange={(event) => setForm({ ...form, why_it_matters: event.target.value })}
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          </div>
                          <div>
                            <label style={fieldLabel}>What to learn *</label>
                            <textarea
                              required
                              rows={4}
                              value={form.what_to_learn}
                              onChange={(event) => setForm({ ...form, what_to_learn: event.target.value })}
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={fieldLabel}>Practical application *</label>
                            <textarea
                              required
                              rows={3}
                              value={form.practical_application}
                              onChange={(event) => setForm({ ...form, practical_application: event.target.value })}
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={fieldLabel}>Suggested resources (one per line, up to five)</label>
                            <textarea
                              rows={3}
                              value={form.suggested_resources}
                              onChange={(event) => setForm({ ...form, suggested_resources: event.target.value })}
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          </div>
                          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              style={buttonStyle}
                              onClick={() => {
                                setEditingId('');
                                setForm(emptyForm);
                                setError('');
                              }}
                            >
                              <X size={13} />
                              Cancel
                            </button>
                            <button
                              type="submit"
                              style={{
                                ...buttonStyle,
                                background: 'var(--accent)',
                                color: '#fff',
                                borderColor: 'var(--accent)',
                              }}
                              disabled={isBusy}
                            >
                              <Check size={13} />
                              {isBusy ? 'Saving...' : 'Save changes'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <details style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                            <summary
                              style={{
                                cursor: 'pointer',
                                color: 'var(--accent)',
                                fontSize: 11,
                                fontWeight: 750,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <ChevronDown size={13} />
                              View full takeaway and supporting evidence
                            </summary>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
                                gap: 15,
                                paddingTop: 14,
                                fontSize: 12,
                                lineHeight: 1.65,
                              }}
                            >
                              <div>
                                <strong>Why it matters</strong>
                                <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>{item.why_it_matters}</p>
                              </div>
                              <div>
                                <strong>What to learn</strong>
                                <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>{item.what_to_learn}</p>
                              </div>
                              <div>
                                <strong>Practical application</strong>
                                <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>{item.practical_application}</p>
                              </div>
                              <div>
                                <strong>Learning focus</strong>
                                <p style={{ color: 'var(--green)', margin: '4px 0 0', fontWeight: 700 }}>{item.learning_focus}</p>
                              </div>
                              {resources.length > 0 && (
                                <div>
                                  <strong>Suggested resources</strong>
                                  <ul style={{ color: 'var(--muted)', margin: '5px 0 0', paddingLeft: 18 }}>
                                    {resources.map((resource, index) => <li key={index}>{resource}</li>)}
                                  </ul>
                                </div>
                              )}
                              {evidence.length > 0 && (
                                <div>
                                  <strong>Supporting articles</strong>
                                  <ul style={{ color: 'var(--muted)', margin: '5px 0 0', paddingLeft: 18 }}>
                                    {evidence.map((source, index) => (
                                      <li key={index}>
                                        {source.url ? (
                                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-link">
                                            {source.title || source.source || source.url}
                                            <ExternalLink size={11} style={{ display: 'inline', marginLeft: 4 }} />
                                          </a>
                                        ) : (
                                          source.title || source.source || 'Supporting article'
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </details>
                          {item.status === 'published' && item.published_at && (
                            <p style={{ color: 'var(--muted)', fontSize: 10, margin: '12px 0 0' }}>
                              Published {formatDate(item.published_at)}
                            </p>
                          )}
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border)',
            paddingTop: 15,
            marginTop: 30,
          }}
        >
          <a href="/" style={{ color: 'var(--accent)', fontSize: 11, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ArrowLeft size={12} />
            Back to AI News Hub
          </a>
          <span style={{ color: 'var(--muted)', fontSize: 10 }}>
            AI News Hub · Editorial workspace
          </span>
        </footer>
      </div>
    </main>
  );
}
