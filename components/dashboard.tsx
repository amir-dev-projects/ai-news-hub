
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  ChevronRight,
  ChevronDown,
  Code2,
  GraduationCap,
  Layers3,
  RefreshCw,
  Search,
  Sparkles,
  Telescope,
  Wrench,
  Lightbulb,
  Workflow,
  Target,
  Brain,
  Clock3,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

import ThemeToggle from '@/components/theme-toggle';
import { supabase } from '@/lib/supabase';
import { categories, trainings } from '@/lib/sample-data';

const navItems = [
  { label: 'Overview', icon: Layers3 },
  { label: 'AI Models', icon: BrainCircuit },
  { label: 'Research', icon: Telescope },
  { label: 'Generative AI', icon: Sparkles },
  { label: 'Business', icon: BriefcaseBusiness },
  { label: 'AI Tools', icon: Wrench },
  { label: 'Open Source', icon: Code2 },
  { label: 'AI Training', icon: GraduationCap },
  { label: 'Saved', icon: Bookmark },
];

type Takeaway = {
  id: string;
  generated_for: string;
  title: string;
  domain: 'Program Management' | 'Product Management' | 'Both';
  description: string;
  why_it_matters: string;
  what_to_learn: string;
  practical_application: string;
  learning_focus: string;
  suggested_resources: unknown;
  evidence: unknown;
  insight_key: string | null;
};

type EvidenceItem = {
  title?: string;
  url?: string;
  source?: string;
};

function getTakeawayIcon(domain: Takeaway['domain']) {
  if (domain === 'Program Management') return Workflow;
  if (domain === 'Product Management') return Target;
  return Brain;
}

function getResourceList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'title' in item) {
        return String((item as { title: unknown }).title);
      }
      return '';
    })
    .filter(Boolean);
}

function getEvidenceList(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is EvidenceItem =>
      Boolean(item) && typeof item === 'object'
  );
}

type DirectoryEntry = {
  id: string;
  name: string;
  url: string | null;
};

type SiteInfo = {
  newsSources: DirectoryEntry[];
  trainingProviders: DirectoryEntry[];
  lastCollectionAt: string | null;
  lastCollectionSuccess: boolean | null;
  sourcesFailed: number | null;
  collectionLogAvailable: boolean;
  pendingTakeawaysCount: number | null;
  lastCollectionSourcesChecked: number | null;
  lastCollectionTotalFetched: number | null;
  lastCollectionTotalInserted: number | null;
  latestArticlePublishedAt: string | null;
};

type Article = {
  id: string;
  title: string;
  summary: string | null;
  ai_summary: string | null;
  article_url: string;
  published_at: string | null;
  source: { name: string } | null;
  category: { name: string } | null;
};

