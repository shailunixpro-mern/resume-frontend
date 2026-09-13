"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/utils/api";
import Navbar from "@/components/Navbar";
import ProjectCard from "@/components/ProjectCard";
import styles from "./page.module.css";

type Social = {
  label: string;
  url: string;
};

type Profile = {
  fullName: string;
  headline: string;
  bio: string;
  location: string;
  email: string;
  avatarUrl?: string;
  resumeUrl?: string;
  socials: Social[];
};

type Project = {
  title: string;
  summary: string;
  technologies: string[];
  liveUrl?: string;
  repoUrl?: string;
  featured?: boolean;
};

type Skill = {
  name: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  years: number;
};

type PortfolioData = {
  profile: Profile;
  projects: Project[];
  skills: Skill[];
};

type BackendHealth = {
  status: string;
  timestamp: string;
  uptime: number;
};

type BackendSystemStatus = {
  backend: {
    url: string;
    uptime: number;
    timestamp: string;
    healthcheckUrl: string;
  };
  database: {
    configured: boolean;
    dbName: string;
    mongoUri: string | null;
    mongoUriVisible: boolean;
    host: string | null;
    state: string;
    lastConnectedAt: string | null;
    lastError: string | null;
  };
};

const defaultPortfolio: PortfolioData = {
  profile: {
    fullName: "Your Name",
    headline: "Full Stack Developer",
    bio: "I build performant web experiences with elegant interfaces and dependable APIs.",
    location: "Remote",
    email: "hello@example.com",
    socials: [
      { label: "GitHub", url: "https://github.com/" },
      { label: "LinkedIn", url: "https://www.linkedin.com/" },
    ],
  },
  projects: [],
  skills: [],
};