export default function Dashboard() {
  const [active, setActive] = useState('Overview');
  const [greeting, setGreeting] = useState('Welcome');
  const [category, setCategory] = useState('All News');
  const [query, setQuery] = useState('');
  const [expandedTakeaways, setExpandedTakeaways] = useState<string[]>([]);
  const [takeaways, setTakeaways] = useState<Takeaway[]>([]);
  const [loadingTakeaways, setLoadingTakeaways] = useState(true);
  const [takeawayError, setTakeawayError] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      setGreeting('Good morning');
    } else if (hour >= 12 && hour < 17) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  }, []);

  function toggleTakeaway(id: string) {
    setExpandedTakeaways((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [articleError, setArticleError] = useState('');
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [siteInfoLoading, setSiteInfoLoading] = useState(true);
  const [siteInfoError, setSiteInfoError] = useState('');
  const pendingReviewCount = siteInfo?.pendingTakeawaysCount ?? 0;

  useEffect(() => {
    let isMounted = true;

    async function loadSiteInfo() {
      if (isMounted) {
        setSiteInfoLoading(true);
        setSiteInfoError('');
      }

      try {
        const response = await fetch('/api/public/site-info', {
          cache: 'no-store',
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Unable to load source information.');
        }

        if (isMounted) setSiteInfo(result.siteInfo as SiteInfo);
      } catch (error) {
        if (isMounted) {
          setSiteInfoError(
            error instanceof Error ? error.message : 'Unable to load source information.'
          );
        }
      } finally {
        if (isMounted) setSiteInfoLoading(false);
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        void loadSiteInfo();
      }
    }

    void loadSiteInfo();
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    async function loadTakeaways() {
      setLoadingTakeaways(true);
      setTakeawayError('');

      // Show published takeaways from today and the previous two UTC dates.
      // Generation uses UTC dates, so this keeps the display window consistent.
      const now = new Date();
      const oldestVisibleDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - 2
        )
      )
        .toISOString()
        .slice(0, 10);

      const { data, error } = await supabase
        .from('daily_takeaways')
        .select(`
          id,
          generated_for,
          title,
          domain,
          description,
          why_it_matters,
          what_to_learn,
          practical_application,
          learning_focus,
          suggested_resources,
          evidence,
          insight_key
        `)
        .eq('status', 'published')
        .gte('generated_for', oldestVisibleDate)
        .order('generated_for', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        setTakeawayError(error.message);
        setLoadingTakeaways(false);
        return;
      }

      const rows = (data || []) as Takeaway[];
      setTakeaways(rows);
      setLoadingTakeaways(false);
    }

    loadTakeaways();
  }, []);

  useEffect(() => {
    async function loadArticles() {
      setLoadingArticles(true);
      setArticleError('');

      const { data, error } = await supabase
        .from('articles')
        .select(`
          id,
          title,
          summary,
          ai_summary,
          article_url,
          published_at,
          source:news_sources(name),
          category:categories(name)
        `)
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      if (error) {
        setArticleError(error.message);
        setLoadingArticles(false);
        return;
      }

      setArticles((data || []) as unknown as Article[]);
      setLoadingArticles(false);
    }

    loadArticles();
  }, []);

  const visibleArticles = useMemo(
    () =>
      articles.filter((item) => {
        const matchesCategory =
          category === 'All News' ||
          item.category?.name === category;

        const matchesQuery = `
          ${item.title}
          ${item.summary || ''}
          ${item.ai_summary || ''}
          ${item.source?.name || ''}
        `
          .toLowerCase()
          .includes(query.toLowerCase());

        return matchesCategory && matchesQuery;
      }),
    [articles, category, query]
  );

  const takeawayGroups = useMemo(() => {
    const grouped = new Map<string, Takeaway[]>();

    for (const item of takeaways) {
      const itemsForDate = grouped.get(item.generated_for) || [];
      itemsForDate.push(item);
      grouped.set(item.generated_for, itemsForDate);
    }

    return Array.from(grouped.entries()).map(([date, items]) => ({
      date,
      items,
    }));
  }, [takeaways]);

  function formatTakeawayDate(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    const targetUtc = Date.UTC(year, month - 1, day);
    const now = new Date();
    const todayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
    const daysAgo = Math.round((todayUtc - targetUtc) / 86400000);
    const formatted = new Date(targetUtc).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });

    if (daysAgo === 0) return `Today · ${formatted}`;
    if (daysAgo === 1) return `Yesterday · ${formatted}`;
    return formatted;
  }

  function formatDate(date: string | null) {
    if (!date) return 'Recently added';

    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatDateTime(date: string | null) {
    if (!date) return 'Not recorded yet';

    return new Date(date).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Brand identity */}
        <div className="brand">
          <img
            src="/af-logo.png"
            alt="Amir Fatemi monogram"
            className="brand-logo"
          />

          <div className="brand-text">
            <div className="brand-name">AI News Hub</div>
            <div className="brand-sub">By AMIR FATEMI</div>
          </div>
        </div>

        {/* Navigation */}
        <div>
          <div className="nav-label">WORKSPACE</div>

          <nav className="nav-list">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                className={`nav-item ${
                  active === label ? 'active' : ''
                }`}
                onClick={() => {
                  setActive(label);

                  if (categories.includes(label)) {
                    setCategory(label);
                  } else if (label === 'Overview') {
                    setCategory('All News');
                  }
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Source and platform directory */}
        <div className="sidebar-directory">
          <div className="nav-label">TRUST & ACTIVITY</div>

          <details className="sidebar-disclosure">
            <summary>
              <span className="sidebar-disclosure-title">
                <BookOpen size={15} />
                Active news sources
              </span>
              <span className="sidebar-disclosure-count">
                {siteInfoLoading ? '—' : siteInfo?.newsSources.length ?? 0}
              </span>
              <ChevronRight size={14} className="sidebar-disclosure-chevron" />
            </summary>
            <div className="sidebar-directory-list">
              {siteInfoLoading ? (
                <span className="sidebar-directory-empty">Loading sources...</span>
              ) : siteInfoError ? (
                <span className="sidebar-directory-empty">Unable to load sources</span>
              ) : siteInfo?.newsSources.length ? (
                siteInfo.newsSources.map((source) => (
                  source.url ? (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sidebar-directory-link"
                    >
                      {source.name}
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span key={source.id} className="sidebar-directory-link">
                      {source.name}
                    </span>
                  )
                ))
              ) : (
                <span className="sidebar-directory-empty">No active sources found</span>
              )}
            </div>
          </details>

          <details className="sidebar-disclosure">
            <summary>
              <span className="sidebar-disclosure-title">
                <GraduationCap size={16} />
                Training providers
              </span>
              <span className="sidebar-disclosure-count">
                {siteInfoLoading ? '—' : siteInfo?.trainingProviders.length ?? 0}
              </span>
              <ChevronRight size={14} className="sidebar-disclosure-chevron" />
            </summary>
            <div className="sidebar-directory-list">
              {siteInfoLoading ? (
                <span className="sidebar-directory-empty">Loading providers...</span>
              ) : siteInfoError ? (
                <span className="sidebar-directory-empty">Unable to load providers</span>
              ) : siteInfo?.trainingProviders.length ? (
                siteInfo.trainingProviders.map((provider) => (
                  provider.url ? (
                    <a
                      key={provider.id}
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sidebar-directory-link"
                    >
                      {provider.name}
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span key={provider.id} className="sidebar-directory-link">
                      {provider.name}
                    </span>
                  )
                ))
              ) : (
                <span className="sidebar-directory-empty">No providers found</span>
              )}
            </div>
          </details>

          <div className="sidebar-info-card">
            <div className="sidebar-info-heading">
              <Clock3 size={14} />
              Collection frequency target
            </div>
            <div className="sidebar-info-value">Every 6 hours</div>
            <div className="sidebar-info-foot">Last checked</div>
            <div className="sidebar-info-time">
              {formatDateTime(siteInfo?.lastCollectionAt || null)}
            </div>
            <div className="sidebar-info-foot">Last check results</div>
            <div className="sidebar-info-time">
              {siteInfoLoading
                ? 'Checking feeds...'
                : siteInfo?.collectionLogAvailable
                  ? `${siteInfo.lastCollectionTotalInserted ?? 0} new stories · ${siteInfo.lastCollectionSourcesChecked ?? 0} RSS feeds checked`
                  : 'Not available yet'}
            </div>
            <div className="sidebar-info-foot">Newest article published</div>
            <div className="sidebar-info-time">
              {formatDateTime(siteInfo?.latestArticlePublishedAt || null)}
            </div>
            {siteInfo?.lastCollectionSuccess === false && (
              <div className="sidebar-info-warning">
                Last run reported {siteInfo.sourcesFailed ?? 0} source errors
              </div>
            )}
            {!siteInfo?.collectionLogAvailable && !siteInfoLoading && (
              <div className="sidebar-info-foot">
                Collection history will appear after setup
              </div>
            )}
          </div>

          <a
            href="/admin/takeaways"
            target="_blank"
            rel="noopener noreferrer"
            className={`nav-item sidebar-admin-link ${pendingReviewCount > 0 ? 'has-pending' : ''}`}
            aria-label={
              pendingReviewCount > 0
                ? `Review ${pendingReviewCount} pending takeaways`
                : 'Admin takeaway review'
            }
          >
            {pendingReviewCount > 0 ? <AlertCircle size={16} /> : <ShieldCheck size={16} />}
            <span>{pendingReviewCount > 0 ? 'Review takeaways' : 'Admin · Takeaway review'}</span>
            {pendingReviewCount > 0 && (
              <span className="sidebar-admin-badge">
                {pendingReviewCount} pending
              </span>
            )}
          </a>
        </div>

        {/* Sidebar footer */}
        <div className="sidebar-bottom">
          <div className="nav-item">
            <Sparkles size={16} />
            AI-powered insights
          </div>

          <div
            className="brand-sub"
            style={{ padding: '10px 11px' }}
          >
            Phase 2 · Database connected
          </div>
        </div>
      </aside>

      <main className="main-area">
        {/* Top navigation */}
        <header className="topbar">
          <div className="mobile-brand">
            <img
              src="/af-logo.png"
              alt="Amir Fatemi monogram"
              className="mobile-brand-logo"
            />

            <div className="brand-text">
              <div className="brand-name">AI News Hub</div>
              <div className="brand-sub">By AMIR FATEMI</div>
            </div>
          </div>

          {/* Search */}
          <div className="search-wrap">
            <Search className="search-icon" size={16} />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search AI news, research and training..."
            />
          </div>

          {/* Actions */}
          <div className="top-actions">
            <ThemeToggle />
            <div className="avatar" title="Public dashboard">
              AF
            </div>
          </div>
        </header>

        <div className="content">
          {/* Welcome section */}
          <div className="hero-row">
            <div>
              <div className="eyebrow">
                YOUR AI INTELLIGENCE BRIEFING
              </div>

              <h1 className="page-title">
                {active === 'Overview'
                  ? `${greeting}. Here's what's happening in AI.`
                  : active}
              </h1>

              <p className="page-description">
                The latest developments, ideas and learning resources in
                artificial intelligence.
              </p>
            </div>

            <div className="refresh-note">
              <RefreshCw
                size={12}
                style={{ display: 'inline', marginRight: 6 }}
              />
              Connected to Supabase
            </div>
          </div>

          {/* Key Takeaways */}
          <section
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '24px',
              marginBottom: 30,
              boxShadow: 'var(--shadow)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Lightbulb size={23} color="var(--green)" />
                <h2
                  style={{
                    fontSize: 19,
                    fontWeight: 750,
                    letterSpacing: '-0.4px',
                    margin: 0,
                  }}
                >
                  Key Takeaways for Program and Product Managers
                </h2>
              </div>

              <span className="tag">AI INSIGHTS</span>
            </div>

            <p
              style={{
                color: 'var(--muted)',
                fontSize: 13,
                lineHeight: 1.6,
                marginBottom: 22,
              }}
            >
              Practical AI skills, tools and knowledge to help you plan,
              build, deliver and manage products more effectively.
            </p>

            {loadingTakeaways ? (
              <div
                className="panel"
                style={{ padding: 20, color: 'var(--muted)' }}
              >
                Loading the latest learning takeaways...
              </div>
            ) : takeawayError ? (
              <div
                className="panel"
                style={{ padding: 20, color: 'var(--muted)' }}
              >
                Unable to load takeaways: {takeawayError}
              </div>
            ) : takeaways.length === 0 ? (
              <div
                className="panel"
                style={{
                  padding: 22,
                  color: 'var(--muted)',
                  textAlign: 'center',
                }}
              >
                <Lightbulb
                  size={22}
                  color="var(--green)"
                  style={{ margin: '0 auto 8px' }}
                />
                <strong style={{ display: 'block', color: 'var(--foreground)' }}>
                  No published takeaways in the last three days
                </strong>
                <span>
                  Published takeaways stay here for three days, so you have time
                  to read and revisit them.
                </span>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 22 }}>
                {takeawayGroups.map((group) => (
                  <section key={group.date}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 12,
                        paddingBottom: 8,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 750,
                          color: 'var(--foreground)',
                        }}
                      >
                        {formatTakeawayDate(group.date)}
                      </h3>
                      <span style={{ color: 'var(--muted)', fontSize: 10 }}>
                        {group.items.length} {group.items.length === 1 ? 'takeaway' : 'takeaways'}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                        gap: 14,
                      }}
                    >
                      {group.items.map((item) => {
                  const Icon = getTakeawayIcon(item.domain);
                  const isExpanded = expandedTakeaways.includes(item.id);
                  const resources = getResourceList(item.suggested_resources);
                  const evidence = getEvidenceList(item.evidence);

                  return (
                    <article
                      key={item.id}
                      style={{
                        padding: 17,
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        background: 'var(--surface-muted)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTakeaway(item.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`takeaway-details-${item.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 11,
                          width: '100%',
                          padding: 0,
                          border: 0,
                          background: 'transparent',
                          color: 'inherit',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 9,
                            background: 'var(--accent-soft)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={17} color="var(--accent)" />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <h3
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                lineHeight: 1.45,
                                margin: '0 0 7px',
                              }}
                            >
                              {item.title}
                            </h3>
                            <ChevronDown
                              size={16}
                              aria-hidden="true"
                              style={{
                                flexShrink: 0,
                                color: 'var(--muted)',
                                transform: isExpanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 160ms ease',
                              }}
                            />
                          </div>
                          <span className="meta-pill">{item.domain}</span>
                        </div>
                      </button>

                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--muted)',
                          lineHeight: 1.65,
                          margin: '12px 0 0 45px',
                        }}
                      >
                        {item.description}
                      </p>

                      {isExpanded && (
                        <div
                          id={`takeaway-details-${item.id}`}
                          style={{
                            borderTop: '1px solid var(--border)',
                            marginTop: 15,
                            paddingTop: 14,
                            marginLeft: 45,
                            fontSize: 12,
                            lineHeight: 1.65,
                          }}
                        >
                          <div style={{ marginBottom: 12 }}>
                            <strong>Why it matters</strong>
                            <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>
                              {item.why_it_matters}
                            </p>
                          </div>

                          <div style={{ marginBottom: 12 }}>
                            <strong>What to learn</strong>
                            <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>
                              {item.what_to_learn}
                            </p>
                          </div>

                          <div style={{ marginBottom: 12 }}>
                            <strong>Practical application</strong>
                            <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>
                              {item.practical_application}
                            </p>
                          </div>

                          <div style={{ marginBottom: 12 }}>
                            <strong>Learning focus</strong>
                            <p
                              style={{
                                color: 'var(--green)',
                                margin: '4px 0 0',
                                fontWeight: 600,
                              }}
                            >
                              {item.learning_focus}
                            </p>
                          </div>

                          {resources.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <strong>Suggested resources</strong>
                              <ul
                                style={{
                                  color: 'var(--muted)',
                                  margin: '4px 0 0',
                                  paddingLeft: 18,
                                }}
                              >
                                {resources.map((resource, index) => (
                                  <li key={`${item.id}-resource-${index}`}>
                                    {resource}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {evidence.length > 0 && (
                            <div>
                              <strong>Supporting sources</strong>
                              <ul
                                style={{
                                  color: 'var(--muted)',
                                  margin: '4px 0 0',
                                  paddingLeft: 18,
                                }}
                              >
                                {evidence.map((source, index) => (
                                  <li key={`${item.id}-evidence-${index}`}>
                                    {source.url ? (
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-link"
                                      >
                                        {source.title || source.source || source.url}
                                      </a>
                                    ) : (
                                      source.title || source.source || 'Supporting source'
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                      );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 13,
                marginTop: 18,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {loadingTakeaways
                  ? 'Checking for recent published takeaways'
                  : `${takeaways.length} published ${takeaways.length === 1 ? 'takeaway' : 'takeaways'} from the last 3 days${takeaways.length > 0 ? ' · Expand a card to learn more' : ''}`}
              </span>

              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Updated as new AI developments are reviewed
              </span>
            </div>
          </section>

          {/* Categories */}
          <div className="section-heading">
            <h2>Explore topics</h2>
            <span>Choose an area to explore</span>
          </div>

          <div className="category-row">
            {categories.map((item) => (
              <button
                key={item}
                className={`category-chip ${
                  category === item ? 'selected' : ''
                }`}
                onClick={() => {
                  setCategory(item);
                  setActive(
                    item === 'All News' ? 'Overview' : item
                  );
                }}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Latest news from Supabase */}
          <div className="section-heading">
            <h2>Latest AI updates</h2>

            <span>
              {loadingArticles
                ? 'Loading articles...'
                : `${visibleArticles.length} published articles`}
            </span>
          </div>

          {articleError && (
            <div
              className="panel"
              style={{
                padding: 18,
                color: 'var(--muted)',
                marginBottom: 16,
              }}
            >
              Unable to load articles: {articleError}
            </div>
          )}

          {loadingArticles ? (
            <div
              className="panel"
              style={{
                padding: 22,
                color: 'var(--muted)',
              }}
            >
              Loading articles from AI News Hub...
            </div>
          ) : (
            <div className="news-grid">
              {visibleArticles.map((item) => (
                <article className="news-card" key={item.id}>
                  <div className="card-top">
                    <span className="tag">
                      {item.category?.name || 'AI'}
                    </span>

                    <span className="card-date">
                      {formatDate(item.published_at)}
                    </span>
                  </div>

                  <h3>{item.title}</h3>

                  <p className="card-summary">
                    {item.ai_summary ||
                      item.summary ||
                      'Summary not yet available.'}
                  </p>

                  <div className="card-footer">
                    <span className="source-name">
                      {item.source?.name || 'AI News Hub'}
                    </span>

                    <a
                      href={item.article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      Read article
                      <ChevronRight size={12} />
                    </a>
                  </div>
                </article>
              ))}

              {!articleError && visibleArticles.length === 0 && (
                <div
                  className="panel"
                  style={{
                    padding: 22,
                    color: 'var(--muted)',
                    gridColumn: '1 / -1',
                  }}
                >
                  {articles.length === 0
                    ? 'Your database is connected. No published articles have been collected yet. News collection will populate this section.'
                    : 'No articles match your search or selected category. Try another term or category.'}
                </div>
              )}
            </div>
          )}

          {/* Training */}
          <div className="section-heading">
            <h2>Recently added training</h2>
            <span>
              Learning resources · Illustrative examples
            </span>
          </div>

          <div className="training-grid">
            {trainings.map((item) => (
              <article className="training-card" key={item.id}>
                <div className="card-top">
                  <span className="tag">
                    <BookOpen
                      size={11}
                      style={{
                        display: 'inline',
                        marginRight: 4,
                      }}
                    />
                    TRAINING
                  </span>

                  <span className="card-date">
                    {item.provider}
                  </span>
                </div>

                <h3>{item.title}</h3>

                <p className="card-summary">
                  {item.description}
                </p>

                <div className="training-meta">
                  <span className="meta-pill">{item.level}</span>
                  <span className="meta-pill">{item.format}</span>
                </div>

                <div className="card-footer">
                  <span className="source-name">
                    {item.provider}
                  </span>

                  <span className="source-name">
                    Coming in Phase 4
                  </span>
                </div>
              </article>
            ))}
          </div>

          {/* Footer */}
          <p
            className="page-description"
            style={{
              marginTop: 30,
              fontSize: 11,
            }}
          >
            AI News Hub · By AMIR FATEMI
          </p>
        </div>
      </main>
    </div>
  );
}