export default function Home() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const fetchTimeStorageKey = "lastSuccessfulPortfolioFetchAt";
  const [data, setData] = useState<PortfolioData>(defaultPortfolio);
  const [activeTech, setActiveTech] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [lastDataFetchAt, setLastDataFetchAt] = useState<string>("");
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [systemStatus, setSystemStatus] = useState<BackendSystemStatus | null>(null);

  const loadPortfolio = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.get("/api/portfolio");
      setData(response.data?.data || defaultPortfolio);
      const fetchTime = new Date().toISOString();
      setLastDataFetchAt(fetchTime);
      localStorage.setItem(fetchTimeStorageKey, fetchTime);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load portfolio";
      setError(message);
      setData(defaultPortfolio);
    } finally {
      setLoading(false);
    }
  };

  const loadConnectionStatus = async () => {
    const [healthResult, statusResult] = await Promise.allSettled([
        API.get("/api/health"),
        API.get("/api/system/status"),
		]);

    if (healthResult.status === "fulfilled") {
      setBackendHealth(healthResult.value.data || null);
    } else {
      setBackendHealth(null);
    }

    if (statusResult.status === "fulfilled") {
      setSystemStatus(statusResult.value.data || null);
    } else {
      setSystemStatus(null);
    }
  };

  useEffect(() => {
    const storedFetchTime = localStorage.getItem(fetchTimeStorageKey);
    if (storedFetchTime) {
      setLastDataFetchAt(storedFetchTime);
    }

    loadPortfolio();
    loadConnectionStatus();
  }, []);

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) {
      return "Not available";
    }

    return new Date(iso).toLocaleString();
  };

  const isRecentWithinMinutes = (iso: string | null | undefined, minutes: number) => {
    if (!iso) {
      return false;
    }

    const parsed = new Date(iso).getTime();
    if (Number.isNaN(parsed)) {
      return false;
    }

    const elapsedMs = Date.now() - parsed;
    return elapsedMs <= minutes * 60 * 1000;
  };

  const backendFresh = isRecentWithinMinutes(lastDataFetchAt, 60);
  const mongoFresh = isRecentWithinMinutes(systemStatus?.database?.lastConnectedAt, 60);
  const mongoUriToShow =
    systemStatus?.database?.mongoUri ||
    "Unavailable. Set EXPOSE_MONGO_URI_TO_CLIENT=true in backend env to expose it.";

  const technologies = useMemo(() => {
    const set = new Set<string>();
    data.projects.forEach((project) => {
      project.technologies.forEach((tech) => set.add(tech));
    });
    return ["All", ...Array.from(set).sort()];
  }, [data.projects]);

  const filteredProjects = useMemo(() => {
    if (activeTech === "All") {
      return data.projects;
    }

    return data.projects.filter((project) =>
      project.technologies.includes(activeTech)
    );
  }, [activeTech, data.projects]);

  const groupedSkills = useMemo(() => {
    return data.skills.reduce<Record<string, Skill[]>>((acc, skill) => {
      const key = skill.category || "Other";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(skill);
      return acc;
    }, {});
  }, [data.skills]);

  return (
    <div className={styles.page}>
      <div className={styles.glowOne} />
      <div className={styles.glowTwo} />
      <Navbar name={data.profile.fullName} />

      <main className={styles.main}>
        <section className={styles.statusPanel}>
          <div className={styles.statusRow}>
            <strong>Frontend to Backend URL:</strong>
            <span>{backendUrl}</span>
          </div>
          <div className={styles.statusRow}>
            <strong>Last portfolio fetch:</strong>
            <span>{formatTime(lastDataFetchAt)}</span>
          </div>
          <div className={styles.statusRow}>
            <strong>Backend healthcheck:</strong>
            <span className={styles.statusValue}>
              <span
                className={backendFresh ? styles.statusDotGreen : styles.statusDotRed}
                aria-hidden="true"
              />
              {backendFresh ? "Healthy" : "Stale or unavailable"}
              {lastDataFetchAt ? ` (last success ${formatTime(lastDataFetchAt)})` : ""}
            </span>
          </div>
          <div className={styles.statusRow}>
            <strong>Health endpoint:</strong>
            <span>
              {systemStatus?.backend?.healthcheckUrl || `${backendUrl}/api/health`}
            </span>
          </div>
          <div className={styles.statusRow}>
            <strong>Backend to MongoDB host:</strong>
            <span>{mongoUriToShow}</span>
          </div>
          <div className={styles.statusRow}>
            <strong>MongoDB database:</strong>
            <span>{systemStatus?.database?.dbName || "Not available"}</span>
          </div>
          <div className={styles.statusRow}>
            <strong>MongoDB connection status:</strong>
            <span className={styles.statusValue}>
              <span
                className={mongoFresh ? styles.statusDotGreen : styles.statusDotRed}
                aria-hidden="true"
              />
              {mongoFresh ? "Connected recently" : "Not connected in last 60 mins"}
              {systemStatus?.database?.state ? ` (${systemStatus.database.state})` : ""}
            </span>
          </div>
          <div className={styles.statusRow}>
            <strong>MongoDB last connected:</strong>
            <span>{formatTime(systemStatus?.database?.lastConnectedAt)}</span>
          </div>
        </section>

        <section className={styles.hero}>
          <p className={styles.kicker}>Open to impactful product engineering roles</p>
          <h1>{data.profile.fullName}</h1>
          <h2>{data.profile.headline}</h2>
          <p className={styles.bio}>{data.profile.bio}</p>
          <div className={styles.metaRow}>
            <span>{data.profile.location}</span>
            <a href={`mailto:${data.profile.email}`}>{data.profile.email}</a>
          </div>
          <div className={styles.socials}>
            {data.profile.socials.map((social) => (
              <a key={social.label} href={social.url} target="_blank" rel="noreferrer">
                {social.label}
              </a>
            ))}
            {data.profile.resumeUrl && (
              <a href={data.profile.resumeUrl} target="_blank" rel="noreferrer">
                Resume
              </a>
            )}
          </div>
        </section>

        <section className={styles.panel} id="skills">
          <div className={styles.sectionHead}>
            <h3>Skills</h3>
            <p>Built for delivery, scale, and maintainability.</p>
          </div>

          {loading && <p className={styles.note}>Loading skills...</p>}

          {!loading && (
            <div className={styles.skillGrid}>
              {Object.entries(groupedSkills).map(([category, categorySkills]) => (
                <article className={styles.skillCard} key={category}>
                  <h4>{category}</h4>
                  <ul>
                    {categorySkills.map((skill) => (
                      <li key={`${category}-${skill.name}`}>
                        <span>{skill.name}</span>
                        <small>
                          {skill.level} - {skill.years}y
                        </small>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel} id="projects">
          <div className={styles.sectionHead}>
            <h3>Projects</h3>
            <p>Filter by stack to explore relevant work quickly.</p>
          </div>

          <div className={styles.filterRow}>
            {technologies.map((tech) => (
              <button
                type="button"
                key={tech}
                className={activeTech === tech ? styles.filterActive : styles.filterChip}
                onClick={() => setActiveTech(tech)}
              >
                {tech}
              </button>
            ))}
          </div>

          {loading && <p className={styles.note}>Loading projects...</p>}

          {!loading && (
            <div className={styles.projectGrid}>
              {filteredProjects.map((project) => (
                <ProjectCard key={project.title} project={project} />
              ))}
            </div>
          )}
        </section>

        {error && (
          <section className={styles.errorBox}>
            <p>{error}</p>
            <button type="button" onClick={loadPortfolio}>
              Retry
            </button>
          </section>
        )}

        <section className={styles.footerCta}>
          <h3>Let's build something users genuinely enjoy.</h3>
          <a href={`mailto:${data.profile.email}`}>Start a conversation</a>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          Crafted with Next.js + Express for a clean user and developer experience.
        </p>
      </footer>
    </div>
  );
}
